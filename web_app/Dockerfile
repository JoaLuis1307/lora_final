# ==========================================
# STAGE 1: Build Environment
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Copy dependency files
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies
RUN npm ci

# Copy source code and production environment configuration
COPY public ./public
COPY src ./src
COPY .env.production ./.env

# Build production bundle
RUN npm run build

# ==========================================
# STAGE 2: Runtime Environment
# ==========================================
FROM nginx:1.25-alpine

# Copy compiled static assets from builder stage to Nginx webroot
COPY --from=builder /usr/src/app/build /usr/share/nginx/html

# Expose port 80 for HTTP traffic
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
