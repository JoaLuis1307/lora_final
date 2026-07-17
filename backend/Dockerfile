# ==========================================
# STAGE 1: Build Environment
# ==========================================
FROM node:22-alpine AS builder

# Install OpenSSL for Prisma query engine detection
RUN apk add --no-cache openssl

WORKDIR /usr/src/app

# Copy dependency files
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including devDependencies for tsc)
RUN npm ci

# Copy source code and prisma schema
COPY src ./src
COPY prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

# Compile TypeScript
RUN npm run build

# ==========================================
# STAGE 2: Runtime Environment
# ==========================================
FROM node:22-alpine AS runner

# Install OpenSSL for Prisma query engine runtime
RUN apk add --no-cache openssl

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Copy package files
COPY package*.json ./

# Copy complete node_modules (including built prisma engine) and dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

# Create folder for local fallback data file storage
RUN mkdir -p data

# Expose HTTP Server Port
EXPOSE 3001

# Run server
CMD ["node", "dist/server.js"]
