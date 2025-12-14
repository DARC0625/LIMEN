package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"

	"github.com/DARC0625/LIMEN/backend/internal/auth"
	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/models"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

// VMStatusBroadcaster manages WebSocket connections for VM status updates
type VMStatusBroadcaster struct {
	clients    map[*websocket.Conn]bool
	broadcast  chan []byte
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	mu         sync.RWMutex
}

// NewVMStatusBroadcaster creates a new VMStatusBroadcaster
func NewVMStatusBroadcaster() *VMStatusBroadcaster {
	return &VMStatusBroadcaster{
		clients:    make(map[*websocket.Conn]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
	}
}

// Run starts the broadcaster goroutine
func (b *VMStatusBroadcaster) Run() {
	for {
		select {
		case conn := <-b.register:
			b.mu.Lock()
			b.clients[conn] = true
			b.mu.Unlock()
			logger.Log.Info("WebSocket client registered for VM status", zap.Int("total_clients", len(b.clients)))

		case conn := <-b.unregister:
			b.mu.Lock()
			if _, ok := b.clients[conn]; ok {
				delete(b.clients, conn)
				conn.Close()
			}
			b.mu.Unlock()
			logger.Log.Info("WebSocket client unregistered for VM status", zap.Int("total_clients", len(b.clients)))

		case message := <-b.broadcast:
			b.mu.RLock()
			for conn := range b.clients {
				err := conn.WriteMessage(websocket.TextMessage, message)
				if err != nil {
					logger.Log.Warn("Failed to send message to WebSocket client", zap.Error(err))
					b.mu.RUnlock()
					b.mu.Lock()
					delete(b.clients, conn)
					conn.Close()
					b.mu.Unlock()
					b.mu.RLock()
				}
			}
			b.mu.RUnlock()
		}
	}
}

// BroadcastVMUpdate broadcasts a VM update to all connected clients
func (b *VMStatusBroadcaster) BroadcastVMUpdate(vm models.VM) {
	message, err := json.Marshal(map[string]interface{}{
		"type": "vm_update",
		"vm":   vm,
	})
	if err != nil {
		logger.Log.Error("Failed to marshal VM update", zap.Error(err))
		return
	}

	select {
	case b.broadcast <- message:
	default:
		logger.Log.Warn("Broadcast channel full, dropping message")
	}
}

// BroadcastVMList broadcasts the entire VM list to all connected clients
func (b *VMStatusBroadcaster) BroadcastVMList(vms []models.VM) {
	message, err := json.Marshal(map[string]interface{}{
		"type": "vm_list",
		"vms":  vms,
	})
	if err != nil {
		logger.Log.Error("Failed to marshal VM list", zap.Error(err))
		return
	}

	select {
	case b.broadcast <- message:
	default:
		logger.Log.Warn("Broadcast channel full, dropping message")
	}
}

// HandleVMStatusWebSocket handles WebSocket connections for VM status updates
func (h *Handler) HandleVMStatusWebSocket(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	// Verify authentication via token in query parameter or header
	token := r.URL.Query().Get("token")
	if token == "" {
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
			token = strings.TrimPrefix(authHeader, "Bearer ")
		}
	}

	if token == "" {
		logger.Log.Warn("VM status WebSocket connection attempt without token")
		http.Error(w, "Authentication required", http.StatusUnauthorized)
		return
	}

	// Verify token
	claims, err := auth.ValidateToken(token, cfg.JWTSecret)
	if err != nil {
		logger.Log.Warn("Invalid token for VM status WebSocket", zap.Error(err))
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}

	logger.Log.Info("VM status WebSocket connection", zap.Uint("user_id", claims.UserID))

	upgrader := h.newWebSocketUpgrader()
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logger.Log.Error("WebSocket upgrade failed for VM status", zap.Error(err))
		return
	}
	defer conn.Close()

	// Register client
	h.VMStatusBroadcaster.register <- conn

	// Send initial VM list directly to this client
	var vms []models.VM
	if err := h.DB.Find(&vms).Error; err == nil {
		message, err := json.Marshal(map[string]interface{}{
			"type": "vm_list",
			"vms":  vms,
		})
		if err == nil {
			conn.WriteMessage(websocket.TextMessage, message)
		}
	}

	// Keep connection alive and handle pings
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				logger.Log.Warn("WebSocket error for VM status", zap.Error(err))
			}
			break
		}
	}

	// Unregister client
	h.VMStatusBroadcaster.unregister <- conn
}

