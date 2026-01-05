// Package utils provides utility functions for retry logic and error handling.
package utils

import (
	"context"
	"fmt"
	"time"

	"go.uber.org/zap"
)

// RetryConfig configures retry behavior
type RetryConfig struct {
	MaxAttempts      int
	InitialDelay     time.Duration
	MaxDelay         time.Duration
	BackoffMultiplier float64
	Logger           *zap.Logger
}

// DefaultRetryConfig returns a default retry configuration
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxAttempts:      3,
		InitialDelay:     100 * time.Millisecond,
		MaxDelay:         5 * time.Second,
		BackoffMultiplier: 2.0,
		Logger:           nil,
	}
}

// Retry executes a function with retry logic
func Retry(ctx context.Context, fn func() error, config RetryConfig) error {
	var lastErr error
	delay := config.InitialDelay

	for attempt := 1; attempt <= config.MaxAttempts; attempt++ {
		// Check if context is cancelled
		select {
		case <-ctx.Done():
			return fmt.Errorf("retry cancelled: %w", ctx.Err())
		default:
		}

		// Execute the function
		err := fn()
		if err == nil {
			if config.Logger != nil && attempt > 1 {
				config.Logger.Info("Retry succeeded",
					zap.Int("attempt", attempt),
					zap.Int("max_attempts", config.MaxAttempts))
			}
			return nil
		}

		lastErr = err

		// Don't sleep after the last attempt
		if attempt < config.MaxAttempts {
			if config.Logger != nil {
				config.Logger.Debug("Retry attempt failed, will retry",
					zap.Int("attempt", attempt),
					zap.Int("max_attempts", config.MaxAttempts),
					zap.Duration("delay", delay),
					zap.Error(err))
			}

			// Wait before retrying
			select {
			case <-ctx.Done():
				return fmt.Errorf("retry cancelled: %w", ctx.Err())
			case <-time.After(delay):
			}

			// Calculate next delay with exponential backoff
			delay = time.Duration(float64(delay) * config.BackoffMultiplier)
			if delay > config.MaxDelay {
				delay = config.MaxDelay
			}
		}
	}

	if config.Logger != nil {
		config.Logger.Warn("All retry attempts failed",
			zap.Int("attempts", config.MaxAttempts),
			zap.Error(lastErr))
	}

	return fmt.Errorf("retry failed after %d attempts: %w", config.MaxAttempts, lastErr)
}

// RetryWithTimeout executes a function with retry logic and a total timeout
func RetryWithTimeout(ctx context.Context, fn func() error, config RetryConfig, timeout time.Duration) error {
	timeoutCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	return Retry(timeoutCtx, fn, config)
}





