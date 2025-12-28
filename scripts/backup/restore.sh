#!/bin/bash
# Restore script for LIMEN backups
# Restores database, VM images, or configuration from backup files

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Show usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS] <backup_file>

Restore LIMEN backup files.

OPTIONS:
    -t, --type TYPE       Backup type: database, vm_images, or config
    -d, --decrypt KEY     Decryption key for encrypted backups
    -h, --help            Show this help message

EXAMPLES:
    # Restore database backup
    $0 -t database /var/backups/limen/database/limen_db_20241223_120000.sql.gz

    # Restore encrypted database backup
    $0 -t database -d "encryption_key" /var/backups/limen/database/limen_db_20241223_120000.sql.gz.enc

    # Restore VM images backup
    $0 -t vm_images /var/backups/limen/vm_images/vm_images_20241223_120000.tar.gz

    # Restore configuration backup
    $0 -t config /var/backups/limen/config/config_20241223_120000.tar.gz

EOF
}

# Restore database
restore_database() {
    local backup_file="$1"
    local decrypt_key="${2:-}"
    local temp_file="${backup_file}.tmp"
    
    log "Restoring database from: $backup_file"
    
    # Decrypt if needed
    if [ -n "$decrypt_key" ] || [[ "$backup_file" == *.enc ]]; then
        if [ -z "$decrypt_key" ]; then
            error "Encrypted backup detected but no decryption key provided"
            error "Use -d option to provide decryption key"
            exit 1
        fi
        
        log "Decrypting backup..."
        if echo "$decrypt_key" | openssl enc -aes-256-cbc -d -pbkdf2 -in "$backup_file" -out "$temp_file" -pass stdin; then
            backup_file="$temp_file"
            log "Decryption completed"
        else
            error "Decryption failed"
            exit 1
        fi
    fi
    
    # Restore database
    log "Restoring database..."
    warn "WARNING: This will overwrite existing database!"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log "Restore cancelled"
        [ -f "$temp_file" ] && rm -f "$temp_file"
        exit 0
    fi
    
    if gunzip -c "$backup_file" | PGPASSWORD="${DB_PASSWORD:-}" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-limen}" -d "${DB_NAME:-limen}"; then
        log "Database restored successfully"
    else
        error "Database restore failed"
        [ -f "$temp_file" ] && rm -f "$temp_file"
        exit 1
    fi
    
    # Cleanup
    [ -f "$temp_file" ] && rm -f "$temp_file"
}

# Restore VM images
restore_vm_images() {
    local backup_file="$1"
    local decrypt_key="${2:-}"
    local temp_file="${backup_file}.tmp"
    local target_dir="${ISO_DIR:-/var/lib/libvirt/images}"
    
    log "Restoring VM images from: $backup_file"
    log "Target directory: $target_dir"
    
    # Decrypt if needed
    if [ -n "$decrypt_key" ] || [[ "$backup_file" == *.enc ]]; then
        if [ -z "$decrypt_key" ]; then
            error "Encrypted backup detected but no decryption key provided"
            error "Use -d option to provide decryption key"
            exit 1
        fi
        
        log "Decrypting backup..."
        if echo "$decrypt_key" | openssl enc -aes-256-cbc -d -pbkdf2 -in "$backup_file" -out "$temp_file" -pass stdin; then
            backup_file="$temp_file"
            log "Decryption completed"
        else
            error "Decryption failed"
            exit 1
        fi
    fi
    
    # Restore VM images
    log "Restoring VM images..."
    warn "WARNING: This will overwrite existing VM images!"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log "Restore cancelled"
        [ -f "$temp_file" ] && rm -f "$temp_file"
        exit 0
    fi
    
    mkdir -p "$target_dir"
    
    if [[ "$backup_file" == *.gz ]]; then
        if gunzip -c "$backup_file" | tar -xf - -C "$target_dir"; then
            log "VM images restored successfully"
        else
            error "VM images restore failed"
            [ -f "$temp_file" ] && rm -f "$temp_file"
            exit 1
        fi
    else
        if tar -xf "$backup_file" -C "$target_dir"; then
            log "VM images restored successfully"
        else
            error "VM images restore failed"
            [ -f "$temp_file" ] && rm -f "$temp_file"
            exit 1
        fi
    fi
    
    # Cleanup
    [ -f "$temp_file" ] && rm -f "$temp_file"
}

# Restore configuration
restore_config() {
    local backup_file="$1"
    local decrypt_key="${2:-}"
    local temp_file="${backup_file}.tmp"
    local target_dir="${CONFIG_DIR:-/home/darc0/projects/LIMEN}"
    
    log "Restoring configuration from: $backup_file"
    log "Target directory: $target_dir"
    
    # Decrypt if needed
    if [ -n "$decrypt_key" ] || [[ "$backup_file" == *.enc ]]; then
        if [ -z "$decrypt_key" ]; then
            error "Encrypted backup detected but no decryption key provided"
            error "Use -d option to provide decryption key"
            exit 1
        fi
        
        log "Decrypting backup..."
        if echo "$decrypt_key" | openssl enc -aes-256-cbc -d -pbkdf2 -in "$backup_file" -out "$temp_file" -pass stdin; then
            backup_file="$temp_file"
            log "Decryption completed"
        else
            error "Decryption failed"
            exit 1
        fi
    fi
    
    # Restore configuration
    log "Restoring configuration..."
    warn "WARNING: This will overwrite existing configuration files!"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log "Restore cancelled"
        [ -f "$temp_file" ] && rm -f "$temp_file"
        exit 0
    fi
    
    if [[ "$backup_file" == *.gz ]]; then
        if gunzip -c "$backup_file" | tar -xf - -C "$target_dir"; then
            log "Configuration restored successfully"
        else
            error "Configuration restore failed"
            [ -f "$temp_file" ] && rm -f "$temp_file"
            exit 1
        fi
    else
        if tar -xf "$backup_file" -C "$target_dir"; then
            log "Configuration restored successfully"
        else
            error "Configuration restore failed"
            [ -f "$temp_file" ] && rm -f "$temp_file"
            exit 1
        fi
    fi
    
    # Cleanup
    [ -f "$temp_file" ] && rm -f "$temp_file"
}

# Parse arguments
BACKUP_TYPE=""
DECRYPT_KEY=""
BACKUP_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            BACKUP_TYPE="$2"
            shift 2
            ;;
        -d|--decrypt)
            DECRYPT_KEY="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            BACKUP_FILE="$1"
            shift
            ;;
    esac
done

# Validate arguments
if [ -z "$BACKUP_TYPE" ] || [ -z "$BACKUP_FILE" ]; then
    error "Missing required arguments"
    usage
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Execute restore based on type
case "$BACKUP_TYPE" in
    database)
        restore_database "$BACKUP_FILE" "$DECRYPT_KEY"
        ;;
    vm_images)
        restore_vm_images "$BACKUP_FILE" "$DECRYPT_KEY"
        ;;
    config)
        restore_config "$BACKUP_FILE" "$DECRYPT_KEY"
        ;;
    *)
        error "Invalid backup type: $BACKUP_TYPE"
        error "Valid types: database, vm_images, config"
        exit 1
        ;;
esac

log "Restore completed successfully"









