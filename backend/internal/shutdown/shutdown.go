// Package shutdown provides graceful shutdown functionality for the server.
package shutdown

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"go.uber.org/zap"
)

// ShutdownManager manages graceful shutdown of the server and other resources.
type ShutdownManager struct {
	server       *http.Server
	cleanupFuncs []func(context.Context) error
	mu           sync.Mutex
	logger       *zap.Logger
	shutdownCh   chan struct{}
}

// NewShutdownManager creates a new ShutdownManager.
func NewShutdownManager(server *http.Server, logger *zap.Logger) *ShutdownManager {
	return &ShutdownManager{
		server:       server,
		cleanupFuncs: make([]func(context.Context) error, 0),
		logger:       logger,
		shutdownCh:   make(chan struct{}),
	}
}

// RegisterCleanup registers a cleanup function to be called during shutdown.
// Cleanup functions are called in reverse order of registration (LIFO).
func (sm *ShutdownManager) RegisterCleanup(fn func(context.Context) error) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.cleanupFuncs = append(sm.cleanupFuncs, fn)
}

// WaitForShutdown waits for shutdown signals and performs graceful shutdown.
func (sm *ShutdownManager) WaitForShutdown() error {
	// Create a channel to listen for interrupt signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM, syscall.SIGINT)

	// Wait for interrupt signal
	sig := <-sigChan
	sm.logger.Info("Shutdown signal received", zap.String("signal", sig.String()))

	// Create shutdown context with timeout
	shutdownTimeout := 30 * time.Second
	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	// Perform graceful shutdown
	return sm.Shutdown(ctx)
}

// Shutdown performs graceful shutdown of the server and all registered cleanup functions.
func (sm *ShutdownManager) Shutdown(ctx context.Context) error {
	sm.logger.Info("Starting graceful shutdown...")

	// Shutdown HTTP server
	if sm.server != nil {
		sm.logger.Info("Shutting down HTTP server...")
		if err := sm.server.Shutdown(ctx); err != nil {
			sm.logger.Error("Error shutting down HTTP server", zap.Error(err))
			// Force close if graceful shutdown fails
			sm.server.Close()
		} else {
			sm.logger.Info("HTTP server shut down gracefully")
		}
	}

	// Run cleanup functions in reverse order (LIFO)
	sm.mu.Lock()
	cleanupFuncs := make([]func(context.Context) error, len(sm.cleanupFuncs))
	copy(cleanupFuncs, sm.cleanupFuncs)
	sm.mu.Unlock()

	// Create a context with a shorter timeout for cleanup functions
	cleanupCtx, cleanupCancel := context.WithTimeout(ctx, 10*time.Second)
	defer cleanupCancel()

	// Execute cleanup functions in reverse order
	for i := len(cleanupFuncs) - 1; i >= 0; i-- {
		fn := cleanupFuncs[i]
		if fn != nil {
			sm.logger.Debug("Executing cleanup function", zap.Int("index", i))
			if err := fn(cleanupCtx); err != nil {
				sm.logger.Warn("Cleanup function returned error", zap.Error(err), zap.Int("index", i))
			}
		}
	}

	sm.logger.Info("Graceful shutdown completed")
	close(sm.shutdownCh)
	return nil
}

// ShutdownChannel returns a channel that is closed when shutdown is complete.
func (sm *ShutdownManager) ShutdownChannel() <-chan struct{} {
	return sm.shutdownCh
}

// GracefulShutdown performs graceful shutdown with a timeout.
func GracefulShutdown(server *http.Server, timeout time.Duration, logger *zap.Logger) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	logger.Info("Starting graceful shutdown...", zap.Duration("timeout", timeout))

	// Shutdown server
	if err := server.Shutdown(ctx); err != nil {
		logger.Error("Error during server shutdown", zap.Error(err))
		return fmt.Errorf("server shutdown error: %w", err)
	}

	logger.Info("Server shut down gracefully")
	return nil
}
