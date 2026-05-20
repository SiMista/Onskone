# syntax=docker/dockerfile:1.7

############################
# 1) BUILDER
############################
FROM node:20-bookworm-slim AS builder

# Outils necessaires a la compilation de better-sqlite3 (native)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

# Copie de tout le repo (le .dockerignore exclut node_modules, .env, etc.)
COPY . .

# Install + build (cache mount sur le store pnpm pour accelerer les rebuilds)
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

RUN pnpm --filter @onskone/shared build

RUN pnpm --filter frontend build

############################
# 2) RUNTIME
############################
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

# On recopie tout depuis le builder : node_modules + sources + builds.
# C'est simple et sur (les symlinks pnpm restent valides car les chemins
# absolus sont identiques /app/* dans les deux stages).
COPY --from=builder /app /app

# Le backend ecrit la DB SQLite dans backend/data (volume monte par compose)
RUN mkdir -p /app/backend/data

WORKDIR /app/backend
EXPOSE 8080

CMD ["pnpm", "start"]
