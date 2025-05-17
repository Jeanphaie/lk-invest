"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const prisma = new client_1.PrismaClient();
const router = express_1.default.Router();
// Schéma de validation pour la requête DVF
const dvfRequestSchema = zod_1.z.object({
    latitude: zod_1.z.number(),
    longitude: zod_1.z.number(),
    rayon: zod_1.z.number().optional(),
    prixMin: zod_1.z.number().nullable().optional(),
    surfaceMin: zod_1.z.number().nullable().optional(),
    prixM2Min: zod_1.z.number().nullable().optional(),
    outlierLowerBoundPercent: zod_1.z.number().optional(),
    outlierUpperBoundCoeff: zod_1.z.number().optional()
});
// Fonction utilitaire pour calculer la distance Haversine
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
// Route pour le proxy Nominatim
router.get('/proxy-nominatim', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ error: "Le paramètre 'q' est requis" });
        }
        const response = await axios_1.default.get('https://nominatim.openstreetmap.org/search', {
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
    }
    catch (error) {
        console.error('Erreur lors de la requête Nominatim:', error);
        res.status(500).json({ error: 'Erreur lors de la géolocalisation' });
    }
});
// Route principale DVF
router.post('/search', async (req, res) => {
    try {
        const data = dvfRequestSchema.parse(req.body);
        // Appel de la fonction SQL get_dvf_stats
        const result = await prisma.$queryRaw `
      SELECT * FROM get_dvf_stats(
        ${data.latitude}::float,
        ${data.longitude}::float,
        ${data.rayon}::float,
        ${data.prixMin === null ? null : data.prixMin}::float,
        ${data.surfaceMin === null ? null : data.surfaceMin}::float,
        ${data.prixM2Min === null ? null : data.prixM2Min}::float,
        ${data.outlierLowerBoundPercent}::float,
        ${data.outlierUpperBoundCoeff}::float
      );
    `;
        // Extraction des résultats
        const stats = result[0];
        // Préparation de la réponse
        const response = {
            // Statistiques globales
            dvfResults: {
                sel_final_avg: stats.sel_final_avg,
                arr_final_avg: stats.arr_final_avg,
                premium_final_avg: stats.premium_final_avg,
                outlier_lower_bound: stats.outlier_lower_bound,
                outlier_upper_bound: stats.outlier_upper_bound,
                arrondissement_avg_for_outliers: stats.arrondissement_avg_for_outliers
            },
            // Séries temporelles
            trendSeries: Array.from({ length: 6 }, (_, i) => {
                const year = 2019 + i;
                return {
                    year,
                    selection_avg: stats[`selection_avg_${year}`],
                    selection_count: stats[`selection_count_${year}`],
                    arrondissement_avg: stats[`arrondissement_avg_${year}`],
                    arrondissement_count: stats[`arrondissement_count_${year}`],
                    premium_avg: stats[`premium_avg_${year}`],
                    premium_count: stats[`premium_count_${year}`]
                };
            }),
            // Propriétés
            dvfProperties: (stats.properties || []).map((prop) => (Object.assign(Object.assign({}, prop), { prix_m2: prop.prix_m2, valeur_fonciere: prop.valeur_fonciere }))),
            // Distribution et scatter plot seront calculés côté client à partir des propriétés
        };
        res.json(response);
    }
    catch (error) {
        console.error('Erreur lors de la recherche DVF:', error);
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                error: 'Données invalides',
                details: error.errors
            });
        }
        else {
            res.status(500).json({
                error: 'Erreur lors de la recherche',
                message: error instanceof Error ? error.message : 'Erreur inconnue'
            });
        }
    }
});
// Route pour les statistiques de base
router.post('/base-stats', async (req, res) => {
    var _a;
    try {
        const data = req.body;
        const lat = Number(data.latitude);
        const lng = Number(data.longitude);
        const rayon = Number(data.rayon);
        const prix_min = data.prixMin ? Number(data.prixMin) * 1000 : null;
        const surface_min = data.surfaceMin ? Number(data.surfaceMin) : null;
        const prix_m2_min = data.prixM2Min ? Number(data.prixM2Min) * 1000 : null;
        const outlier_lower_bound_percent = Number(data.outlierLowerBoundPercent) / 100;
        const outlier_upper_bound_coeff = Number(data.outlierUpperBoundCoeff);
        // 1. Déterminer dynamiquement le code postal le plus proche
        let code_postal = data.code_postal;
        if (!code_postal) {
            const cpResult = await prisma.$queryRaw `
        SELECT code_postal
        FROM "DVF"
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        ORDER BY sqrt(power(latitude - ${lat}, 2) + power(longitude - ${lng}, 2))
        LIMIT 1;
      `;
            code_postal = ((_a = cpResult[0]) === null || _a === void 0 ? void 0 : _a.code_postal) || '';
        }
        if (!code_postal) {
            return res.status(404).json({ error: 'Aucun code postal trouvé à proximité.' });
        }
        // 2. Récupérer toutes les transactions brutes de l'arrondissement
        const rawRows = await prisma.$queryRaw `
      SELECT * FROM get_dvf_raw(
        ${lat}::float,
        ${lng}::float,
        ${rayon}::float,
        ${code_postal}::text,
        ${prix_min},
        ${surface_min},
        ${prix_m2_min}
      );
    `;
        if (!rawRows || rawRows.length === 0) {
            return res.status(404).json({ error: 'Aucune donnée DVF trouvée pour ce secteur.' });
        }
        // Après la récupération de rawRows, s'assurer que chaque row a bien code_postal et nombre_pieces_principales
        for (const row of rawRows) {
            row.adresse_complete = [
                row.adresse_numero,
                row.adresse_nom_voie
            ].filter(Boolean).join(' ');
            row.code_postal = row.code_postal || '';
            row.nombre_pieces_principales = row.nombre_pieces_principales || null;
            if (!row.latitude || !row.longitude) {
                console.warn('Transaction sans coordonnées:', row.adresse_complete);
            }
        }
        // 3. Déduplication (adresse_nom_voie, adresse_numero, date_mutation)
        const dedupMap = new Map();
        for (const row of rawRows) {
            const key = `${row.adresse_nom_voie}|${row.adresse_numero}|${row.date_mutation}`;
            if (!dedupMap.has(key)) {
                dedupMap.set(key, row);
            }
        }
        const arrData = Array.from(dedupMap.values());
        // 4. Calcul de la moyenne pondérée par surface pour les bornes
        let arr_sum_valeur = 0, arr_sum_surface = 0;
        for (const row of arrData) {
            if (row.valeur_fonciere && row.surface_reelle_bati && row.surface_reelle_bati > 0) {
                arr_sum_valeur += row.valeur_fonciere;
                arr_sum_surface += row.surface_reelle_bati;
            }
        }
        const arr_avg_for_outliers = arr_sum_surface > 0 ? arr_sum_valeur / arr_sum_surface : 0;
        const lower_bound_arr = arr_avg_for_outliers * outlier_lower_bound_percent;
        const upper_bound_arr = arr_avg_for_outliers * outlier_upper_bound_coeff;
        // 5. Sélection dans le rayon
        const geodesic = (lat1, lng1, lat2, lng2) => {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lng2 - lng1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };
        const selection_within_radius = arrData.filter(row => {
            const distance = geodesic(lat, lng, row.latitude, row.longitude);
            row.distance = distance;
            row.is_outlier = !(lower_bound_arr <= row.prix_m2 && row.prix_m2 <= upper_bound_arr);
            return distance <= rayon;
        });
        // 6. Filtres supplémentaires (déjà appliqués en SQL, mais on garde pour sécurité)
        let filtered_data = selection_within_radius;
        if (prix_min)
            filtered_data = filtered_data.filter(row => row.valeur_fonciere >= prix_min);
        if (surface_min)
            filtered_data = filtered_data.filter(row => row.surface_reelle_bati >= surface_min);
        if (prix_m2_min)
            filtered_data = filtered_data.filter(row => row.prix_m2 >= prix_m2_min);
        // 7. Version sans outliers
        const filtered_data_no_outliers = filtered_data.filter(row => !row.is_outlier);
        // 8. Moyenne pondérée temporelle pour la sélection
        const reference_date = new Date(2024, 5, 30); // 30 juin 2024
        const lambda_decay = 0.0019;
        function calculate_temporal_weight(transaction_date_str) {
            const transaction_date = new Date(transaction_date_str);
            const days_distance = Math.max(0, (reference_date.getTime() - transaction_date.getTime()) / (1000 * 60 * 60 * 24));
            return Math.exp(-lambda_decay * days_distance);
        }
        let sel_sum_weighted = 0, sel_surface_weighted = 0;
        for (const row of filtered_data_no_outliers) {
            if (row.surface_reelle_bati <= 0)
                continue;
            const temp_weight = calculate_temporal_weight(row.date_mutation);
            const total_weight = row.surface_reelle_bati * temp_weight;
            const weighted_price = row.prix_m2 * total_weight;
            sel_sum_weighted += weighted_price;
            sel_surface_weighted += total_weight;
        }
        const sel_final_avg = sel_surface_weighted ? sel_sum_weighted / sel_surface_weighted : 0;
        // 9. Moyenne pondérée temporelle pour l'arrondissement
        let arr_sum_weighted = 0, arr_surface_weighted = 0;
        for (const row of arrData) {
            if (row.surface_reelle_bati <= 0)
                continue;
            const temp_weight = calculate_temporal_weight(row.date_mutation);
            const total_weight = row.surface_reelle_bati * temp_weight;
            const weighted_price = row.prix_m2 * total_weight;
            arr_sum_weighted += weighted_price;
            arr_surface_weighted += total_weight;
        }
        const arr_final_avg = arr_surface_weighted ? arr_sum_weighted / arr_surface_weighted : 0;
        // 10. Premium (top 10%)
        const sorted_arr_cleaned = [...arrData].sort((a, b) => b.prix_m2 - a.prix_m2);
        const top_10_percent_count = Math.max(1, Math.floor(sorted_arr_cleaned.length * 0.1));
        const premium_data = sorted_arr_cleaned.slice(0, top_10_percent_count);
        let premium_sum_weighted = 0, premium_surface_weighted = 0;
        for (const row of premium_data) {
            if (row.surface_reelle_bati <= 0)
                continue;
            const temp_weight = calculate_temporal_weight(row.date_mutation);
            const total_weight = row.surface_reelle_bati * temp_weight;
            const weighted_price = row.prix_m2 * total_weight;
            premium_sum_weighted += weighted_price;
            premium_surface_weighted += total_weight;
        }
        const premium_final_avg = premium_surface_weighted ? premium_sum_weighted / premium_surface_weighted : 0;
        // 11. Séries temporelles
        const trend_series = [];
        for (let year = 2019; year <= 2024; year++) {
            const year_sel_data = filtered_data_no_outliers.filter(row => row.date_mutation.startsWith(year.toString()));
            const year_arr_data = arrData.filter(row => row.date_mutation.startsWith(year.toString()));
            const year_premium_data = premium_data.filter(row => row.date_mutation.startsWith(year.toString()));
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
        // 12. Distribution des prix
        const prix_m2_values = filtered_data_no_outliers.map(row => row.prix_m2).filter(Boolean);
        let distribution_series = [];
        if (prix_m2_values.length) {
            const min_prix_m2 = Math.min(...prix_m2_values);
            const max_prix_m2 = Math.max(...prix_m2_values);
            const bin_size = (max_prix_m2 - min_prix_m2) / 5 || 1;
            const bins = Array.from({ length: 6 }, (_, i) => min_prix_m2 + i * bin_size);
            const distribution = Array(5).fill(0);
            for (const prix of prix_m2_values) {
                for (let i = 0; i < 5; i++) {
                    if (prix >= bins[i] && prix < bins[i + 1]) {
                        distribution[i]++;
                        break;
                    }
                }
            }
            distribution_series = distribution.map((count, i) => ({
                bin: `${Math.round(bins[i] / 1000)}k-${Math.round(bins[i + 1] / 1000)}k`,
                count
            }));
        }
        // 13. Scatter plot
        const scatter_series = filtered_data_no_outliers.map(row => ({
            surface: row.surface_reelle_bati,
            prix: row.valeur_fonciere / 1000,
            prix_m2: row.prix_m2 / 1000,
            is_outlier: row.is_outlier
        }));
        // 14. Réponse
        console.log('Exemple de propriété envoyée:', rawRows[0]);
        console.log('Propriétés envoyées:', rawRows.map(r => ({ lat: r.latitude, lng: r.longitude, adresse: r.adresse_complete })));
        res.json({
            sel_final_avg: sel_final_avg,
            arr_final_avg: arr_final_avg,
            premium_final_avg: premium_final_avg,
            outlier_lower_bound: lower_bound_arr,
            outlier_upper_bound: upper_bound_arr,
            arrondissement_avg_for_outliers: arr_avg_for_outliers,
            properties: filtered_data,
            trendSeries: trend_series,
            distributionSeries: distribution_series,
            scatterSeries: scatter_series
        });
    }
    catch (error) {
        console.error('❌ Erreur dans la nouvelle route DVF:', error);
        res.status(500).json({ error: 'Erreur serveur', message: error instanceof Error ? error.message : error });
    }
});
// Route pour les statistiques annuelles
router.post('/yearly-stats', async (req, res) => {
    try {
        console.log('🚀 Début de la requête yearly-stats');
        console.log('📊 Données reçues:', req.body);
        const data = dvfRequestSchema.parse(req.body);
        console.log('✅ Données validées:', data);
        console.log('🔍 Exécution de la requête SQL...');
        const result = await prisma.$queryRaw `
      SELECT * FROM get_dvf_yearly_stats(
        ${data.latitude}::float,
        ${data.longitude}::float,
        ${data.rayon}::float,
        ${data.outlierLowerBoundPercent}::float,
        ${data.outlierUpperBoundCoeff}::float
      );
    `;
        console.log('✨ Résultat SQL obtenu:', result);
        res.json(result);
    }
    catch (error) {
        console.error('❌ Erreur dans yearly-stats:', error);
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                error: 'Données invalides',
                details: error.errors
            });
        }
        else {
            res.status(500).json({
                error: 'Erreur lors de la récupération des statistiques annuelles',
                message: error instanceof Error ? error.message : 'Erreur inconnue'
            });
        }
    }
});
// Route pour les propriétés
router.post('/properties', async (req, res) => {
    try {
        const data = dvfRequestSchema.parse(req.body);
        const result = await prisma.$queryRaw `
      SELECT * FROM get_dvf_properties(
        ${data.latitude}::float,
        ${data.longitude}::float,
        ${data.rayon}::float,
        ${data.outlierLowerBoundPercent}::float,
        ${data.outlierUpperBoundCoeff}::float
      );
    `;
        res.json(result);
    }
    catch (error) {
        console.error('Erreur lors de la récupération des propriétés:', error);
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                error: 'Données invalides',
                details: error.errors
            });
        }
        else {
            res.status(500).json({
                error: 'Erreur lors de la récupération des propriétés',
                message: error instanceof Error ? error.message : 'Erreur inconnue'
            });
        }
    }
});
// Nouvelle route pour la série temporelle (trendSeries)
router.post('/trend-series', async (req, res) => {
    var _a;
    try {
        const data = req.body;
        const lat = Number(data.latitude);
        const lng = Number(data.longitude);
        const rayon = Number(data.rayon);
        const prix_min = data.prixMin ? Number(data.prixMin) * 1000 : null;
        const surface_min = data.surfaceMin ? Number(data.surfaceMin) : null;
        const prix_m2_min = data.prixM2Min ? Number(data.prixM2Min) * 1000 : null;
        const outlier_lower_bound_percent = Number(data.outlierLowerBoundPercent) / 100;
        const outlier_upper_bound_coeff = Number(data.outlierUpperBoundCoeff);
        // 1. Déterminer dynamiquement le code postal le plus proche
        let code_postal = data.code_postal;
        if (!code_postal) {
            const cpResult = await prisma.$queryRaw `
        SELECT code_postal
        FROM "DVF"
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        ORDER BY sqrt(power(latitude - ${lat}, 2) + power(longitude - ${lng}, 2))
        LIMIT 1;
      `;
            code_postal = ((_a = cpResult[0]) === null || _a === void 0 ? void 0 : _a.code_postal) || '';
        }
        if (!code_postal) {
            return res.status(404).json({ error: 'Aucun code postal trouvé à proximité.' });
        }
        // 2. Récupérer toutes les transactions brutes de l'arrondissement
        const rawRows = await prisma.$queryRaw `
      SELECT * FROM get_dvf_raw(
        ${lat}::float,
        ${lng}::float,
        ${rayon}::float,
        ${code_postal}::text,
        ${prix_min},
        ${surface_min},
        ${prix_m2_min}
      );
    `;
        if (!rawRows || rawRows.length === 0) {
            return res.status(404).json({ error: 'Aucune donnée DVF trouvée pour ce secteur.' });
        }
        // Nettoyage et bornes outliers
        for (const row of rawRows) {
            row.adresse_complete = [
                row.adresse_numero,
                row.adresse_nom_voie
            ].filter(Boolean).join(' ');
            row.code_postal = row.code_postal || '';
            row.nombre_pieces_principales = row.nombre_pieces_principales || null;
        }
        const dedupMap = new Map();
        for (const row of rawRows) {
            const key = `${row.adresse_nom_voie}|${row.adresse_numero}|${row.date_mutation}`;
            if (!dedupMap.has(key)) {
                dedupMap.set(key, row);
            }
        }
        const arrData = Array.from(dedupMap.values());
        let arr_sum_valeur = 0, arr_sum_surface = 0;
        for (const row of arrData) {
            if (row.valeur_fonciere && row.surface_reelle_bati && row.surface_reelle_bati > 0) {
                arr_sum_valeur += row.valeur_fonciere;
                arr_sum_surface += row.surface_reelle_bati;
            }
        }
        const arr_avg_for_outliers = arr_sum_surface > 0 ? arr_sum_valeur / arr_sum_surface : 0;
        const lower_bound_arr = arr_avg_for_outliers * outlier_lower_bound_percent;
        const upper_bound_arr = arr_avg_for_outliers * outlier_upper_bound_coeff;
        const geodesic = (lat1, lng1, lat2, lng2) => {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lng2 - lng1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };
        const selection_within_radius = arrData.filter(row => {
            const distance = geodesic(lat, lng, row.latitude, row.longitude);
            row.distance = distance;
            row.is_outlier = !(lower_bound_arr <= row.prix_m2 && row.prix_m2 <= upper_bound_arr);
            return distance <= rayon;
        });
        let filtered_data = selection_within_radius;
        if (prix_min)
            filtered_data = filtered_data.filter(row => row.valeur_fonciere >= prix_min);
        if (surface_min)
            filtered_data = filtered_data.filter(row => row.surface_reelle_bati >= surface_min);
        if (prix_m2_min)
            filtered_data = filtered_data.filter(row => row.prix_m2 >= prix_m2_min);
        const filtered_data_no_outliers = filtered_data.filter(row => !row.is_outlier);
        // Série temporelle
        const trend_series = [];
        for (let year = 2019; year <= 2024; year++) {
            const year_sel_data = filtered_data_no_outliers.filter(row => row.date_mutation.startsWith(year.toString()));
            const year_arr_data = arrData.filter(row => row.date_mutation.startsWith(year.toString()));
            const year_premium_data = [...arrData].sort((a, b) => b.prix_m2 - a.prix_m2).slice(0, Math.max(1, Math.floor(arrData.length * 0.1))).filter(row => row.date_mutation.startsWith(year.toString()));
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
        res.json({ trendSeries: trend_series });
    }
    catch (error) {
        console.error('❌ Erreur dans la route /trend-series:', error);
        res.status(500).json({ error: 'Erreur serveur', message: error instanceof Error ? error.message : error });
    }
});
// Nouvelle route pour la distribution des prix/m² (distributionSeries)
router.post('/distribution-series', async (req, res) => {
    var _a;
    try {
        const data = req.body;
        const lat = Number(data.latitude);
        const lng = Number(data.longitude);
        const rayon = Number(data.rayon);
        const prix_min = data.prixMin ? Number(data.prixMin) * 1000 : null;
        const surface_min = data.surfaceMin ? Number(data.surfaceMin) : null;
        const prix_m2_min = data.prixM2Min ? Number(data.PrixM2Min) * 1000 : null;
        const outlier_lower_bound_percent = Number(data.outlierLowerBoundPercent) / 100;
        const outlier_upper_bound_coeff = Number(data.outlierUpperBoundCoeff);
        // 1. Déterminer dynamiquement le code postal le plus proche
        let code_postal = data.code_postal;
        if (!code_postal) {
            const cpResult = await prisma.$queryRaw `
        SELECT code_postal
        FROM "DVF"
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        ORDER BY sqrt(power(latitude - ${lat}, 2) + power(longitude - ${lng}, 2))
        LIMIT 1;
      `;
            code_postal = ((_a = cpResult[0]) === null || _a === void 0 ? void 0 : _a.code_postal) || '';
        }
        if (!code_postal) {
            return res.status(404).json({ error: 'Aucun code postal trouvé à proximité.' });
        }
        // 2. Récupérer toutes les transactions brutes de l'arrondissement
        const rawRows = await prisma.$queryRaw `
      SELECT * FROM get_dvf_raw(
        ${lat}::float,
        ${lng}::float,
        ${rayon}::float,
        ${code_postal}::text,
        ${prix_min},
        ${surface_min},
        ${prix_m2_min}
      );
    `;
        if (!rawRows || rawRows.length === 0) {
            return res.status(404).json({ error: 'Aucune donnée DVF trouvée pour ce secteur.' });
        }
        // Nettoyage et bornes outliers
        for (const row of rawRows) {
            row.adresse_complete = [
                row.adresse_numero,
                row.adresse_nom_voie
            ].filter(Boolean).join(' ');
            row.code_postal = row.code_postal || '';
            row.nombre_pieces_principales = row.nombre_pieces_principales || null;
        }
        const dedupMap = new Map();
        for (const row of rawRows) {
            const key = `${row.adresse_nom_voie}|${row.adresse_numero}|${row.date_mutation}`;
            if (!dedupMap.has(key)) {
                dedupMap.set(key, row);
            }
        }
        const arrData = Array.from(dedupMap.values());
        let arr_sum_valeur = 0, arr_sum_surface = 0;
        for (const row of arrData) {
            if (row.valeur_fonciere && row.surface_reelle_bati && row.surface_reelle_bati > 0) {
                arr_sum_valeur += row.valeur_fonciere;
                arr_sum_surface += row.surface_reelle_bati;
            }
        }
        const arr_avg_for_outliers = arr_sum_surface > 0 ? arr_sum_valeur / arr_sum_surface : 0;
        const lower_bound_arr = arr_avg_for_outliers * outlier_lower_bound_percent;
        const upper_bound_arr = arr_avg_for_outliers * outlier_upper_bound_coeff;
        const geodesic = (lat1, lng1, lat2, lng2) => {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lng2 - lng1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };
        const selection_within_radius = arrData.filter(row => {
            const distance = geodesic(lat, lng, row.latitude, row.longitude);
            row.distance = distance;
            row.is_outlier = !(lower_bound_arr <= row.prix_m2 && row.prix_m2 <= upper_bound_arr);
            return distance <= rayon;
        });
        let filtered_data = selection_within_radius;
        if (prix_min)
            filtered_data = filtered_data.filter(row => row.valeur_fonciere >= prix_min);
        if (surface_min)
            filtered_data = filtered_data.filter(row => row.surface_reelle_bati >= surface_min);
        if (prix_m2_min)
            filtered_data = filtered_data.filter(row => row.prix_m2 >= prix_m2_min);
        const filtered_data_no_outliers = filtered_data.filter(row => !row.is_outlier);
        // Distribution des prix
        const prix_m2_values = filtered_data_no_outliers.map(row => row.prix_m2).filter(Boolean);
        let distribution_series = [];
        if (prix_m2_values.length) {
            const min_prix_m2 = Math.min(...prix_m2_values);
            const max_prix_m2 = Math.max(...prix_m2_values);
            const bin_size = (max_prix_m2 - min_prix_m2) / 5 || 1;
            const bins = Array.from({ length: 6 }, (_, i) => min_prix_m2 + i * bin_size);
            const distribution = Array(5).fill(0);
            for (const prix of prix_m2_values) {
                for (let i = 0; i < 5; i++) {
                    if (prix >= bins[i] && prix < bins[i + 1]) {
                        distribution[i]++;
                        break;
                    }
                }
            }
            distribution_series = distribution.map((count, i) => ({
                bin: `${Math.round(bins[i] / 1000)}k-${Math.round(bins[i + 1] / 1000)}k`,
                count
            }));
        }
        res.json({ distributionSeries: distribution_series });
    }
    catch (error) {
        console.error('❌ Erreur dans la route /distribution-series:', error);
        res.status(500).json({ error: 'Erreur serveur', message: error instanceof Error ? error.message : error });
    }
});
// Nouvelle route pour la dispersion prix/surface (scatterSeries)
router.post('/scatter-series', async (req, res) => {
    var _a;
    try {
        const data = req.body;
        const lat = Number(data.latitude);
        const lng = Number(data.longitude);
        const rayon = Number(data.rayon);
        const prix_min = data.prixMin ? Number(data.prixMin) * 1000 : null;
        const surface_min = data.surfaceMin ? Number(data.surfaceMin) : null;
        const prix_m2_min = data.prixM2Min ? Number(data.prixM2Min) * 1000 : null;
        const outlier_lower_bound_percent = Number(data.outlierLowerBoundPercent) / 100;
        const outlier_upper_bound_coeff = Number(data.outlierUpperBoundCoeff);
        // 1. Déterminer dynamiquement le code postal le plus proche
        let code_postal = data.code_postal;
        if (!code_postal) {
            const cpResult = await prisma.$queryRaw `
        SELECT code_postal
        FROM "DVF"
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        ORDER BY sqrt(power(latitude - ${lat}, 2) + power(longitude - ${lng}, 2))
        LIMIT 1;
      `;
            code_postal = ((_a = cpResult[0]) === null || _a === void 0 ? void 0 : _a.code_postal) || '';
        }
        if (!code_postal) {
            return res.status(404).json({ error: 'Aucun code postal trouvé à proximité.' });
        }
        // 2. Récupérer toutes les transactions brutes de l'arrondissement
        const rawRows = await prisma.$queryRaw `
      SELECT * FROM get_dvf_raw(
        ${lat}::float,
        ${lng}::float,
        ${rayon}::float,
        ${code_postal}::text,
        ${prix_min},
        ${surface_min},
        ${prix_m2_min}
      );
    `;
        if (!rawRows || rawRows.length === 0) {
            return res.status(404).json({ error: 'Aucune donnée DVF trouvée pour ce secteur.' });
        }
        // Nettoyage et bornes outliers
        for (const row of rawRows) {
            row.adresse_complete = [
                row.adresse_numero,
                row.adresse_nom_voie
            ].filter(Boolean).join(' ');
            row.code_postal = row.code_postal || '';
            row.nombre_pieces_principales = row.nombre_pieces_principales || null;
        }
        const dedupMap = new Map();
        for (const row of rawRows) {
            const key = `${row.adresse_nom_voie}|${row.adresse_numero}|${row.date_mutation}`;
            if (!dedupMap.has(key)) {
                dedupMap.set(key, row);
            }
        }
        const arrData = Array.from(dedupMap.values());
        let arr_sum_valeur = 0, arr_sum_surface = 0;
        for (const row of arrData) {
            if (row.valeur_fonciere && row.surface_reelle_bati && row.surface_reelle_bati > 0) {
                arr_sum_valeur += row.valeur_fonciere;
                arr_sum_surface += row.surface_reelle_bati;
            }
        }
        const arr_avg_for_outliers = arr_sum_surface > 0 ? arr_sum_valeur / arr_sum_surface : 0;
        const lower_bound_arr = arr_avg_for_outliers * outlier_lower_bound_percent;
        const upper_bound_arr = arr_avg_for_outliers * outlier_upper_bound_coeff;
        const geodesic = (lat1, lng1, lat2, lng2) => {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lng2 - lng1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };
        const selection_within_radius = arrData.filter(row => {
            const distance = geodesic(lat, lng, row.latitude, row.longitude);
            row.distance = distance;
            row.is_outlier = !(lower_bound_arr <= row.prix_m2 && row.prix_m2 <= upper_bound_arr);
            return distance <= rayon;
        });
        let filtered_data = selection_within_radius;
        if (prix_min)
            filtered_data = filtered_data.filter(row => row.valeur_fonciere >= prix_min);
        if (surface_min)
            filtered_data = filtered_data.filter(row => row.surface_reelle_bati >= surface_min);
        if (prix_m2_min)
            filtered_data = filtered_data.filter(row => row.prix_m2 >= prix_m2_min);
        const filtered_data_no_outliers = filtered_data.filter(row => !row.is_outlier);
        // Scatter plot (dispersion)
        const scatter_series = filtered_data_no_outliers.map(row => ({
            surface: row.surface_reelle_bati,
            prix: row.valeur_fonciere / 1000,
            prix_m2: row.prix_m2 / 1000,
            is_outlier: row.is_outlier
        }));
        res.json({ scatterSeries: scatter_series });
    }
    catch (error) {
        console.error('❌ Erreur dans la route /scatter-series:', error);
        res.status(500).json({ error: 'Erreur serveur', message: error instanceof Error ? error.message : error });
    }
});
exports.default = router;
