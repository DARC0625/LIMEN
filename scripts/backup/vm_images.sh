#!/bin/bash
# VM images and disks backup script for LIMEN
# Backs up VM images, ISO files, and disk images with encryption

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/limen/vm_images}"
SOURCE_DIR="${ISO_DIR:-/var/lib/libvirt/images}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
ENCRYPTION_KEY="${ENCRYPTION_KEY:-}"  # Set via environment variable
COMPRESS="${COMPRESS:-true}"

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

log "Starting VM images backup..."
log "Source directory: $SOURCE_DIR"
log "Backup directory: $BACKUP_DIR"

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    error "Source directory does not exist: $SOURCE_DIR"
    exit 1
fi

# Create a tarball of all VM images
BACKUP_TAR="${BACKUP_DIR}/vm_images_${TIMESTAMP}.tar"

log "Creating archive of VM images..."
if tar -cf "$BACKUP_TAR" -C "$SOURCE_DIR" .; then
    log "Archive created successfully"
else
    error "Failed to create archive"
    exit 1
fi

# Compress if enabled
if [ "$COMPRESS" = "true" ]; then
    log "Compressing archive..."
    if gzip -f "$BACKUP_TAR"; then
        BACKUP_FILE="${BACKUP_TAR}.gz"
        log "Compression completed"
    else
        error "Compression failed"
        exit 1
    fi
else
    BACKUP_FILE="$BACKUP_TAR"
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
find "$BACKUP_DIR" -name "vm_images_*.tar*" -type f -mtime +$RETENTION_DAYS -delete
log "Old backups cleaned up"

log "VM images backup completed successfully"






