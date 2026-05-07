# Backend - Node.js 20
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY src ./src

# Copy TypeScript config
COPY tsconfig.json .

# Build TypeScript
RUN npm run build

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', r => {if (r.statusCode!==200) throw new Error(r.statusCode)})"

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/index.js"]
