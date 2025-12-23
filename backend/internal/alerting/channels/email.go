package channels

import (
	"context"
	"fmt"
	"net/smtp"
	"strings"

	"github.com/DARC0625/LIMEN/backend/internal/alerting"
	"go.uber.org/zap"
)

// EmailChannel sends alerts via email.
type EmailChannel struct {
	smtpHost     string
	smtpPort     int
	smtpUsername string
	smtpPassword string
	from         string
	to           []string
	logger       *zap.Logger
}

// NewEmailChannel creates a new email channel.
func NewEmailChannel(smtpHost string, smtpPort int, smtpUsername, smtpPassword, from string, to []string, logger *zap.Logger) *EmailChannel {
	return &EmailChannel{
		smtpHost:     smtpHost,
		smtpPort:     smtpPort,
		smtpUsername: smtpUsername,
		smtpPassword: smtpPassword,
		from:         from,
		to:           to,
		logger:       logger,
	}
}

// Name returns the channel name.
func (c *EmailChannel) Name() string {
	return "email"
}

// Send sends an alert via email.
func (c *EmailChannel) Send(ctx context.Context, alert alerting.Alert) error {
	if c.smtpHost == "" || len(c.to) == 0 {
		return fmt.Errorf("email channel not configured")
	}
	
	// Build email message
	subject := fmt.Sprintf("[%s] %s - %s", strings.ToUpper(string(alert.Severity)), alert.Service, alert.Title)
	
	body := fmt.Sprintf(`LIMEN Alert Notification

Title: %s
Severity: %s
Service: %s
Component: %s
Time: %s

Message:
%s

`,
		alert.Title,
		alert.Severity,
		alert.Service,
		alert.Component,
		alert.Timestamp.Format("2006-01-02 15:04:05"),
		alert.Message)
	
	if len(alert.Tags) > 0 {
		body += fmt.Sprintf("Tags: %s\n", strings.Join(alert.Tags, ", "))
	}
	
	if alert.Metadata != nil && len(alert.Metadata) > 0 {
		body += "\nMetadata:\n"
		for k, v := range alert.Metadata {
			body += fmt.Sprintf("  %s: %v\n", k, v)
		}
	}
	
	// SMTP authentication
	auth := smtp.PlainAuth("", c.smtpUsername, c.smtpPassword, c.smtpHost)
	
	// Build email headers
	headers := make(map[string]string)
	headers["From"] = c.from
	headers["To"] = strings.Join(c.to, ", ")
	headers["Subject"] = subject
	headers["Content-Type"] = "text/plain; charset=UTF-8"
	
	// Build message
	message := ""
	for k, v := range headers {
		message += fmt.Sprintf("%s: %s\r\n", k, v)
	}
	message += "\r\n" + body
	
	// Send email
	addr := fmt.Sprintf("%s:%d", c.smtpHost, c.smtpPort)
	err := smtp.SendMail(addr, auth, c.from, c.to, []byte(message))
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}
	
	c.logger.Debug("Alert sent via email",
		zap.String("to", strings.Join(c.to, ", ")),
		zap.String("title", alert.Title))
	
	return nil
}

