# Build stage
FROM rust:1.75-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    musl-dev \
    pkgconfig \
    openssl-dev

WORKDIR /build

# Copy Cargo files
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy source code
COPY src ./src

# Build the application
RUN touch src/main.rs && \
    cargo build --release

# Final stage
FROM alpine:latest

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    libgcc \
    wget

# Create non-root user
RUN addgroup -g 1000 limen && \
    adduser -D -u 1000 -G limen limen

WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/target/release/agent .

# Set ownership
RUN chown -R limen:limen /app

# Switch to non-root user
USER limen

# Expose port
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:9000/health || exit 1

# Run the agent
CMD ["./agent"]

