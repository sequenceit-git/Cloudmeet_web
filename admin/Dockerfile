# =========================================================================
# CloudMeet Web Admin Panel - Production Multi-Stage Dockerfile
# =========================================================================

# Stage 1: Build Vite React static bundle
FROM node:20-alpine AS builder

WORKDIR /app

# Build arguments for customizable environment variables
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_TRTC_SDK_APP_ID=
ARG VITE_APP_TITLE="CloudMeet 云会 - 管理后台"

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_TRTC_SDK_APP_ID=$VITE_TRTC_SDK_APP_ID
ENV VITE_APP_TITLE=$VITE_APP_TITLE

COPY package*.json ./
RUN npm install

COPY . ./

# Build production bundle into dist/
RUN npm run build

# Stage 2: Serve with lightweight Nginx Alpine
FROM nginx:alpine AS runner

# Remove default nginx welcome page
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=20s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
