# Multi-stage Dockerfile for FFS Squad Monitor

# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source files
COPY . .

# Build the frontend
RUN npm run build

# Stage 2: Production
FROM node:18-alpine

WORKDIR /app

# Copy built artifacts and package files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/vite.config.js ./

# Install only production dependencies (including vite for preview)
RUN npm ci --only=production && npm cache clean --force

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Run the preview server
CMD ["npm", "run", "preview", "--", "--port", "3000", "--host", "0.0.0.0"]
