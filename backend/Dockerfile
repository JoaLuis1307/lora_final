# ==========================================
# STAGE 1: Build Environment
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Copy dependency files
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including devDependencies for tsc)
RUN npm ci

# Copy source code and prisma schema
COPY src ./src
COPY prisma ./prisma

# Generate Prisma Client (if using prisma mode)
RUN npx prisma generate

# Compile TypeScript
RUN npm run build

# ==========================================
# STAGE 2: Runtime Environment
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Copy package definition and locks
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --only=production

# Copy compiled files from builder stage
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma ./node_modules/@prisma

# Create folder for local fallback data file storage
RUN mkdir -p data

# Expose HTTP Server Port
EXPOSE 3001

# Run server
CMD ["node", "dist/server.js"]
