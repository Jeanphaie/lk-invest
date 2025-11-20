-- Script d'import des données DVF
-- Création d'une table temporaire pour l'import
CREATE TEMP TABLE dvf_import (
    id_mutation text,
    date_mutation text,
    numero_disposition text,
    nature_mutation text,
    valeur_fonciere text,
    adresse_numero text,
    adresse_suffixe text,
    adresse_nom_voie text,
    adresse_code_voie text,
    code_postal text,
    code_commune text,
    nom_commune text,
    code_departement text,
    ancien_code_commune text,
    ancien_nom_commune text,
    id_parcelle text,
    ancien_id_parcelle text,
    numero_volume text,
    lot1_numero text,
    lot1_surface_carrez text,
    lot2_numero text,
    lot2_surface_carrez text,
    lot3_numero text,
    lot3_surface_carrez text,
    lot4_numero text,
    lot4_surface_carrez text,
    lot5_numero text,
    lot5_surface_carrez text,
    nombre_lots text,
    code_type_local text,
    type_local text,
    surface_reelle_bati text,
    nombre_pieces_principales text,
    code_nature_culture text,
    nature_culture text,
    code_nature_culture_speciale text,
    nature_culture_speciale text,
    surface_terrain text,
    longitude text,
    latitude text
);

-- Import des données
\copy dvf_import FROM '/data/lki/uploads/dvf_data/dvf_data_2019_new.csv' WITH (FORMAT csv, HEADER true);
\copy dvf_import FROM '/data/lki/uploads/dvf_data/dvf_data_2020_new.csv' WITH (FORMAT csv, HEADER true);
\copy dvf_import FROM '/data/lki/uploads/dvf_data/dvf_data_2021_new.csv' WITH (FORMAT csv, HEADER true);
\copy dvf_import FROM '/data/lki/uploads/dvf_data/dvf_data_2022_new.csv' WITH (FORMAT csv, HEADER true);
\copy dvf_import FROM '/data/lki/uploads/dvf_data/dvf_data_2023_new.csv' WITH (FORMAT csv, HEADER true);
\copy dvf_import FROM '/data/lki/uploads/dvf_data/dvf_data_2024_new.csv' WITH (FORMAT csv, HEADER true);
\copy dvf_import FROM '/data/lki/uploads/dvf_data/dvf_data_2025_new.csv' WITH (FORMAT csv, HEADER true);

-- Création d'une table temporaire pour dédupliquer les mutations
CREATE TEMP TABLE dvf_deduplicated AS
WITH ranked_mutations AS (
    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY id_mutation, numero_disposition ORDER BY 
               CASE WHEN nature_culture = 'sols' THEN 1
                    WHEN nature_culture IS NULL THEN 2
                    ELSE 3 END,
               surface_terrain DESC) as rn
    FROM dvf_import
    WHERE 
        -- Filtrer les valeurs foncières non nulles
        valeur_fonciere IS NOT NULL 
        AND valeur_fonciere != ''
        AND valeur_fonciere != '0'
        -- Garder uniquement les maisons et appartements
        AND type_local IN ('Maison', 'Appartement')
)
SELECT * FROM ranked_mutations WHERE rn = 1;

