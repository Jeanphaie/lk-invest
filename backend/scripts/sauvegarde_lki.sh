#!/bin/bash

# Chemin vers le .env
ENV_FILE="/data/lki/backend/.env"

# Extraction des infos de connexion à la BDD depuis le .env
eval $(grep DATABASE_URL $ENV_FILE | sed -E "s/DATABASE_URL=\"postgres:\/\/([^:]+):([^@]+)@([^:]+):([0-9]+)\/(.*)\"/export PGUSER='\1'; export PGPASSWORD='\2'; export PGHOST='\3'; export PGPORT='\4'; export PGDATABASE='\5'/")

# Création du dossier de backup si besoin
BACKUP_DIR="/home/jeanphaie/backup"
mkdir -p "$BACKUP_DIR"

# Sauvegarde de la base de données (en excluant la table DVF principale)
DUMP_FILE="$BACKUP_DIR/lki_db_$(date +%Y%m%d_%H%M%S).sql"
pg_dump -U "$PGUSER" -h "$PGHOST" -p "$PGPORT" "$PGDATABASE" \
  --exclude-table-data=DVF \
  > "$DUMP_FILE"

# Sauvegarde du dossier /data/lki (avec le dump inclus)
ARCHIVE_FILE="$BACKUP_DIR/backup_lki_$(date +%Y%m%d_%H%M%S).tar.gz"
tar czvf "$ARCHIVE_FILE" /data/lki "$DUMP_FILE"

# Suppression du dump SQL après archivage
rm "$DUMP_FILE"

echo "Sauvegarde terminée : $ARCHIVE_FILE" 