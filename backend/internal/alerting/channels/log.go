// Package channels provides alert channel implementations.
package channels

import (
	"context"
	"fmt"

	"github.com/DARC0625/LIMEN/backend/internal/alerting"
	"go.uber.org/zap"
)

// LogChannel sends alerts to the logger.
type LogChannel struct {
	logger *zap.Logger
}

// NewLogChannel creates a new log channel.
func NewLogChannel(logger *zap.Logger) *LogChannel {
	return &LogChannel{
		logger: logger,
	}
}

// Name returns the channel name.
func (c *LogChannel) Name() string {
	return "log"
}

// Send sends an alert to the logger.
func (c *LogChannel) Send(ctx context.Context, alert alerting.Alert) error {
	fields := []zap.Field{
		zap.String("title", alert.Title),
		zap.String("message", alert.Message),
		zap.String("severity", string(alert.Severity)),
		zap.String("service", alert.Service),
		zap.String("component", alert.Component),
		zap.Time("timestamp", alert.Timestamp),
	}

	if len(alert.Tags) > 0 {
		fields = append(fields, zap.Strings("tags", alert.Tags))
	}

	if alert.Metadata != nil && len(alert.Metadata) > 0 {
		for k, v := range alert.Metadata {
			fields = append(fields, zap.Any(fmt.Sprintf("meta_%s", k), v))
		}
	}

	// Log based on severity
	switch alert.Severity {
	case alerting.SeverityCritical:
		c.logger.Error("ALERT", fields...)
	case alerting.SeverityError:
		c.logger.Error("ALERT", fields...)
	case alerting.SeverityWarning:
		c.logger.Warn("ALERT", fields...)
	default:
		c.logger.Info("ALERT", fields...)
	}

	return nil
}






