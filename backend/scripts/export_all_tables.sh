#!/bin/bash

# Variables de connexion
PGUSER="postgres"
PGHOST="163.172.32.45"
PGDATABASE="lki_db"
EXPORT_DIR="/data/lki/backup_json_$(date +%Y%m%d_%H%M%S)"

mkdir -p "$EXPORT_DIR"

# Liste des tables à exporter (ajoute ici toutes les tables importantes)
TABLES=("Project" "DvfTransaction" "DvfSeries" "DvfDistribution")

for TABLE in "${TABLES[@]}"; do
  echo "Export de $TABLE..."
  psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -c "COPY (SELECT row_to_json(t) FROM \"$TABLE\" t) TO STDOUT;" > "$EXPORT_DIR/${TABLE}.json"
done

echo "Export terminé dans $EXPORT_DIR"
