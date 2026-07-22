# Runtime image for the eait bot. Bun executes the TypeScript directly — no build step.
FROM oven/bun:1.3-slim

WORKDIR /app

# Dependency layer first so source edits don't bust the install cache.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY tsconfig.json ./
COPY src ./src

# /app/data is where docker-compose.yml mounts the SQLite volume; pre-create it writable so
# openDb's mkdir also works when the image is run without a mount.
RUN mkdir -p /app/data && chown -R bun:bun /app
USER bun

CMD ["bun", "run", "src/index.ts"]
