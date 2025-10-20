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

# Copy the entire application directory from the builder stage. This is simpler
# and avoids failing when a `dist` folder doesn't exist (some projects run
# directly from `src` instead of building to `dist`).
COPY --from=builder /usr/src/app /usr/src/app

# Ensure entrypoint is executable and fix ownership for the non-root user
RUN chmod +x /usr/src/app/docker-entrypoint.sh || true
RUN chown -R appuser:appuser /usr/src/app

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

USER appuser
# Invoke the entrypoint explicitly via sh to avoid platform shebang/exec quirks
ENTRYPOINT ["sh", "/usr/src/app/docker-entrypoint.sh"]
