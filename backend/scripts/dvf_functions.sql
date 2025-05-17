-- Fonction pour calculer la distance entre deux points
CREATE OR REPLACE FUNCTION calculate_distance(lat1 float, lon1 float, lat2 float, lon2 float) 
RETURNS float AS $$
DECLARE
    R float := 6371; -- Rayon de la Terre en km
    dlat float;
    dlon float;
    a float;
    c float;
BEGIN
    -- Conversion en radians
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);
    lat1 := radians(lat1);
    lat2 := radians(lat2);
    
    -- Formule de Haversine
    a := (sin(dlat/2))^2 + cos(lat1) * cos(lat2) * (sin(dlon/2))^2;
    c := 2 * asin(sqrt(a));
    RETURN R * c;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les statistiques de base
CREATE OR REPLACE FUNCTION get_dvf_base_stats(
    p_latitude float,
    p_longitude float,
    p_rayon float,
    p_outlier_lower_bound_percent float DEFAULT 65,
    p_outlier_upper_bound_coeff float DEFAULT 3
)
RETURNS TABLE (
    sel_final_avg float,
    arr_final_avg float,
    premium_final_avg float,
    outlier_lower_bound float,
    outlier_upper_bound float,
    arrondissement_avg_for_outliers float,
    properties jsonb
) AS $$
DECLARE
    v_code_postal text;
    v_outlier_lower_bound float;
    v_outlier_upper_bound float;
    v_arrondissement_avg float;
    v_properties jsonb;
