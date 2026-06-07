# Frontend - Node.js 20 base
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY client/package*.json ./
RUN npm ci

# Copy source
COPY client .

# Build
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install serve to run production build
RUN npm install -g serve

# Copy built app from builder
COPY --from=builder /app/dist ./dist

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', r => {if (r.statusCode!==200) throw new Error(r.statusCode)})"

ENV NODE_ENV=production
EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
