FROM oven/bun AS builder
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/frontend/package.json apps/frontend/
COPY apps/backend/src/ apps/backend/src/
RUN bun install
COPY apps/frontend/ apps/frontend/
ARG VITE_API_URL=http://backend:3000
ENV VITE_API_URL=$VITE_API_URL
RUN cd apps/frontend && bun --bun run build

FROM oven/bun:1-alpine
WORKDIR /app
COPY --from=builder /app/apps/frontend/build ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "./index.js"]
