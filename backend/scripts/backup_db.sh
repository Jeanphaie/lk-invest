#!/bin/bash

# Définir les variables de connexion
DB_HOST="163.172.32.45"
DB_PORT="5432"
DB_USER="postgres"
DB_PASSWORD="new_secure_password_2025"
DB_NAME="lki_db"

# Créer le dossier de sauvegarde s'il n'existe pas
mkdir -p backups

# Créer le nom du fichier de sauvegarde avec timestamp
BACKUP_FILE="backups/backup_lki_db_$(date +%Y%m%d_%H%M%S).sql"

echo "Début de la sauvegarde..."

# Exécuter la sauvegarde
PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME > "$BACKUP_FILE"

# Vérifier si la sauvegarde a réussi
if [ $? -eq 0 ]; then
    echo "Sauvegarde réussie dans $BACKUP_FILE"
    # Compresser la sauvegarde
    gzip "$BACKUP_FILE"
    echo "Sauvegarde compressée dans ${BACKUP_FILE}.gz"
    
    # Afficher la taille du fichier
    ls -lh "${BACKUP_FILE}.gz"
else
    echo "Erreur lors de la sauvegarde"
    exit 1
fi 