package main

import (
	"context"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/alerting"
	"github.com/DARC0625/LIMEN/backend/internal/alerting/channels"
	"github.com/DARC0625/LIMEN/backend/internal/config"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/middleware"
	"go.uber.org/zap"
)

// setupAlerting initializes and configures the alerting system.
func setupAlerting(cfg *config.Config) *alerting.Manager {
	if !cfg.AlertingEnabled {
		logger.Log.Info("Alerting is disabled")
		return nil
	}

	manager := alerting.NewManager(logger.Log)
	
	// Set deduplication window
	if cfg.AlertDedupWindow > 0 {
		manager.SetDedupWindow(time.Duration(cfg.AlertDedupWindow) * time.Minute)
	}

	// Register log channel (always enabled)
	logChannel := channels.NewLogChannel(logger.Log)
	manager.RegisterChannel(logChannel)

	// Register webhook channel (if configured)
	if cfg.AlertWebhookURL != "" {
		webhookChannel := channels.NewWebhookChannel(cfg.AlertWebhookURL, logger.Log)
		manager.RegisterChannel(webhookChannel)
		logger.Log.Info("Webhook alert channel registered", zap.String("url", cfg.AlertWebhookURL))
	}

	// Register email channel (if configured)
	if cfg.AlertEmailEnabled && cfg.AlertEmailSMTPHost != "" && len(cfg.AlertEmailTo) > 0 {
		emailChannel := channels.NewEmailChannel(
			cfg.AlertEmailSMTPHost,
			cfg.AlertEmailSMTPPort,
			cfg.AlertEmailSMTPUser,
			cfg.AlertEmailSMTPPass,
			cfg.AlertEmailFrom,
			cfg.AlertEmailTo,
			logger.Log,
		)
		manager.RegisterChannel(emailChannel)
		logger.Log.Info("Email alert channel registered", zap.Strings("recipients", cfg.AlertEmailTo))
	}

	// Set global alert manager for middleware
	middleware.SetAlertManager(manager)

	logger.Log.Info("Alerting system initialized")
	
	return manager
}

// startResourceMonitoring starts background monitoring for resource usage.
func startResourceMonitoring(manager *alerting.Manager, cfg *config.Config) {
	if manager == nil {
		return
	}

	ctx := context.Background()

	// Disk space monitoring
	diskRule := alerting.NewDiskSpaceRule(manager, cfg.VMDir, 85.0) // Alert at 85% usage
	go runMonitoringRule(ctx, diskRule, manager)

	// Memory monitoring
	memoryRule := alerting.NewMemoryRule(manager, 90.0) // Alert at 90% usage
	go runMonitoringRule(ctx, memoryRule, manager)

	logger.Log.Info("Resource monitoring started")
}

// runMonitoringRule runs a monitoring rule in a loop.
func runMonitoringRule(ctx context.Context, rule alerting.Rule, manager *alerting.Manager) {
	ticker := time.NewTicker(time.Duration(rule.Interval()) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			alert, err := rule.Check(ctx)
			if err != nil {
				logger.Log.Error("Monitoring rule check failed",
					zap.String("rule", rule.Name()),
					zap.Error(err))
				continue
			}

			if alert != nil {
				if err := manager.Send(ctx, *alert); err != nil {
					logger.Log.Error("Failed to send alert",
						zap.String("rule", rule.Name()),
						zap.Error(err))
				}
			}
		}
	}
}

