#!/bin/bash
# LIMEN Restore Drill Script
# Executes full restore drill and collects evidence

set -e

BACKEND_URL="${BACKEND_URL:-http://localhost:18443}"
BACKUP_DIR="${BACKUP_DIR:-/home/darc0/LIMEN/backups}"
LOG_DIR="${LOG_DIR:-/tmp/limen-restore-drill-$$}"

mkdir -p "${LOG_DIR}"

echo "=== LIMEN Restore Drill ===" | tee "${LOG_DIR}/restore-drill.log"
echo "Backend URL: ${BACKEND_URL}"
echo "Backup Directory: ${BACKUP_DIR}"
echo "Log Directory: ${LOG_DIR}"
echo ""

# Step 1: Create backup
echo "Step 1: Creating backup..." | tee -a "${LOG_DIR}/restore-drill.log"
echo "Timestamp: $(date)" | tee -a "${LOG_DIR}/restore-drill.log"

cd /home/darc0/LIMEN/backend
if ./scripts/backup.sh 2>&1 | tee -a "${LOG_DIR}/backup.log"; then
    BACKUP_FILE=$(ls -t "${BACKUP_DIR}"/limen_backup_*.tar.gz 2>/dev/null | head -1)
    if [ -n "${BACKUP_FILE}" ]; then
        echo "✓ Backup created: ${BACKUP_FILE}" | tee -a "${LOG_DIR}/restore-drill.log"
        echo "Backup size: $(du -h "${BACKUP_FILE}" | cut -f1)" | tee -a "${LOG_DIR}/restore-drill.log"
    else
        echo "✗ Backup file not found" | tee -a "${LOG_DIR}/restore-drill.log"
        exit 1
    fi
else
    echo "✗ Backup failed" | tee -a "${LOG_DIR}/restore-drill.log"
    exit 1
fi

# Step 2: Database initialization (WARNING: Only in staging!)
echo ""
echo "Step 2: Database initialization..." | tee -a "${LOG_DIR}/restore-drill.log"
echo "⚠️  WARNING: This will DROP and RECREATE the database schema!"
echo "⚠️  Only run this in staging/test environment!"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "${confirm}" != "yes" ]; then
    echo "Restore drill cancelled" | tee -a "${LOG_DIR}/restore-drill.log"
    exit 0
fi

# Load environment variables
if [ -f /home/darc0/LIMEN/backend/.env ]; then
    source /home/darc0/LIMEN/backend/.env
fi

if [ -z "${DATABASE_URL}" ]; then
    echo "✗ DATABASE_URL not set" | tee -a "${LOG_DIR}/restore-drill.log"
    exit 1
fi

echo "Dropping and recreating database schema..." | tee -a "${LOG_DIR}/restore-drill.log"
psql "${DATABASE_URL}" <<EOF 2>&1 | tee -a "${LOG_DIR}/db-init.log"
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
EOF

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo "✓ Database initialized" | tee -a "${LOG_DIR}/restore-drill.log"
else
    echo "✗ Database initialization failed" | tee -a "${LOG_DIR}/restore-drill.log"
    exit 1
fi

# Step 3: Restore from backup
echo ""
echo "Step 3: Restoring from backup..." | tee -a "${LOG_DIR}/restore-drill.log"
echo "Backup file: ${BACKUP_FILE}" | tee -a "${LOG_DIR}/restore-drill.log"

# Auto-confirm restore
echo "yes" | ./scripts/restore.sh "${BACKUP_FILE}" 2>&1 | tee -a "${LOG_DIR}/restore.log"

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo "✓ Restore completed" | tee -a "${LOG_DIR}/restore-drill.log"
else
    echo "✗ Restore failed" | tee -a "${LOG_DIR}/restore-drill.log"
    exit 1
fi

# Step 4: Verification
echo ""
echo "Step 4: Verification..." | tee -a "${LOG_DIR}/restore-drill.log"

# 4-1: Health check
echo "4-1: Health check..." | tee -a "${LOG_DIR}/restore-drill.log"
sleep 2
HEALTH_RESPONSE=$(curl -s "${BACKEND_URL}/api/health" 2>&1)
echo "${HEALTH_RESPONSE}" | tee "${LOG_DIR}/health-response.json"
if echo "${HEALTH_RESPONSE}" | grep -q '"status":"ok"'; then
    echo "✓ Health check passed" | tee -a "${LOG_DIR}/restore-drill.log"
else
    echo "✗ Health check failed" | tee -a "${LOG_DIR}/restore-drill.log"
fi

# 4-2: Login
echo ""
echo "4-2: Login test..." | tee -a "${LOG_DIR}/restore-drill.log"
LOGIN_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin"}' 2>&1)
echo "${LOGIN_RESPONSE}" | tee "${LOG_DIR}/login-response.json"

# Extract token (mask middle part)
TOKEN=$(echo "${LOGIN_RESPONSE}" | jq -r '.access_token' 2>/dev/null || echo "")
if [ -n "${TOKEN}" ] && [ "${TOKEN}" != "null" ]; then
    TOKEN_MASKED="${TOKEN:0:20}...${TOKEN: -20}"
    echo "✓ Login successful (token: ${TOKEN_MASKED})" | tee -a "${LOG_DIR}/restore-drill.log"
    
    # 4-3: VM list
    echo ""
    echo "4-3: VM list test..." | tee -a "${LOG_DIR}/restore-drill.log"
    VM_LIST_RESPONSE=$(curl -s "${BACKEND_URL}/api/vms" \
        -H "Authorization: Bearer ${TOKEN}" 2>&1)
    echo "${VM_LIST_RESPONSE}" | tee "${LOG_DIR}/vm-list-response.json"
    
    if echo "${VM_LIST_RESPONSE}" | grep -q '"vms"\|\[\]'; then
        echo "✓ VM list retrieved successfully" | tee -a "${LOG_DIR}/restore-drill.log"
    else
        echo "⚠ VM list response may be invalid" | tee -a "${LOG_DIR}/restore-drill.log"
    fi
else
    echo "✗ Login failed" | tee -a "${LOG_DIR}/restore-drill.log"
    echo "Response: ${LOGIN_RESPONSE}" | tee -a "${LOG_DIR}/restore-drill.log"
fi

# Summary
echo ""
echo "=== Restore Drill Summary ===" | tee -a "${LOG_DIR}/restore-drill.log"
echo "Log directory: ${LOG_DIR}" | tee -a "${LOG_DIR}/restore-drill.log"
echo "Files:" | tee -a "${LOG_DIR}/restore-drill.log"
echo "  - restore-drill.log: Main log" | tee -a "${LOG_DIR}/restore-drill.log"
echo "  - backup.log: Backup execution log" | tee -a "${LOG_DIR}/restore-drill.log"
echo "  - db-init.log: Database initialization log" | tee -a "${LOG_DIR}/restore-drill.log"
echo "  - restore.log: Restore execution log" | tee -a "${LOG_DIR}/restore-drill.log"
echo "  - health-response.json: Health check response" | tee -a "${LOG_DIR}/restore-drill.log"
echo "  - login-response.json: Login response" | tee -a "${LOG_DIR}/restore-drill.log"
echo "  - vm-list-response.json: VM list response" | tee -a "${LOG_DIR}/restore-drill.log"
echo ""
echo "Evidence collected in: ${LOG_DIR}"



