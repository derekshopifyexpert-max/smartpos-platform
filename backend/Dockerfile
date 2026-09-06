# syntax=docker/dockerfile:1
#
# npm workspaces monorepo — SINGLE lockfile at the repo root
# (/package-lock.json). No per-workspace lockfiles exist or are
# assumed. `npm ci` runs exactly once, at the repository root.
#
# Key mechanic this file relies on: npm ci at root produces ONE
# node_modules (/app/node_modules), and each workspace is wired in
# via a relative symlink inside it (e.g.
# node_modules/@smartpos-platform/wallet -> ../../wallet). Because
# those symlinks are relative, /app must always be copied as a whole
# unit — never as individual workspace subpaths — so this file never
# assumes any specific workspace has (or lacks) its own nested
# node_modules.
#
# Build context for this file MUST be the project root
# (see docker-compose.yml: context: .).

# ---------- deps ----------
# Only manifests copied here, so this layer is cache-stable across
# source-only changes and only invalidates when a package.json or
# the root lockfile changes.
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json   ./backend/package.json
COPY shared/package.json    ./shared/package.json
COPY gateway/package.json   ./gateway/package.json
COPY wallet/package.json    ./wallet/package.json
COPY dashboard/package.json ./dashboard/package.json

RUN npm ci

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app

# Copy the entire installed tree from deps as one unit (root
# node_modules + all workspace folders + their symlinks together).
# This is the safe replacement for copying individual workspace
# node_modules paths that may not exist.
COPY --from=deps /app ./

# Now overlay full source for all workspaces + database/.
# .dockerignore excludes node_modules/dist from this COPY so it
# cannot clobber what npm ci already installed above.
COPY . .

# Generate the Prisma client exactly as the backend script does,
# from backend/, so the relative path resolves the same as on host.
WORKDIR /app/backend
RUN npx prisma generate --schema ../database/schema/schema.prisma

# Build only the backend workspace.
WORKDIR /app
RUN npm run build -w backend

# ---------- production ----------
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Copy the whole built tree as one unit, for the same symlink-
# integrity reason as the build stage.
COPY --from=build --chown=node:node /app ./

# Strip devDependencies across the whole workspace tree.
RUN npm prune --omit=dev

USER node
WORKDIR /app/backend
EXPOSE 4000

CMD ["node", "dist/server.js"]