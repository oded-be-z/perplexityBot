# FinanceBot Pro - Production Docker Image
# Multi-stage build for optimized production deployment

# ==========================================
# Stage 1: Build dependencies
# ==========================================
FROM node:18-alpine AS builder

# Add security updates and build tools
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --only=production && npm cache clean --force

# ==========================================
# Stage 2: Production image
# ==========================================
FROM node:18-alpine AS production

# Add security updates and runtime dependencies
RUN apk add --no-cache dumb-init curl

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S financebot -u 1001

# Create app directory
WORKDIR /usr/src/app

# Copy built dependencies from builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy application code
COPY --chown=financebot:nodejs server.js ./
COPY --chown=financebot:nodejs public ./public/
COPY --chown=financebot:nodejs package*.json ./

# Create logs directory
RUN mkdir -p logs && chown financebot:nodejs logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Switch to non-root user
USER financebot

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]

# Metadata
LABEL maintainer="FinanceBot Pro Team"
LABEL version="4.0.0"
LABEL description="Production-ready AI financial advisor"