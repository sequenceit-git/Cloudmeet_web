# =========================================================================
# CloudMeet Backend Server - Production Multi-Stage Dockerfile
# =========================================================================

# Stage 1: Build & compile TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma engine compatibility on Alpine
RUN apk add --no-cache openssl libc6-compat

# Copy dependency definitions
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies needed to build)
RUN npm install

# Copy source code and configuration
COPY tsconfig.json ./
COPY src ./src/

# Generate Prisma client with Linux musl engine
RUN npx prisma generate

# Compile TypeScript to dist/
RUN npm run build

# Stage 2: Minimal Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install OpenSSL and runtime libraries on Alpine
RUN apk add --no-cache openssl libc6-compat

# Install production dependencies and generate client
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --omit=dev && npx prisma generate

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Run as non-root node user for security
USER node

EXPOSE 5000

HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5000/health || exit 1

CMD ["node", "dist/index.js"]
