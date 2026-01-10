# Stage 1: Build frontend
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .
RUN bun run build

# Stage 2: Production
FROM oven/bun:1-slim
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --production
COPY --from=builder /app/dist ./dist
COPY src/server ./src/server
COPY config ./config
EXPOSE 3000
CMD ["bun", "run", "start"]