BEGIN
    -- Récupérer le code postal le plus proche avec gestion des NULL
    SELECT d.code_postal INTO v_code_postal
    FROM "DVF" d
    WHERE d.latitude IS NOT NULL 
    AND d.longitude IS NOT NULL
    AND d.code_postal IS NOT NULL
    ORDER BY calculate_distance(d.latitude, d.longitude, p_latitude, p_longitude)
    LIMIT 1;

    -- Si aucun code postal trouvé, utiliser une valeur par défaut
    IF v_code_postal IS NULL THEN
        v_code_postal := '75000';
    END IF;

    -- Calculer la moyenne de l'arrondissement avec gestion des NULL
    SELECT COALESCE(AVG(d.prix_m2), 0) INTO v_arrondissement_avg
    FROM "DVF" d
    WHERE SUBSTRING(d.code_postal, 1, 2) = SUBSTRING(v_code_postal, 1, 2)
    AND d.prix_m2 IS NOT NULL
    AND d.prix_m2 > 0;

    -- Si aucune moyenne trouvée, utiliser une valeur par défaut
    IF v_arrondissement_avg = 0 THEN
        v_arrondissement_avg := 10000; -- Valeur par défaut raisonnable
    END IF;

    -- Calculer les bornes pour les outliers en utilisant les paramètres
    v_outlier_lower_bound := GREATEST(v_arrondissement_avg * (p_outlier_lower_bound_percent / 100), 1);
    v_outlier_upper_bound := v_arrondissement_avg * p_outlier_upper_bound_coeff;

    -- Récupérer les propriétés dans le rayon
    SELECT jsonb_agg(jsonb_build_object(
        'id', d.id,
        'date_mutation', d.date_mutation,
        'valeur_fonciere', d.valeur_fonciere,
        'surface_reelle_bati', d.surface_reelle_bati,
        'prix_m2', d.prix_m2,
        'code_postal', d.code_postal,
        'latitude', d.latitude,
        'longitude', d.longitude,
        'adresse_numero', d.adresse_numero,
        'adresse_nom_voie', d.adresse_nom_voie,
        'nom_commune', d.nom_commune,
        'adresse_complete',
          TRIM(
            COALESCE(d.adresse_numero || ' ', '') ||
            COALESCE(d.adresse_nom_voie || ' ', '') ||
            COALESCE(d.code_postal, '')
          )
    ))
    INTO v_properties
    FROM "DVF" d
    WHERE calculate_distance(d.latitude, d.longitude, p_latitude, p_longitude) <= p_rayon
    AND d.prix_m2 >= v_outlier_lower_bound
    AND d.prix_m2 <= v_outlier_upper_bound
    AND d.surface_reelle_bati > 0
    AND d.prix_m2 > 0;

    RETURN QUERY
    WITH selection_properties AS (
        SELECT d.*
        FROM "DVF" d
        WHERE calculate_distance(d.latitude, d.longitude, p_latitude, p_longitude) <= p_rayon
        AND d.prix_m2 >= v_outlier_lower_bound
        AND d.prix_m2 <= v_outlier_upper_bound
        AND d.surface_reelle_bati > 0
        AND d.prix_m2 > 0
    ),
    arrondissement_properties AS (
        SELECT d.*
        FROM "DVF" d
        WHERE SUBSTRING(d.code_postal, 1, 2) = SUBSTRING(v_code_postal, 1, 2)
        AND d.prix_m2 >= v_outlier_lower_bound
        AND d.prix_m2 <= v_outlier_upper_bound
        AND d.surface_reelle_bati > 0
        AND d.prix_m2 > 0
    ),
    premium_properties AS (
        SELECT ap.*
        FROM arrondissement_properties ap
        WHERE ap.prix_m2 >= (
            SELECT COALESCE(percentile_cont(0.9) WITHIN GROUP (ORDER BY ap2.prix_m2), v_arrondissement_avg)
            FROM arrondissement_properties ap2
        )
    )
    SELECT 
        COALESCE((SELECT AVG(prix_m2) FROM selection_properties), 0),
        COALESCE((SELECT AVG(prix_m2) FROM arrondissement_properties), 0),
        COALESCE((SELECT AVG(prix_m2) FROM premium_properties), 0),
        v_outlier_lower_bound,
        v_outlier_upper_bound,
        v_arrondissement_avg,
        COALESCE(v_properties, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les statistiques annuelles
CREATE OR REPLACE FUNCTION get_dvf_yearly_stats(
    p_latitude float,
    p_longitude float,
    p_rayon float,
    p_outlier_lower_bound_percent float DEFAULT 65,
    p_outlier_upper_bound_coeff float DEFAULT 3
)
RETURNS TABLE (
    year int,
    selection_avg float,
    selection_count int,
    arrondissement_avg float,
    arrondissement_count int,
    premium_avg float,
    premium_count int
) AS $$
DECLARE
    v_code_postal text;
    v_outlier_lower_bound float;
    v_outlier_upper_bound float;
    v_arrondissement_avg float;
BEGIN
    -- Récupérer le code postal le plus proche
    SELECT d.code_postal INTO v_code_postal
    FROM "DVF" d
    WHERE d.latitude IS NOT NULL 
    AND d.longitude IS NOT NULL
    AND d.code_postal IS NOT NULL
    ORDER BY calculate_distance(d.latitude, d.longitude, p_latitude, p_longitude)
    LIMIT 1;

    -- Calculer la moyenne de l'arrondissement et les bornes pour les outliers
    SELECT COALESCE(AVG(d.prix_m2), 0) INTO v_arrondissement_avg
    FROM "DVF" d
    WHERE SUBSTRING(d.code_postal, 1, 2) = SUBSTRING(v_code_postal, 1, 2)
    AND d.prix_m2 > 0;

    -- Calculer les bornes pour les outliers en utilisant les paramètres
    v_outlier_lower_bound := GREATEST(v_arrondissement_avg * (p_outlier_lower_bound_percent / 100), 1);
    v_outlier_upper_bound := v_arrondissement_avg * p_outlier_upper_bound_coeff;

    -- Si aucune moyenne trouvée, utiliser des valeurs par défaut raisonnables
    IF v_outlier_lower_bound = 0 THEN
        v_outlier_lower_bound := 1000;
        v_outlier_upper_bound := 30000;
    END IF;

    RETURN QUERY
    WITH years AS (
        SELECT generate_series(2019, 2024) as year
    ),
    filtered_dvf AS (
        SELECT 
            d.id,
            EXTRACT(YEAR FROM TO_DATE(d.date_mutation, 'YYYY-MM-DD'))::int as year,
            d.prix_m2,
            calculate_distance(d.latitude, d.longitude, p_latitude, p_longitude) <= p_rayon as in_selection,
            SUBSTRING(d.code_postal, 1, 2) = SUBSTRING(v_code_postal, 1, 2) as in_arrondissement
        FROM "DVF" d
        WHERE d.prix_m2 BETWEEN v_outlier_lower_bound AND v_outlier_upper_bound
        AND d.prix_m2 > 0
        AND EXTRACT(YEAR FROM TO_DATE(d.date_mutation, 'YYYY-MM-DD'))::int BETWEEN 2019 AND 2024
    ),
    yearly_percentiles AS (
        SELECT 
            f.year,
            COALESCE(
                percentile_cont(0.9) WITHIN GROUP (
                    ORDER BY CASE WHEN f.in_arrondissement THEN f.prix_m2 END
                ),
                0
            ) as percentile_90
        FROM filtered_dvf f
        GROUP BY f.year
    )
    SELECT 
        y.year,
        COALESCE(AVG(CASE WHEN f.in_selection THEN f.prix_m2 END), 0)::float as selection_avg,
        COUNT(DISTINCT CASE WHEN f.in_selection THEN f.id END)::int as selection_count,
        COALESCE(AVG(CASE WHEN f.in_arrondissement THEN f.prix_m2 END), 0)::float as arrondissement_avg,
        COUNT(DISTINCT CASE WHEN f.in_arrondissement THEN f.id END)::int as arrondissement_count,
        COALESCE(AVG(CASE WHEN f.in_arrondissement AND f.prix_m2 >= p.percentile_90 THEN f.prix_m2 END), 0)::float as premium_avg,
        COUNT(DISTINCT CASE WHEN f.in_arrondissement AND f.prix_m2 >= p.percentile_90 THEN f.id END)::int as premium_count
    FROM years y
    LEFT JOIN filtered_dvf f ON f.year = y.year
    LEFT JOIN yearly_percentiles p ON p.year = y.year
    GROUP BY y.year
    ORDER BY y.year;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les propriétés détaillées
CREATE OR REPLACE FUNCTION get_dvf_properties(
    p_latitude float,
    p_longitude float,
    p_rayon float,
    p_outlier_lower_bound_percent float DEFAULT 65,
    p_outlier_upper_bound_coeff float DEFAULT 3
)
RETURNS TABLE (
    id text,
    date_mutation text,
    valeur_fonciere float,
    adresse_numero text,
    adresse_nom_voie text,
    code_postal text,
    nombre_pieces_principales int,
    surface_reelle_bati float,
    prix_m2 float,
    latitude float,
    longitude float,
    is_outlier boolean,
    transaction_year int
) AS $$
DECLARE
    v_code_postal text;
    v_outlier_lower_bound float;
    v_outlier_upper_bound float;
    v_arrondissement_avg float;
BEGIN
    -- Récupérer le code postal le plus proche
    SELECT d.code_postal INTO v_code_postal
    FROM "DVF" d
    WHERE d.latitude IS NOT NULL AND d.longitude IS NOT NULL
    ORDER BY calculate_distance(d.latitude, d.longitude, p_latitude, p_longitude)
    LIMIT 1;

    -- Calculer la moyenne de l'arrondissement
    SELECT COALESCE(AVG(d.prix_m2), 0) INTO v_arrondissement_avg
    FROM "DVF" d
    WHERE SUBSTRING(d.code_postal, 1, 2) = SUBSTRING(v_code_postal, 1, 2)
    AND d.prix_m2 > 0;

    -- Calculer les bornes pour les outliers en utilisant les paramètres
    v_outlier_lower_bound := GREATEST(v_arrondissement_avg * (p_outlier_lower_bound_percent / 100), 1);
    v_outlier_upper_bound := v_arrondissement_avg * p_outlier_upper_bound_coeff;

    RETURN QUERY
    SELECT 
        d.id::text,
        d.date_mutation,
        d.valeur_fonciere,
        d.adresse_numero,
        d.adresse_nom_voie,
        d.code_postal,
        d.nombre_pieces_principales,
        d.surface_reelle_bati,
        d.prix_m2,
        d.latitude,
        d.longitude,
        d.prix_m2 < v_outlier_lower_bound OR d.prix_m2 > v_outlier_upper_bound as is_outlier,
        EXTRACT(YEAR FROM TO_DATE(d.date_mutation, 'YYYY-MM-DD'))::int as transaction_year
    FROM "DVF" d
    WHERE calculate_distance(d.latitude, d.longitude, p_latitude, p_longitude) <= p_rayon;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les transactions brutes (pour traitement en backend)
CREATE OR REPLACE FUNCTION get_dvf_raw(
    p_latitude float,
    p_longitude float,
    p_rayon float,
    p_code_postal text,
    p_prix_min float DEFAULT NULL,
    p_surface_min float DEFAULT NULL,
    p_prix_m2_min float DEFAULT NULL
)
RETURNS TABLE (
    id int,
    primary_key text,
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
    nombre_lots int,
    type_local text,
    surface_reelle_bati float,
    nombre_pieces_principales int,
    surface_terrain float,
    longitude float,
    latitude float,
    prix_m2 float
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.primary_key,
        d.id_mutation,
        d.date_mutation,
        d.nature_mutation,
        d.valeur_fonciere,
        d.adresse_numero,
        d.adresse_nom_voie,
        d.code_postal,
        d.nom_commune,
        d.id_parcelle,
        d.lot1_numero,
        d.lot2_numero,
        d.lot3_numero,
        d.nombre_lots,
        d.type_local,
        d.surface_reelle_bati,
        d.nombre_pieces_principales,
        d.surface_terrain,
        d.longitude,
        d.latitude,
        d.prix_m2
    FROM "DVF" d
    WHERE d.nature_mutation = 'Vente'
      AND d.latitude IS NOT NULL
      AND d.longitude IS NOT NULL
      AND d.code_postal = p_code_postal
      AND (p_prix_min IS NULL OR d.valeur_fonciere >= p_prix_min)
      AND (p_surface_min IS NULL OR d.surface_reelle_bati >= p_surface_min)
      AND (p_prix_m2_min IS NULL OR d.prix_m2 >= p_prix_m2_min);
END;
$$ LANGUAGE plpgsql; 