#!/bin/bash
# Configuration files backup script for LIMEN
# Backs up configuration files, environment variables, and certificates

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/limen/config}"
CONFIG_DIR="${CONFIG_DIR:-/home/darc0/projects/LIMEN}"
RETENTION_DAYS="${RETENTION_DAYS:-90}"  # Keep config backups longer
ENCRYPTION_KEY="${ENCRYPTION_KEY:-}"  # Set via environment variable

# Files and directories to backup
BACKUP_ITEMS=(
    "backend/.env"
    "backend/env.example"
    "backend/internal/config"
    ".server-spec.json"
    "scripts"
    "docs"
)

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
BACKUP_TAR="${BACKUP_DIR}/config_${TIMESTAMP}.tar"

log "Starting configuration backup..."
log "Source directory: $CONFIG_DIR"
log "Backup directory: $BACKUP_DIR"

# Check if source directory exists
if [ ! -d "$CONFIG_DIR" ]; then
    error "Source directory does not exist: $CONFIG_DIR"
    exit 1
fi

# Create archive of configuration files
log "Creating archive of configuration files..."
cd "$CONFIG_DIR"

# Build tar command with items that exist
TAR_ITEMS=()
for item in "${BACKUP_ITEMS[@]}"; do
    if [ -e "$item" ]; then
        TAR_ITEMS+=("$item")
    else
        warn "Item not found, skipping: $item"
    fi
done

if [ ${#TAR_ITEMS[@]} -eq 0 ]; then
    error "No configuration files found to backup"
    exit 1
fi

if tar -cf "$BACKUP_TAR" "${TAR_ITEMS[@]}"; then
    log "Archive created successfully"
else
    error "Failed to create archive"
    exit 1
fi

# Compress archive
log "Compressing archive..."
if gzip -f "$BACKUP_TAR"; then
    BACKUP_FILE="${BACKUP_TAR}.gz"
    log "Compression completed"
else
    error "Compression failed"
    exit 1
fi

# Encrypt backup if encryption key is provided
if [ -n "$ENCRYPTION_KEY" ]; then
    log "Encrypting backup..."
    ENCRYPTED_BACKUP_FILE="${BACKUP_FILE}.enc"
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
find "$BACKUP_DIR" -name "config_*.tar.gz*" -type f -mtime +$RETENTION_DAYS -delete
log "Old backups cleaned up"

log "Configuration backup completed successfully"









