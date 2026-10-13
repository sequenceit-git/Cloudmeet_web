# =========================================================================
# CloudMeet Backend Server - Production Multi-Stage Dockerfile
# =========================================================================

# Stage 1: Build & compile TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies needed to build)
RUN npm ci

# Copy source code and configuration
COPY tsconfig.json ./
COPY src ./src/

# Generate Prisma client
RUN npx prisma generate

# Compile TypeScript to dist/
RUN npm run build

# Stage 2: Minimal Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies only
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production && npx prisma generate

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Run as non-root node user for security
USER node

EXPOSE 5000

HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

CMD ["node", "dist/index.js"]
