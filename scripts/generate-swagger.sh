#!/bin/bash
# Generate Swagger documentation from code annotations

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"

cd "$BACKEND_DIR"

echo "=== Generating Swagger Documentation ==="

# Check if swag is installed
if ! command -v swag &> /dev/null; then
    echo "Installing swag..."
    go install github.com/swaggo/swag/cmd/swag@latest
fi

# Generate Swagger documentation
echo "Running swag init..."
swag init -g cmd/server/main.go \
    -o docs \
    --parseDependency \
    --parseInternal \
    --parseDepth 2

echo ""
echo "✅ Swagger documentation generated successfully!"
echo "📁 Documentation location: $BACKEND_DIR/docs"
echo ""
echo "Files generated:"
echo "  - docs/swagger.json"
echo "  - docs/swagger.yaml"
echo ""
echo "Access Swagger UI at: http://localhost:18443/swagger"













