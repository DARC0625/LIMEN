#!/bin/bash
# LIMEN Restore Script
# Restores database and configuration from backup

set -e

if [ $# -lt 1 ]; then
    echo "Usage: $0 <backup_file.tar.gz>"
    echo "Example: $0 /home/darc0/LIMEN/backups/limen_backup_20250112_120000.tar.gz"
    exit 1
fi

BACKUP_FILE="$1"
RESTORE_DIR="/tmp/limen_restore_$$"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "Error: Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

echo "Starting LIMEN restore at $(date)"
echo "Backup file: ${BACKUP_FILE}"

# Extract backup
echo "Extracting backup..."
mkdir -p "${RESTORE_DIR}"
tar -xzf "${BACKUP_FILE}" -C "${RESTORE_DIR}"

BACKUP_NAME=$(basename "${BACKUP_FILE}" .tar.gz)
RESTORE_PATH="${RESTORE_DIR}/${BACKUP_NAME}"

if [ ! -d "${RESTORE_PATH}" ]; then
    echo "Error: Invalid backup format"
    exit 1
fi

# Load environment variables
if [ -f /home/darc0/LIMEN/backend/.env ]; then
    source /home/darc0/LIMEN/backend/.env
fi

# Restore database
if [ -f "${RESTORE_PATH}/database.sql" ] && [ -n "${DATABASE_URL}" ]; then
    echo "Restoring PostgreSQL database..."
    echo "WARNING: This will overwrite the current database!"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    if [ "${confirm}" != "yes" ]; then
        echo "Restore cancelled"
        rm -rf "${RESTORE_DIR}"
        exit 0
    fi
    
    psql "${DATABASE_URL}" < "${RESTORE_PATH}/database.sql" || {
        echo "Error: Database restore failed"
        rm -rf "${RESTORE_DIR}"
        exit 1
    }
    echo "Database restored successfully"
else
    echo "Warning: Database backup not found or DATABASE_URL not set, skipping database restore"
fi

# Restore configuration (optional, with confirmation)
if [ -f "${RESTORE_PATH}/.env" ]; then
    echo "Configuration file found in backup"
    read -p "Restore configuration files? (yes/no): " restore_config
    if [ "${restore_config}" == "yes" ]; then
        cp "${RESTORE_PATH}/.env" /home/darc0/LIMEN/backend/.env.restored
        echo "Configuration restored to .env.restored (review before using)"
    fi
fi

# Cleanup
rm -rf "${RESTORE_DIR}"

echo "Restore completed successfully at $(date)"
echo "NOTE: You may need to restart the backend service for changes to take effect"




