import os
import json
import psycopg2
from psycopg2.extras import Json

# Variables de connexion
PGUSER = "postgres"
PGHOST = "163.172.32.45"
PGDATABASE = "lki_db"
EXPORT_DIR = "/data/lki/backup_json_20250516_111505"  # Dossier de backup actuel

TABLES = [
    ("Project", "project_id"),
    ("DvfTransaction", "id"),
    ("DvfSeries", "id"),
    ("DvfDistribution", "id"),
    ("dvfPremiumTransaction", "id"),
]

# Liste des champs JSONB par table
JSONB_FIELDS = {
    "Project": [
        "inputs_general",
        "inputs_description_bien",
        "results_description_bien",
        "inputs_renovation_bien",
        "results_renovation_bien",
        "inputs_dvf",
        "results_dvf_metadata",
        "inputs_business_plan",
        "results_business_plan",
        "photos",
        "pdf_config"
    ],
    "DvfTransaction": ["data"],
    "DvfSeries": ["data"],
    "DvfDistribution": ["data"],
    "dvfPremiumTransaction": ["data"]
}

conn = psycopg2.connect(
    host="163.172.32.45",
    database="lki_db",
    user="postgres",
    password="new_secure_password_2025"
)
cur = conn.cursor()

for table, pk in TABLES:
    json_path = os.path.join(EXPORT_DIR, f"{table}.json")
    if not os.path.exists(json_path):
        print(f"Fichier {json_path} non trouvé, on saute.")
        continue

    print(f"Import de {json_path} dans {table}...")
    with open(json_path, "r") as f:
        for line in f:
            obj = json.loads(line)
            columns = list(obj.keys())
            # Convertir les champs JSONB en Json
            values = []
            for col in columns:
                if col in JSONB_FIELDS.get(table, []):
                    values.append(Json(obj[col]))
                else:
                    values.append(obj[col])
            
            placeholders = ','.join(['%s'] * len(values))
            colnames = ','.join([f'"{col}"' for col in columns])
            sql = f'INSERT INTO "{table}" ({colnames}) VALUES ({placeholders})'
            cur.execute(sql, values)
    conn.commit()
    print(f"Import de {table} terminé.")

cur.close()
conn.close()
print("Importation terminée.")
