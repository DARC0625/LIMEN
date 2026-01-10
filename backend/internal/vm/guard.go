//go:build libvirt
// +build libvirt

// Package vm provides concurrency and timeout guards for libvirt operations.
package vm

import (
	"context"
	"fmt"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"go.uber.org/zap"
)

// withLibvirtGuard executes a libvirt operation with concurrency control and timeout.
// This prevents backend from being overwhelmed by concurrent libvirt calls.
func (s *VMService) withLibvirtGuard(operationName string, fn func() error) error {
	// Acquire semaphore (blocks if max concurrent operations reached)
	select {
	case s.operationSemaphore <- struct{}{}:
		// Semaphore acquired
		defer func() { <-s.operationSemaphore }() // Release on return
	case <-time.After(5 * time.Second):
		// Timeout waiting for semaphore
		logger.Log.Warn("Libvirt operation queued - too many concurrent operations",
			zap.String("operation", operationName))
		return fmt.Errorf("too many concurrent libvirt operations, please try again later")
	}

	// Execute with timeout
	ctx, cancel := context.WithTimeout(context.Background(), s.operationTimeout)
	defer cancel()

	done := make(chan error, 1)
	go func() {
		done <- fn()
	}()

	select {
	case err := <-done:
		return err
	case <-ctx.Done():
		logger.Log.Warn("Libvirt operation timeout",
			zap.String("operation", operationName),
			zap.Duration("timeout", s.operationTimeout))
		return fmt.Errorf("libvirt operation timeout: %s", operationName)
	}
}
