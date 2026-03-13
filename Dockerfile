# Multi-stage Dockerfile for FFS Squad Monitor

# Stage 1: Build frontend
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

# Install ALL dependencies (devDependencies needed for vite build)
RUN npm ci && npm cache clean --force

COPY . .

RUN npm run build

# Stage 2: Production
FROM node:22-alpine

WORKDIR /app

# Copy built frontend, server code, and package files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/package*.json ./

# Install production dependencies only (express, cors, etc.)
RUN npm ci --omit=dev && npm cache clean --force

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Health check against Express server
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1));"

# Run the Express backend server (serves API; frontend served via reverse proxy or static host)
CMD ["node", "server/index.js"]
