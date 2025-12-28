#!/bin/bash
# Full backup script for LIMEN
# Performs complete backup of all components: database, VM images, and configuration

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_BASE_DIR="${BACKUP_BASE_DIR:-/var/backups/limen}"
ENCRYPTION_KEY="${ENCRYPTION_KEY:-}"
NOTIFICATION_WEBHOOK="${NOTIFICATION_WEBHOOK:-}"  # Optional webhook URL for notifications

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

# Send notification (if webhook is configured)
send_notification() {
    local status="$1"
    local message="$2"
    
    if [ -n "$NOTIFICATION_WEBHOOK" ]; then
        curl -X POST "$NOTIFICATION_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"status\": \"$status\", \"message\": \"$message\", \"timestamp\": \"$(date -Iseconds)\"}" \
            --silent --show-error || warn "Failed to send notification"
    fi
}

# Main backup function
main() {
    local start_time=$(date +%s)
    local errors=0
    
    log "=========================================="
    log "Starting LIMEN Full Backup"
    log "=========================================="
    log "Backup base directory: $BACKUP_BASE_DIR"
    log "Timestamp: $(date)"
    
    # Export backup directory for sub-scripts
    export BACKUP_DIR="$BACKUP_BASE_DIR"
    export ENCRYPTION_KEY
    
    # 1. Database backup
    log ""
    log "--- Step 1/3: Database Backup ---"
    if bash "$SCRIPT_DIR/database.sh"; then
        log "✓ Database backup completed"
    else
        error "✗ Database backup failed"
        errors=$((errors + 1))
    fi
    
    # 2. VM Images backup
    log ""
    log "--- Step 2/3: VM Images Backup ---"
    if bash "$SCRIPT_DIR/vm_images.sh"; then
        log "✓ VM images backup completed"
    else
        error "✗ VM images backup failed"
        errors=$((errors + 1))
    fi
    
    # 3. Configuration backup
    log ""
    log "--- Step 3/3: Configuration Backup ---"
    if bash "$SCRIPT_DIR/config.sh"; then
        log "✓ Configuration backup completed"
    else
        error "✗ Configuration backup failed"
        errors=$((errors + 1))
    fi
    
    # Calculate total time
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))
    
    log ""
    log "=========================================="
    if [ $errors -eq 0 ]; then
        log "Full Backup Completed Successfully"
        log "Duration: ${minutes}m ${seconds}s"
        log "=========================================="
        send_notification "success" "Full backup completed successfully in ${minutes}m ${seconds}s"
        exit 0
    else
        error "Full Backup Completed with Errors"
        error "Failed steps: $errors"
        error "Duration: ${minutes}m ${seconds}s"
        error "=========================================="
        send_notification "error" "Full backup completed with $errors error(s)"
        exit 1
    fi
}

# Run main function
main "$@"





