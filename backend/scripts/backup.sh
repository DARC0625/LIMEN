#!/bin/bash
# LIMEN Backup Script
# Backs up database, configuration, and metadata

set -e

BACKUP_DIR="${BACKUP_DIR:-/home/darc0/LIMEN/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="limen_backup_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

# Create backup directory
mkdir -p "${BACKUP_PATH}"

echo "Starting LIMEN backup at $(date)"
echo "Backup directory: ${BACKUP_PATH}"

# Load environment variables
if [ -f /home/darc0/LIMEN/backend/.env ]; then
    source /home/darc0/LIMEN/backend/.env
fi

# Backup PostgreSQL database
if [ -n "${DATABASE_URL}" ]; then
    echo "Backing up PostgreSQL database..."
    pg_dump "${DATABASE_URL}" > "${BACKUP_PATH}/database.sql" 2>&1 || {
        echo "Warning: Database backup failed, continuing..."
    }
else
    echo "Warning: DATABASE_URL not set, skipping database backup"
fi

# Backup configuration files
echo "Backing up configuration files..."
cp -r /home/darc0/LIMEN/backend/.env "${BACKUP_PATH}/.env" 2>/dev/null || true
cp -r /home/darc0/LIMEN/backend/config.yaml "${BACKUP_PATH}/config.yaml" 2>/dev/null || true

# Backup metadata (VM images, snapshots metadata)
echo "Backing up metadata..."
mkdir -p "${BACKUP_PATH}/metadata"
# Export VM list and metadata
if command -v psql &> /dev/null && [ -n "${DATABASE_URL}" ]; then
    psql "${DATABASE_URL}" -c "\COPY (SELECT * FROM vms) TO '${BACKUP_PATH}/metadata/vms.csv' CSV HEADER" 2>/dev/null || true
    psql "${DATABASE_URL}" -c "\COPY (SELECT * FROM users) TO '${BACKUP_PATH}/metadata/users.csv' CSV HEADER" 2>/dev/null || true
    psql "${DATABASE_URL}" -c "\COPY (SELECT * FROM vm_snapshots) TO '${BACKUP_PATH}/metadata/vm_snapshots.csv' CSV HEADER" 2>/dev/null || true
    psql "${DATABASE_URL}" -c "\COPY (SELECT * FROM audit_logs) TO '${BACKUP_PATH}/metadata/audit_logs.csv' CSV HEADER" 2>/dev/null || true
fi

# Create backup manifest
cat > "${BACKUP_PATH}/manifest.txt" <<EOF
LIMEN Backup Manifest
=====================
Backup Date: $(date)
Backup Name: ${BACKUP_NAME}
Backup Path: ${BACKUP_PATH}

Contents:
- database.sql: PostgreSQL database dump
- .env: Environment configuration
- config.yaml: Application configuration
- metadata/: CSV exports of key tables

Database URL: ${DATABASE_URL:-Not set}
EOF

# Create compressed archive
echo "Creating compressed archive..."
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"
rm -rf "${BACKUP_PATH}"

echo "Backup completed: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo "Backup size: $(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)"

# Cleanup old backups (keep last 7 days)
find "${BACKUP_DIR}" -name "limen_backup_*.tar.gz" -mtime +7 -delete 2>/dev/null || true

echo "Backup completed successfully at $(date)"






