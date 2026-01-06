// Package utils provides utility functions for context management.
package utils

import (
	"context"
	"time"

	"go.uber.org/zap"
)

// WithTimeout creates a context with timeout and logs timeout events.
func WithTimeout(parent context.Context, timeout time.Duration, logger *zap.Logger, operation string) (context.Context, context.CancelFunc) {
	ctx, cancel := context.WithTimeout(parent, timeout)
	
	// Log timeout if it occurs
	go func() {
		<-ctx.Done()
		if ctx.Err() == context.DeadlineExceeded {
			if logger != nil {
				logger.Warn("Operation timeout",
					zap.String("operation", operation),
					zap.Duration("timeout", timeout))
			}
		}
	}()
	
	return ctx, cancel
}

// WithCancel creates a context with cancel and ensures cleanup.
func WithCancel(parent context.Context) (context.Context, context.CancelFunc) {
	return context.WithCancel(parent)
}

// ContextWithTimeout creates a context with timeout (simplified version).
func ContextWithTimeout(timeout time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), timeout)
}






