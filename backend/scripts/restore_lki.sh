#!/bin/bash

# Date du jour pour le dossier de restauration
TODAY=$(date +%Y%m%d)
RESTORE_DIR="/home/jeanphaie/restore/$TODAY"
BACKUP_DIR="/home/jeanphaie/backup"

# Trouver le dernier fichier d'archive
echo "Recherche du dernier backup dans $BACKUP_DIR..."
ARCHIVE=$(ls -t $BACKUP_DIR/backup_lki_*.tar.gz | head -n 1)

if [ ! -f "$ARCHIVE" ]; then
  echo "Aucune archive trouvée dans $BACKUP_DIR"
  exit 1
fi

echo "Archive à restaurer : $ARCHIVE"
echo "Dossier de restauration : $RESTORE_DIR"

# Création du dossier de restauration
mkdir -p "$RESTORE_DIR"

# Extraction de l'archive
tar xzvf "$ARCHIVE" -C "$RESTORE_DIR"

# Recherche du dump SQL
DUMP_FILE=$(find "$RESTORE_DIR" -name "lki_db_*.sql" | head -n 1)

if [ ! -f "$DUMP_FILE" ]; then
  echo "Aucun dump SQL trouvé dans l'archive."
  exit 2
fi

echo "Dump SQL trouvé : $DUMP_FILE"

# Demande le nom de la base de test
echo -n "Nom de la base de destination pour la restauration (ex: lki_db_test) : "
read DBNAME

# Restauration de la base
echo "Création de la base si besoin..."
createdb -U postgres -h 163.172.32.45 -p 5432 "$DBNAME" 2>/dev/null

echo "Restauration du dump dans la base $DBNAME..."
psql -U postgres -h 163.172.32.45 -p 5432 "$DBNAME" < "$DUMP_FILE"

echo "Restauration terminée."
echo "Les fichiers sont dans : $RESTORE_DIR" 