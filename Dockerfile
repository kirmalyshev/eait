# Runtime image for the eait bot. Bun executes the TypeScript directly — no build step.
FROM oven/bun:1.3-slim

WORKDIR /app

# Dependency layer first so source edits don't bust the install cache.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY tsconfig.json ./
COPY src ./src

USER bun

CMD ["bun", "run", "src/index.ts"]
