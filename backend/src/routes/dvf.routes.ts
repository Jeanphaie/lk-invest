import express, { Request, Response, Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { OpenAI } from 'openai';
import { InputsDvfSchema } from '../../../shared/types/dvfInputs';
import { ProjectService } from '../services/project.service';

const prisma = new PrismaClient();
const projectService = new ProjectService();
const router: Router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Schéma de validation pour la requête DVF (uniquement les filtres)
const dvfAnalyseRequestSchema = InputsDvfSchema.extend({ code_postal: z.string().optional() });

// Route pour le proxy Nominatim
router.get('/proxy-nominatim', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q) {
      console.error('Erreur Nominatim: paramètre q manquant');
      return res.status(400).json({ error: "Le paramètre 'q' est requis" });
    }

    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q,
        format: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': 'DVFApp/1.0'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Erreur Nominatim:', error instanceof Error ? error.message : 'Erreur inconnue');
    res.status(500).json({ error: 'Erreur lors de la géolocalisation' });
  }
});

// Route unifiée pour tout le DVF (agrégats, propriétés, séries, distribution, scatter)
router.post('/:projectId/analyse', async (req, res) => {
  try {
    // Récupérer le projectId depuis l'URL
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'ID de projet invalide' });
    }
    // Charger le projet pour récupérer les coordonnées
    const project = await projectService.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }
    const { latitude, longitude } = project.inputsGeneral || {};
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'Latitude/longitude manquantes dans inputsGeneral' });
    }
    // Validation des filtres
    const data = dvfAnalyseRequestSchema.parse(req.body);
    const lat = latitude;
    const lng = longitude;
    const rayon = Number(data.rayon);
    const prix_min = data.prixMin ? Number(data.prixMin) * 1000 : null;
    const surface_min = data.surfaceMin ? Number(data.surfaceMin) : null;
    const prix_m2_min = data.prixM2Min ? Number(data.prixM2Min) * 1000 : null;
    const outlier_lower_bound_percent = Number(data.outlierLowerBoundPercent) / 100;
    const outlier_upper_bound_coeff = Number(data.outlierUpperBoundCoeff);

    // 1. Déterminer dynamiquement le code postal le plus proche
    let code_postal = data.code_postal;
    if (!code_postal) {
      const cpResult = await prisma.$queryRaw<any[]>`
        SELECT code_postal
        FROM "DVF"
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        ORDER BY sqrt(power(latitude - ${lat}, 2) + power(longitude - ${lng}, 2))
        LIMIT 1;
      `;
      code_postal = cpResult[0]?.code_postal || '';
    }
    if (!code_postal) {
      console.error('Aucun code postal trouvé à proximité des coordonnées:', { lat, lng });
      return res.status(404).json({ error: 'Aucun code postal trouvé à proximité.' });
    }

    // 2. Récupérer toutes les transactions brutes de l'arrondissement
    console.log('Appel get_dvf_raw avec :', {
      lat, lng, rayon, code_postal, prix_min, surface_min, prix_m2_min,
      types: {
        lat: typeof lat,
        lng: typeof lng,
        rayon: typeof rayon,
        code_postal: typeof code_postal,
        prix_min: typeof prix_min,
        surface_min: typeof surface_min,
        prix_m2_min: typeof prix_m2_min,
      }
    });
    const rawRows = await prisma.$queryRaw<any[]>`
      SELECT * FROM get_dvf_raw(
        ${lat}::float,
        ${lng}::float,
        ${rayon}::float,
        ${code_postal}::text,
        ${prix_min !== null ? prix_min : null}::float,
        ${surface_min !== null ? surface_min : null}::float,
        ${prix_m2_min !== null ? prix_m2_min : null}::float
      );
    `;
    if (!rawRows || rawRows.length === 0) {
      console.error('Aucune donnée DVF trouvée pour le secteur:', { lat, lng, rayon, code_postal });
      return res.status(404).json({ error: 'Aucune donnée DVF trouvée pour ce secteur.' });
    }

    // Fonction de pondération temporelle (exponential decay) - doit être visible partout
    const reference_date = new Date(2024, 5, 30); // 30 juin 2024
    const lambda_decay = 0.0019;
    function calculate_temporal_weight(transaction_date_str: string): number {
      const transaction_date = new Date(transaction_date_str);
      const days_distance = Math.max(0, (reference_date.getTime() - transaction_date.getTime()) / (1000*60*60*24));
      return Math.exp(-lambda_decay * days_distance);
    }

    // 3. Calcul des bornes outliers arrondissement
    const prix_m2_arr = rawRows.map(row => row.prix_m2).filter(Boolean);
    const arr_avg_for_outliers = prix_m2_arr.length ? prix_m2_arr.reduce((a, b) => a + b, 0) / prix_m2_arr.length : 0;
    const lower_bound_arr = arr_avg_for_outliers * outlier_lower_bound_percent;
    const upper_bound_arr = arr_avg_for_outliers * outlier_upper_bound_coeff;

    // 4. Marquage outliers
    rawRows.forEach(row => {
      row.is_outlier = !(lower_bound_arr <= row.prix_m2 && row.prix_m2 <= upper_bound_arr);
    });

    // 5. Sélection dans le cercle
    function geodesic(lat1: number, lon1: number, lat2: number, lon2: number): number {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    }
    const selection = rawRows.filter(row => geodesic(lat, lng, row.latitude, row.longitude) <= rayon);
    const selection_no_outliers = selection.filter(row => !row.is_outlier);
    const rawRowsNoOutliers = rawRows.filter(row => !row.is_outlier);

    // 6. Pondération temporelle (exponential decay)
    let sel_sum_weighted = 0, sel_surface_weighted = 0;
    for (const row of selection_no_outliers) {
      if (row.surface_reelle_bati <= 0) continue;
      const temp_weight = calculate_temporal_weight(row.date_mutation);
      const total_weight = row.surface_reelle_bati * temp_weight;
      const weighted_price = row.prix_m2 * total_weight;
      sel_sum_weighted += weighted_price;
      sel_surface_weighted += total_weight;
    }
    const sel_final_avg = sel_surface_weighted ? sel_sum_weighted / sel_surface_weighted : 0;
    let arr_sum_weighted = 0, arr_surface_weighted = 0;
    for (const row of rawRowsNoOutliers) {
      if (row.surface_reelle_bati <= 0) continue;
      const temp_weight = calculate_temporal_weight(row.date_mutation);
      const total_weight = row.surface_reelle_bati * temp_weight;
      const weighted_price = row.prix_m2 * total_weight;
      arr_sum_weighted += weighted_price;
      arr_surface_weighted += total_weight;
    }
    const arr_final_avg = arr_surface_weighted ? arr_sum_weighted / arr_surface_weighted : 0;
    const sorted_arr_cleaned = [...rawRowsNoOutliers].sort((a, b) => b.prix_m2 - a.prix_m2);
    const top_10_percent_count = Math.max(1, Math.floor(sorted_arr_cleaned.length * 0.1));
    const premium_data = sorted_arr_cleaned.slice(0, top_10_percent_count);
    let premium_sum_weighted = 0, premium_surface_weighted = 0;
    for (const row of premium_data) {
      if (row.surface_reelle_bati <= 0) continue;
      const temp_weight = calculate_temporal_weight(row.date_mutation);
      const total_weight = row.surface_reelle_bati * temp_weight;
      const weighted_price = row.prix_m2 * total_weight;
      premium_sum_weighted += weighted_price;
      premium_surface_weighted += total_weight;
    }
    const premium_final_avg = premium_surface_weighted ? premium_sum_weighted / premium_surface_weighted : 0;

    // 7. Séries temporelles (yearly, exponential decay)
    const trend_series = [];
    for (let year = 2019; year <= 2024; year++) {
      const year_sel_data = selection_no_outliers.filter(row => row.date_mutation.startsWith(year.toString()));
      const year_arr_data = rawRowsNoOutliers.filter(row => row.date_mutation.startsWith(year.toString()));
      const year_premium_data = [...year_arr_data].sort((a, b) => b.prix_m2 - a.prix_m2).slice(0, Math.max(1, Math.floor(year_arr_data.length * 0.1)));
      const sel_sum_valeur = year_sel_data.reduce((sum, row) => sum + (row.valeur_fonciere || 0), 0);
      const sel_sum_surface = year_sel_data.reduce((sum, row) => sum + (row.surface_reelle_bati || 0), 0);
      const sel_avg = sel_sum_surface > 0 ? sel_sum_valeur / sel_sum_surface : 0;
      const arr_sum_valeur = year_arr_data.reduce((sum, row) => sum + (row.valeur_fonciere || 0), 0);
      const arr_sum_surface = year_arr_data.reduce((sum, row) => sum + (row.surface_reelle_bati || 0), 0);
      const arr_avg = arr_sum_surface > 0 ? arr_sum_valeur / arr_sum_surface : 0;
      const premium_sum_valeur = year_premium_data.reduce((sum, row) => sum + (row.valeur_fonciere || 0), 0);
      const premium_sum_surface = year_premium_data.reduce((sum, row) => sum + (row.surface_reelle_bati || 0), 0);
      const premium_avg = premium_sum_surface > 0 ? premium_sum_valeur / premium_sum_surface : 0;
      trend_series.push({
        year,
        selection_avg: sel_avg,
        selection_count: year_sel_data.length,
        arrondissement_avg: arr_avg,
        arrondissement_count: year_arr_data.length,
        premium_avg: premium_avg,
        premium_count: year_premium_data.length
      });
    }

    // 8. Distribution des prix
    const prix_m2_values = selection_no_outliers.map(row => row.prix_m2).filter(Boolean);
    let distribution_series: any[] = [];
    if (prix_m2_values.length) {
      const min_prix_m2 = Math.min(...prix_m2_values);
      const max_prix_m2 = Math.max(...prix_m2_values);
      const bin_size = (max_prix_m2 - min_prix_m2) / 5 || 1;
      const bins = Array.from({length: 6}, (_, i) => min_prix_m2 + i * bin_size);
      const distribution = Array(5).fill(0);
      for (const prix of prix_m2_values) {
        for (let i = 0; i < 5; i++) {
          if (prix >= bins[i] && prix < bins[i+1]) {
            distribution[i]++;
            break;
          }
        }
      }
      distribution_series = distribution.map((count, i) => ({
        bin: `${Math.round(bins[i]/1000)}k-${Math.round(bins[i+1]/1000)}k`,
        count
      }));
    }

    // Log pour vérifier la structure de distribution_series
    console.log('distribution_series sample:', distribution_series[0]);

    // 9. Scatter plot
    const scatter_series = selection_no_outliers.map(row => ({
      surface: row.surface_reelle_bati,
      prix: row.valeur_fonciere / 1000,
      prix_m2: row.prix_m2 / 1000,
      is_outlier: row.is_outlier
    }));

    // 10. Comptages
    const selection_total_count = selection.length;
    const selection_outlier_count = selection.filter(r => r.is_outlier).length;
    const arrondissement_total_count = rawRows.length;
    const arrondissement_outlier_count = rawRows.filter(r => r.is_outlier).length;
    const premium_total_count = premium_data.length;
    const premium_outlier_count = premium_data.filter(r => r.is_outlier).length;

    // Mapping des champs pour le frontend
    const dvfProperties = selection.map(row => ({
      // Champs natifs
      id: row.id,
      latitude: row.latitude,
      longitude: row.longitude,
      prix: row.valeur_fonciere,
      surface: row.surface_reelle_bati,
      prix_m2: row.prix_m2,
      date_mutation: row.date_mutation,
      // Champs d'adresse (mapping explicite)
      numero: row.adresse_numero,
      voie: row.adresse_nom_voie,
      ville: row.nom_commune,
      code_postal: row.code_postal,
      // Autres champs utiles
      is_outlier: row.is_outlier,
      type: row.type_local,
      valeur_fonciere: row.valeur_fonciere,
      surface_reelle_bati: row.surface_reelle_bati,
      nombre_pieces_principales: row.nombre_pieces_principales,
      // ... (ajoute tout ce que tu veux exposer au front)
    }));

    // Mapping pour distributionSeries
    const distributionSeries = distribution_series.map(row => {
      // Extraire les valeurs numériques du bin (ex: "8k-10k" -> 8000 et 10000)
      const [minStr, maxStr] = row.bin.split('-');
      const min = parseFloat(minStr.replace('k', '000'));
      const max = parseFloat(maxStr.replace('k', '000'));
      
      return {
        prixM2: (min + max) / 2, // centre du bin
        nombreTransactions: row.count
      };
    });

    // Mapping pour scatterSeries
    const scatterSeries = scatter_series.map(row => ({
      surface: row.surface,
      prix: row.prix,
      prixM2: row.prix_m2,
      isOutlier: row.is_outlier
    }));

    // Nettoyer les anciennes données DVF liées à ce projet
    await prisma.dvfTransaction.deleteMany({ where: { projectId } });
    await prisma.dvfSeries.deleteMany({ where: { projectId } });
    await prisma.dvfDistribution.deleteMany({ where: { projectId } });
    await prisma.dvfPremiumTransaction.deleteMany({ where: { projectId } });

    // Insérer les nouvelles transactions DVF (sélection)
    await prisma.dvfTransaction.createMany({
      data: selection.map(row => ({
        projectId,
        data: row
      }))
    });

    // Insérer les nouvelles transactions premium
    await prisma.dvfPremiumTransaction.createMany({
      data: premium_data.map(row => ({
        projectId,
        data: row
      }))
    });

    // Insérer les nouvelles séries DVF
    await prisma.dvfSeries.createMany({
      data: trend_series.map(serie => ({
        projectId,
        type: 'trend',
        data: serie
      }))
    });

    // Insérer les nouvelles distributions DVF
    await prisma.dvfDistribution.createMany({
      data: distribution_series.map(dist => ({
        projectId,
        data: dist
      }))
    });

    // Mapping pour le frontend des transactions premium
    const dvfPremiumProperties = premium_data.map(row => ({
      id: row.id,
      latitude: row.latitude,
      longitude: row.longitude,
      prix: row.valeur_fonciere,
      surface: row.surface_reelle_bati,
      prix_m2: row.prix_m2,
      date_mutation: row.date_mutation,
      numero: row.adresse_numero,
      voie: row.adresse_nom_voie,
      ville: row.nom_commune,
      code_postal: row.code_postal,
      is_outlier: row.is_outlier,
      type: row.type_local,
      valeur_fonciere: row.valeur_fonciere,
      surface_reelle_bati: row.surface_reelle_bati,
      nombre_pieces_principales: row.nombre_pieces_principales,
    }));

    // Sauvegarder les résultats dans le projet
    await projectService.updateProject(projectId, {
      inputsDvf: data,
      resultsDvfMetadata: {
        sel_final_avg,
        arr_final_avg,
        premium_final_avg,
        outlier_lower_bound: lower_bound_arr,
        outlier_upper_bound: upper_bound_arr,
        arrondissement_avg_for_outliers: arr_avg_for_outliers,
        selection_total_count,
        selection_outlier_count,
        arrondissement_total_count,
        arrondissement_outlier_count,
        premium_total_count,
        premium_outlier_count
      }
    });

    res.json({
      dvfResults: {
        sel_final_avg,
        arr_final_avg,
        premium_final_avg,
        outlier_lower_bound: lower_bound_arr,
        outlier_upper_bound: upper_bound_arr,
        arrondissement_avg_for_outliers: arr_avg_for_outliers,
        selection_total_count,
        selection_outlier_count,
        arrondissement_total_count,
        arrondissement_outlier_count,
        premium_total_count,
        premium_outlier_count
      },
      dvfProperties,
      dvfPremiumProperties,
      trendSeries: trend_series,
      distributionSeries,
      scatterSeries
    });
  } catch (error) {
    console.error('Erreur serveur lors de l\'analyse:', error instanceof Error ? error.message : 'Erreur inconnue');
    res.status(500).json({ error: 'Erreur serveur', message: error instanceof Error ? error.message : error });
  }
});

