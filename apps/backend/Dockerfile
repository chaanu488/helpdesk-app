FROM oven/bun AS builder
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/backend/package.json apps/backend/
RUN bun install
COPY apps/backend/ apps/backend/
ENV NODE_ENV=production
RUN bun build \
  --compile \
  --minify-whitespace \
  --minify-syntax \
  --outfile apps/backend/server \
  apps/backend/src/index.ts

FROM gcr.io/distroless/base
WORKDIR /app
COPY --from=builder /app/apps/backend/server server
ENV NODE_ENV=production
EXPOSE 3000
CMD ["./server"]