-- Création de la table DVF si elle n'existe pas déjà (conservation des données existantes)
CREATE TABLE IF NOT EXISTS "DVF" (
    id SERIAL PRIMARY KEY,
    primary_key text UNIQUE,
    id_mutation text,
    date_mutation text,
    nature_mutation text,
    valeur_fonciere float,
    adresse_numero text,
    adresse_nom_voie text,
    code_postal text,
    nom_commune text,
    id_parcelle text,
    lot1_numero text,
    lot2_numero text,
    lot3_numero text,
    nombre_lots integer,
    type_local text,
    surface_reelle_bati float,
    nombre_pieces_principales integer,
    surface_terrain float,
    longitude float,
    latitude float,
    prix_m2 float,
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Création des index (si absents)
CREATE INDEX IF NOT EXISTS "DVF_code_postal_idx" ON "DVF"(code_postal);
CREATE INDEX IF NOT EXISTS "DVF_latitude_longitude_idx" ON "DVF"(latitude, longitude);
CREATE INDEX IF NOT EXISTS "DVF_date_mutation_idx" ON "DVF"(date_mutation);

-- Insertion dans la table finale avec les transformations nécessaires
INSERT INTO "DVF" (
    primary_key,
    id_mutation,
    date_mutation,
    nature_mutation,
    valeur_fonciere,
    adresse_numero,
    adresse_nom_voie,
    code_postal,
    nom_commune,
    id_parcelle,
    lot1_numero,
    lot2_numero,
    lot3_numero,
    nombre_lots,
    type_local,
    surface_reelle_bati,
    nombre_pieces_principales,
    surface_terrain,
    longitude,
    latitude,
    prix_m2
)
SELECT 
    id_mutation || '-' || COALESCE(numero_disposition, '0') as primary_key,
    id_mutation,
    date_mutation,
    nature_mutation,
    NULLIF(valeur_fonciere, '')::float,
    adresse_numero,
    adresse_nom_voie,
    code_postal,
    nom_commune,
    id_parcelle,
    lot1_numero,
    lot2_numero,
    lot3_numero,
    NULLIF(nombre_lots, '')::integer,
    type_local,
    NULLIF(surface_reelle_bati, '')::float,
    NULLIF(nombre_pieces_principales, '')::integer,
    NULLIF(surface_terrain, '')::float,
    NULLIF(longitude, '')::float,
    NULLIF(latitude, '')::float,
    CASE 
        WHEN NULLIF(valeur_fonciere, '')::float IS NOT NULL 
        AND NULLIF(surface_reelle_bati, '')::float > 0 
        THEN NULLIF(valeur_fonciere, '')::float / NULLIF(surface_reelle_bati, '')::float 
        ELSE NULL 
    END as prix_m2
FROM dvf_deduplicated
ON CONFLICT (primary_key)
DO UPDATE SET
    id_mutation = EXCLUDED.id_mutation,
    date_mutation = EXCLUDED.date_mutation,
    nature_mutation = EXCLUDED.nature_mutation,
    valeur_fonciere = EXCLUDED.valeur_fonciere,
    adresse_numero = EXCLUDED.adresse_numero,
    adresse_nom_voie = EXCLUDED.adresse_nom_voie,
    code_postal = EXCLUDED.code_postal,
    nom_commune = EXCLUDED.nom_commune,
    id_parcelle = EXCLUDED.id_parcelle,
    lot1_numero = EXCLUDED.lot1_numero,
    lot2_numero = EXCLUDED.lot2_numero,
    lot3_numero = EXCLUDED.lot3_numero,
    nombre_lots = EXCLUDED.nombre_lots,
    type_local = EXCLUDED.type_local,
    surface_reelle_bati = EXCLUDED.surface_reelle_bati,
    nombre_pieces_principales = EXCLUDED.nombre_pieces_principales,
    surface_terrain = EXCLUDED.surface_terrain,
    longitude = EXCLUDED.longitude,
    latitude = EXCLUDED.latitude,
    prix_m2 = EXCLUDED.prix_m2,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE
    "DVF".id_mutation IS DISTINCT FROM EXCLUDED.id_mutation OR
    "DVF".date_mutation IS DISTINCT FROM EXCLUDED.date_mutation OR
    "DVF".nature_mutation IS DISTINCT FROM EXCLUDED.nature_mutation OR
    "DVF".valeur_fonciere IS DISTINCT FROM EXCLUDED.valeur_fonciere OR
    "DVF".adresse_numero IS DISTINCT FROM EXCLUDED.adresse_numero OR
    "DVF".adresse_nom_voie IS DISTINCT FROM EXCLUDED.adresse_nom_voie OR
    "DVF".code_postal IS DISTINCT FROM EXCLUDED.code_postal OR
    "DVF".nom_commune IS DISTINCT FROM EXCLUDED.nom_commune OR
    "DVF".id_parcelle IS DISTINCT FROM EXCLUDED.id_parcelle OR
    "DVF".lot1_numero IS DISTINCT FROM EXCLUDED.lot1_numero OR
    "DVF".lot2_numero IS DISTINCT FROM EXCLUDED.lot2_numero OR
    "DVF".lot3_numero IS DISTINCT FROM EXCLUDED.lot3_numero OR
    "DVF".nombre_lots IS DISTINCT FROM EXCLUDED.nombre_lots OR
    "DVF".type_local IS DISTINCT FROM EXCLUDED.type_local OR
    "DVF".surface_reelle_bati IS DISTINCT FROM EXCLUDED.surface_reelle_bati OR
    "DVF".nombre_pieces_principales IS DISTINCT FROM EXCLUDED.nombre_pieces_principales OR
    "DVF".surface_terrain IS DISTINCT FROM EXCLUDED.surface_terrain OR
    "DVF".longitude IS DISTINCT FROM EXCLUDED.longitude OR
    "DVF".latitude IS DISTINCT FROM EXCLUDED.latitude OR
    "DVF".prix_m2 IS DISTINCT FROM EXCLUDED.prix_m2;

-- Nettoyage
DROP TABLE dvf_import;
DROP TABLE dvf_deduplicated;

-- Afficher le nombre total d'enregistrements importés
SELECT COUNT(*) as total_records FROM "DVF"; 