// POST /api/projects/:id/generate-quartier-description
router.post('/:id/generate-quartier-description', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      console.error('[OpenAI] ID de projet invalide:', req.params.id);
      return res.status(400).json({ error: 'ID de projet invalide' });
    }

    const project = await projectService.getProjectById(projectId);
    if (!project) {
      console.error('[OpenAI] Projet non trouvé pour id:', projectId);
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    if (!project.inputsGeneral?.adresseBien) {
      console.error('[OpenAI] Adresse du bien manquante pour le projet:', projectId);
      return res.status(400).json({ error: 'Adresse du bien manquante' });
    }

    // Préparer le prompt pour OpenAI
    const prompt = `Décris le quartier de ${project.inputsGeneral.adresseBien} en mettant en avant ses caractéristiques, son ambiance, ses atouts et ses points d'intérêt. La description doit être concise mais détaillée, en français, et ne pas dépasser 60 mots.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Tu es un expert immobilier qui décrit les quartiers de manière professionnelle et engageante."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const description = completion.choices[0]?.message?.content;

    if (!description) {
      throw new Error('Pas de réponse de l\'API OpenAI');
    }

    // Sauvegarder la description dans le projet
    await projectService.updateProject(projectId, {
      inputsGeneral: {
        ...project.inputsGeneral,
        description_quartier: description
      }
    });

    res.json({ description });
  } catch (error) {
    console.error('[OpenAI] Erreur lors de la génération de la description du quartier:', error);
    res.status(500).json({ error: 'Erreur lors de la génération de la description du quartier' });
  }
});

export default router; 