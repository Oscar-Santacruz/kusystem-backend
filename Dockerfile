# ---- Builder Stage ----
# Build the TypeScript project to JavaScript
FROM node:20 AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable

# Copy dependency definition files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy the rest of the application source code.
# This will include src/, prisma/, tsconfig.json, and any other root files like instrumentation.ts
COPY . .

# Generate Prisma Client
RUN pnpm prisma generate

# Build the project
RUN pnpm build

# Prune devDependencies to keep only production deps in builder output
RUN pnpm prune --prod

# ---- DEBUG STEP ----
# List the contents of the dist directory to see what was built
RUN echo "Contenido del directorio dist:" && ls -la /app/dist
# ---- END DEBUG STEP ----

# ---- Production Stage ----
# Create a smaller image with only production artifacts
FROM node:20-slim

WORKDIR /app

# Install OpenSSL, which is a dependency for Prisma to connect to the database.
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

## Copiamos artefactos listos desde el builder
# Dependencias de producción (incluye Prisma CLI porque está en dependencies)
COPY --from=builder /app/node_modules ./node_modules
# Código compilado
COPY --from=builder /app/dist ./dist
# Esquema de Prisma (para migrate deploy)
COPY prisma ./prisma
# package.json solo a efectos de metadatos (no instalamos en esta etapa)
COPY package.json ./package.json

# Expose the application port (from your .env.docker)
EXPOSE 4000

# Copy the entrypoint script
COPY entrypoint.sh .

# Make the entrypoint script executable
RUN chmod +x entrypoint.sh

# Set the entrypoint
ENTRYPOINT ["./entrypoint.sh"]

# The CMD can be used to pass default arguments to the entrypoint, but we don't have any.
# So we can leave it empty or remove it.
