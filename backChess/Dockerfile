FROM node:20-bullseye-slim AS builder
WORKDIR /usr/src/app

# Install build dependencies (if native modules or Prisma generation is needed)
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates build-essential \
	&& rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# install full dependencies so prisma generate can run
RUN npm ci

# copy sources and build
COPY . .
RUN npm run build --if-present
RUN npx prisma generate

FROM node:20-bullseye-slim AS runner
WORKDIR /usr/src/app

# Create a non-root user (optional but recommended)
RUN useradd --system --user-group appuser || true

# Install runtime dependencies needed for healthchecks and TLS
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

# copy only the artifacts we need
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/index.js ./index.js
COPY --from=builder /usr/src/app/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

# Ensure appuser can access the application files
RUN chown -R appuser:appuser /usr/src/app

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

USER appuser
ENTRYPOINT ["/usr/src/app/docker-entrypoint.sh"]
