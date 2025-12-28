#!/bin/bash
# Database backup script for LIMEN
# Backs up PostgreSQL database with encryption and compression

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/limen/database}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_NAME="${DB_NAME:-limen}"
DB_USER="${DB_USER:-limen}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
ENCRYPTION_KEY="${ENCRYPTION_KEY:-}"  # Set via environment variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +'%Y%m%d_%H%M%S')
BACKUP_FILE="${BACKUP_DIR}/limen_db_${TIMESTAMP}.sql.gz"

# Check if encryption key is provided
if [ -z "$ENCRYPTION_KEY" ]; then
    warn "ENCRYPTION_KEY not set. Backup will not be encrypted."
    ENCRYPTED_BACKUP_FILE="${BACKUP_FILE}"
else
    ENCRYPTED_BACKUP_FILE="${BACKUP_FILE}.enc"
fi

log "Starting database backup..."
log "Database: $DB_NAME"
log "Host: $DB_HOST:$DB_PORT"
log "Backup file: $BACKUP_FILE"

# Perform database backup
if PGPASSWORD="${DB_PASSWORD:-}" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --no-owner --no-acl --clean --if-exists \
    | gzip > "$BACKUP_FILE"; then
    log "Database backup completed successfully"
else
    error "Database backup failed"
    exit 1
fi

# Encrypt backup if encryption key is provided
if [ -n "$ENCRYPTION_KEY" ]; then
    log "Encrypting backup..."
    if echo "$ENCRYPTION_KEY" | openssl enc -aes-256-cbc -salt -pbkdf2 -in "$BACKUP_FILE" -out "$ENCRYPTED_BACKUP_FILE" -pass stdin; then
        log "Backup encrypted successfully"
        rm -f "$BACKUP_FILE"  # Remove unencrypted backup
        BACKUP_FILE="$ENCRYPTED_BACKUP_FILE"
    else
        error "Backup encryption failed"
        exit 1
    fi
fi

# Verify backup file exists and has content
if [ ! -f "$BACKUP_FILE" ] || [ ! -s "$BACKUP_FILE" ]; then
    error "Backup file is missing or empty"
    exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log "Backup size: $BACKUP_SIZE"
log "Backup file: $BACKUP_FILE"

# Clean up old backups
log "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "limen_db_*.sql.gz*" -type f -mtime +$RETENTION_DAYS -delete
log "Old backups cleaned up"

log "Database backup completed successfully"









