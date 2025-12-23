# Build stage
FROM golang:1.24-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git make

WORKDIR /build

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -trimpath \
    -o server \
    ./cmd/server

# Final stage
FROM alpine:latest

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    wget \
    && update-ca-certificates
# Note: libvirt is accessed via socket mount from host
# libvirt libraries are not needed in container

# Create non-root user
RUN addgroup -g 1000 limen && \
    adduser -D -u 1000 -G limen limen

WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/server .

# Copy agent binary (will be built separately or mounted)
# The agent should be built separately and mounted as volume
# or included in a multi-stage build

# Set ownership
RUN chown -R limen:limen /app

# Switch to non-root user
USER limen

# Expose port
EXPOSE 18443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:18443/api/health || exit 1

# Run the server
CMD ["./server"]

