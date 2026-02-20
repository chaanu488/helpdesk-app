# Helpdesk

Customer support ticketing system — Bun monorepo with Elysia backend and SvelteKit frontend.

## Prerequisites

- [Bun](https://bun.sh) >= 1.3
- [Docker](https://www.docker.com) (for postgres + redis)

---

## Setup

```sh
# 1. Install dependencies
bun install

# 2. Copy env files
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env

# 3. Start postgres + redis
docker compose up -d

# 4. Push database schema
bun run db:push

# 5. (Optional) Seed initial data
bun run seed
```

---

## Development

```sh
# Start backend only (port 3000)
bun run dev:backend

# Start frontend only (port 5173)
cd apps/frontend && bun dev

# Start both (parallel)
bun run dev
```

---

## Database (Drizzle)

```sh
# Push schema to DB (dev — no migration files)
bun run db:push

# Generate migration files
bun run db:generate

# Run pending migrations
bun run db:migrate

# Open Drizzle Studio (DB GUI)
bun run db:studio

# Seed initial data
bun run seed
```

Root scripts delegate to backend workspace. To run directly:

```sh
cd apps/backend && bunx drizzle-kit push
```

---

## Testing

### Unit tests (Vitest / bun:test)

```sh
# Run all unit tests
bun test

# Run backend tests only
bun test --filter backend

# Run a specific test file
cd apps/backend && bun test src/routes/tickets.test.ts

# Watch mode
cd apps/backend && bun test --watch
```

### E2E tests (Playwright — frontend)

ต้องการ backend + frontend รันอยู่ก่อน (หรือให้ Playwright เปิด dev server อัตโนมัติ)

```sh
# ติดตั้ง Chromium browser binary (ครั้งแรกเท่านั้น)
cd apps/frontend && bunx playwright install chromium

# รัน E2E tests
cd apps/frontend && bun run test:e2e
```

ตั้งค่า test credentials ใน `apps/frontend/.env` (account ต้องมีอยู่ใน DB):

```sh
TEST_EMAIL=your-test-user@example.com
TEST_PASSWORD=yourpassword
```

**Test coverage:**
- `login.spec.ts` — UI login flow → assert redirect + welcome heading
- `tickets.spec.ts` — create ticket → assert redirect + title, read ticket → assert fields

---

## Type Checking

```sh
# Typecheck backend
bun run typecheck

# Typecheck frontend (svelte-check)
cd apps/frontend && bun run check

# Watch mode
cd apps/frontend && bun run check:watch
```

---

## Build

```sh
# Build backend (Bun bundle → dist/)
cd apps/backend && bun run build

# Build frontend (SvelteKit → build/)
cd apps/frontend && bun run build

# Preview frontend build
cd apps/frontend && bun run preview
```

---

## Docker

### Infrastructure (postgres + redis)

```sh
# Start services (background)
docker compose up -d

# Stop services (keep data)
docker compose stop

# Stop and remove containers (keep data)
docker compose down

# Stop and delete all data (volumes)
docker compose down -v

# View logs
docker compose logs -f
docker compose logs -f postgres
docker compose logs -f redis

# Check health status
docker compose ps
```

### Connect to services

```sh
# Postgres shell
docker compose exec postgres psql -U helpdesk -d helpdesk

# Redis CLI (valkey-cli)
docker compose exec redis valkey-cli

# Quick Redis commands
docker compose exec redis valkey-cli ping
docker compose exec redis valkey-cli keys '*'
docker compose exec redis valkey-cli flushall   # clear all data
```

### Build Docker images

```sh
# Build backend image
docker build -f apps/backend/Dockerfile -t helpdesk-backend:local .

# Build frontend image
docker build -f apps/frontend/Dockerfile -t helpdesk-frontend:local .

# Build frontend with custom API URL
docker build -f apps/frontend/Dockerfile \
  --build-arg VITE_API_URL=https://api.example.com \
  -t helpdesk-frontend:local .

# Build both
docker build -f apps/backend/Dockerfile -t helpdesk-backend:local . && \
docker build -f apps/frontend/Dockerfile -t helpdesk-frontend:local .
```

### Run images locally (test build)

ทดสอบ Docker image ที่ build แล้ว โดยใช้ infra (postgres + redis) จาก `docker compose`:

```sh
# Backend — ต้องการ postgres + redis รันอยู่ (docker compose up -d)
docker run --rm \
  --name helpdesk-backend \
  --network helpdesk_default \
  -e DATABASE_URL=postgres://helpdesk:helpdesk@postgres:5432/helpdesk \
  -e REDIS_URL=redis://redis:6379 \
  -e NODE_ENV=production \
  -p 3000:3000 \
  helpdesk-backend:local

# Frontend — ชี้ไปที่ backend ที่รันบน host
docker run --rm \
  --name helpdesk-frontend \
  -e NODE_ENV=production \
  -p 4000:3000 \
  helpdesk-frontend:local
```

> **Network:** `helpdesk_default` คือ network ที่ `docker compose` สร้างให้อัตโนมัติ
> ตรวจสอบชื่อด้วย `docker network ls | grep helpdesk`

---

## Production (without Docker)

### Backend

```sh
cd apps/backend && bun run build
# Output: apps/backend/dist/index.js  (ต้องมี Bun บน server)

# หรือ compile เป็น single binary (ไม่ต้องมี Bun บน server)
bun build --compile apps/backend/src/index.ts --outfile apps/backend/server
# Output: apps/backend/server  (executable เดี่ยว copy ไป deploy ได้เลย)
```

รันด้วย pm2:

```sh
# แบบ dist/index.js (ต้องมี Bun)
pm2 start apps/backend/dist/index.js --name helpdesk-backend --interpreter ~/.bun/bin/bun

# แบบ compiled binary (ไม่ต้องมี Bun)
pm2 start apps/backend/server --name helpdesk-backend
```

### Frontend

```sh
cd apps/frontend && bun run build
# Output: apps/frontend/build/
#   ├── index.js   ← entry point
#   ├── handler.js
#   └── ...        (static assets, server-side code)
```

รันด้วย pm2:

```sh
pm2 start apps/frontend/build/index.js --name helpdesk-frontend --interpreter ~/.bun/bin/bun
```

pm2 ecosystem file (แนะนำ):

```js
// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'helpdesk-backend',
      script: 'apps/backend/dist/index.js',
      interpreter: '/root/.bun/bin/bun',
      env: { NODE_ENV: 'production', PORT: 3000 },
    },
    {
      name: 'helpdesk-frontend',
      script: 'apps/frontend/build/index.js',
      interpreter: '/root/.bun/bin/bun',
      env: { NODE_ENV: 'production', PORT: 4000 },
    },
  ],
};
```

```sh
pm2 start ecosystem.config.cjs
pm2 save          # บันทึก process list
pm2 startup       # auto-start เมื่อ server reboot
```

---

## CI (simulate locally)

```sh
# Run what CI runs (typecheck + test)
bun run typecheck && bun test --filter backend
```

### act — ทดสอบ GitHub Actions บน local

[act](https://github.com/nektos/act) จำลอง GitHub Actions runner ด้วย Docker
ทดสอบ `.github/workflows/ci.yml` ได้โดยไม่ต้อง push เลย

```sh
# ติดตั้ง (macOS)
brew install act

# รัน workflow ทั้งหมด (simulate push event)
act push

# รัน job เดียว
act push --job typecheck
act push --job test

# dry-run (แสดง plan โดยไม่รัน)
act push --dryrun

# ดู jobs ที่มีทั้งหมด
act --list
```

---

## Ports

| Service   | Host Port | Notes                        |
|-----------|-----------|------------------------------|
| Backend   | 3000      | Elysia API                   |
| Frontend  | 5173      | Vite dev server              |
| Postgres  | 5432      | Docker                       |
| Redis     | 6380      | Docker (6379 reserved local) |
| DB Studio | 4983      | `bun run db:studio`          |
