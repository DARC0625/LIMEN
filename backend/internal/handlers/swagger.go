package handlers

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"go.uber.org/zap"
)

// HandleSwaggerUI serves the Swagger UI
func (h *Handler) HandleSwaggerUI(w http.ResponseWriter, r *http.Request) {
	// Read the swagger.yaml file
	swaggerPath := filepath.Join("docs", "swagger.yaml")
	swaggerData, err := os.ReadFile(swaggerPath)
	if err != nil {
		logger.Log.Error("Failed to read swagger.yaml", zap.Error(err))
		http.Error(w, "Swagger documentation not found", http.StatusNotFound)
		return
	}

	// Serve Swagger UI HTML with embedded swagger.yaml
	html := `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LIMEN API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui.css" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin:0;
      background: #fafafa;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const spec = ` + string(swaggerData) + `;
      const ui = SwaggerUIBundle({
        spec: spec,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        tryItOutEnabled: true
      });
    };
  </script>
</body>
</html>`

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(html))
}

// HandleSwaggerJSON serves the swagger.yaml as JSON
func (h *Handler) HandleSwaggerJSON(w http.ResponseWriter, r *http.Request) {
	swaggerPath := filepath.Join("docs", "swagger.yaml")
	swaggerData, err := os.ReadFile(swaggerPath)
	if err != nil {
		logger.Log.Error("Failed to read swagger.yaml", zap.Error(err))
		http.Error(w, "Swagger documentation not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/yaml")
	w.WriteHeader(http.StatusOK)
	w.Write(swaggerData)
}


