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

## Local Testing with ArgoCD + minikube

ทดสอบ GitOps flow บน local ด้วย minikube โดยไม่ต้องใช้ production cluster

### Prerequisites

- [minikube](https://minikube.sigs.k8s.io) รันอยู่ (`minikube start`)
- `kubectl` + `helm` ติดตั้งแล้ว
- Docker images build ไว้แล้ว (`helpdesk-backend:local`, `helpdesk-frontend:local`)

---

### Step 1 — ติดตั้ง ArgoCD ใน minikube

```sh
kubectl create namespace argocd
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# รอจนพร้อม
kubectl rollout status deployment/argocd-server -n argocd --timeout=300s

# ดึง initial password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d; echo

# เปิด UI (รันค้างไว้ใน terminal แยก)
kubectl port-forward svc/argocd-server -n argocd 8080:443
# เปิด https://localhost:8080  username: admin
```

---

### Step 2 — เชื่อม ArgoCD กับ Private Bitbucket repo (SSH)

```sh
# สร้าง SSH key คู่ใหม่สำหรับ ArgoCD
ssh-keygen -t ed25519 -C "argocd-helpdesk" -f ~/.ssh/argocd_helpdesk -N ""

# เอา public key ไปเพิ่มที่ Bitbucket
# Repository Settings → Access keys → Add key (Permission: Read)
cat ~/.ssh/argocd_helpdesk.pub

# Register private key กับ ArgoCD
kubectl create secret generic argocd-bitbucket-ssh \
  --from-file=sshPrivateKey=$HOME/.ssh/argocd_helpdesk \
  -n argocd

kubectl patch secret argocd-bitbucket-ssh -n argocd \
  --type=merge \
  -p '{"metadata":{"labels":{"argocd.argoproj.io/secret-type":"repository"}},"stringData":{"type":"git","url":"git@bitbucket.org:tntoffice/helpdesk.git","insecureIgnoreHostKey":"true"}}'
```

---

### Step 3 — สร้าง values-local.yaml

สร้างไฟล์ `helm/helpdesk/values-local.yaml` สำหรับ local โดยเฉพาะ:

```yaml
backend:
  image: helpdesk-backend
  tag: local
  pullPolicy: Never
  replicas: 1

frontend:
  image: helpdesk-frontend
  tag: local
  pullPolicy: Never

ingress:
  host: helpdesk.local
  tlsSecret: helpdesk-tls

externalSecret:
  enabled: false   # ปิด ESO เพราะ minikube ไม่มี
```

แก้ `argocd/application.yaml` ให้ใช้ `values-local.yaml` แทน `values-prod.yaml`:

```yaml
helm:
  valueFiles:
    - values.yaml
    - values-local.yaml
```

---

### Step 4 — Deploy

```sh
git add helm/helpdesk/values-local.yaml argocd/application.yaml
git commit -m "add values-local.yaml for ArgoCD local testing"
git push origin <branch>

kubectl apply -f argocd/application.yaml
```

ArgoCD จะ auto-sync ภายใน 3 นาที หรือกด **Refresh** ใน UI

---

### Step 5 — เปิดแอป

```sh
# เพิ่ม hosts entry (ทำครั้งเดียว)
echo "$(kubectl get ingress helpdesk -n helpdesk -o jsonpath='{.status.loadBalancer.ingress[0].ip}') helpdesk.local" \
  | sudo tee -a /etc/hosts

# รัน tunnel ค้างไว้ใน terminal แยก
minikube tunnel
```

เปิด `https://helpdesk.local`

---

### สิ่งที่ต้องรันค้างไว้ทุกครั้ง

| Terminal | คำสั่ง |
|---|---|
| ArgoCD UI | `kubectl port-forward svc/argocd-server -n argocd 8080:443` |
| Ingress | `minikube tunnel` |

---

### ปัญหาที่พบและวิธีแก้

| ปัญหา | สาเหตุ | วิธีแก้ |
|---|---|---|
| `unable to resolve branch to commit SHA` | Branch ยังไม่ได้ push ขึ้น remote | `git push origin <branch>` |
| `ExternalSecret CRD is not installed` | `values-prod.yaml` ตั้ง `externalSecret.enabled: true` ทับ | สร้าง `values-local.yaml` ที่ตั้งค่า `enabled: false` |
| `helm uninstall` ลบ resources ด้วย | `--keep-history` เก็บแค่ Helm history ไม่ได้เก็บ K8s resources | รอ ArgoCD auto-sync หรือกด Sync ใน UI |
| เข้าเว็บไม่ได้หลัง sync สำเร็จ | `minikube tunnel` ไม่ได้รัน หรือ `/etc/hosts` ไม่มี entry | รัน tunnel + เพิ่ม hosts entry |

---

### หมายเหตุ: ArgoCD vs Helm release

ArgoCD render Helm chart แล้ว apply ผ่าน Server-Side Apply **โดยไม่สร้าง/อัปเดต Helm release**
ดังนั้น `helm list` จะยังแสดง release เดิม — ให้ใช้ `kubectl get application -n argocd` ดู state จริงแทน

ถ้าต้องการให้ ArgoCD เป็น owner เดียว ให้ uninstall Helm release ก่อน แล้วปล่อยให้ ArgoCD sync ใหม่:

```sh
helm uninstall helpdesk -n helpdesk
# ArgoCD จะ recreate resources อัตโนมัติ
```

---

## Production (ArgoCD + Helm)

GitOps deployment ด้วย ArgoCD — cluster sync กับ Git โดยอัตโนมัติ

### Architecture overview

```
Git repo (helm/helpdesk/)
       │  push
       ▼
   ArgoCD  ──watch──▶  Helm chart  ──apply──▶  K8s cluster (helpdesk ns)
                                                    │
                         External Secrets Operator ◀╯
                                 │
                          AWS SM / Vault
                         (DATABASE_URL, JWT_SECRET, …)
```

### Prerequisites

- Kubernetes cluster (EKS / GKE / k3s / etc.)
- `kubectl` + `helm` ตั้งค่า context ชี้ไปที่ cluster แล้ว
- Container registry (GHCR / ECR / Docker Hub) สำหรับ image backend + frontend

---

### Step 1 — ติดตั้ง ArgoCD ใน cluster

```sh
kubectl create namespace argocd
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# รอจนทุก pod พร้อม
kubectl wait --for=condition=available deployment -n argocd --all --timeout=120s
```

เข้า UI ผ่าน port-forward (หรือ Ingress ถ้ามี):

```sh
kubectl port-forward svc/argocd-server -n argocd 8080:443
# เปิด https://localhost:8080
# username: admin
# password: ดูจาก secret ด้านล่าง
kubectl get secret argocd-initial-admin-secret -n argocd \
  -o jsonpath="{.data.password}" | base64 -d && echo
```

---

### Step 2 — ติดตั้ง External Secrets Operator (ESO)

ESO ทำหน้าที่ดึง secret จาก AWS Secrets Manager / Vault แล้วสร้างเป็น K8s Secret ให้อัตโนมัติ

```sh
helm repo add external-secrets https://charts.external-secrets.io
helm repo update
helm install external-secrets external-secrets/external-secrets \
  -n external-secrets --create-namespace
```

---

### Step 3 — สร้าง secrets ใน provider

**AWS Secrets Manager:**

```sh
aws secretsmanager create-secret \
  --name "prod/helpdesk" \
  --secret-string '{
    "DATABASE_URL": "postgres://user:pass@host:5432/helpdesk",
    "REDIS_URL":    "redis://redis:6379",
    "JWT_SECRET":   "your-strong-secret-here"
  }'
```

**HashiCorp Vault:**

```sh
vault kv put secret/prod/helpdesk \
  DATABASE_URL="postgres://user:pass@host:5432/helpdesk" \
  REDIS_URL="redis://redis:6379" \
  JWT_SECRET="your-strong-secret-here"
```

---

### Step 4 — apply ClusterSecretStore

เลือก provider ที่ใช้ (ไฟล์อยู่ใน `argocd/`):

```sh
# AWS Secrets Manager
kubectl apply -f argocd/cluster-secret-store-aws.yaml

# หรือ HashiCorp Vault
kubectl apply -f argocd/cluster-secret-store-vault.yaml
```

> ก่อน apply ให้แก้ `region` (AWS) หรือ `server` (Vault) ในไฟล์ให้ถูกต้องก่อน

---

### Step 5 — แก้ค่าให้ตรงกับ environment จริง

**`argocd/application.yaml`** — แก้ `repoURL`:

```yaml
source:
  repoURL: https://github.com/YOUR_ORG/helpdesk-app.git  # ← เปลี่ยนตรงนี้
  targetRevision: main
  path: helm/helpdesk
```

**`helm/helpdesk/values-prod.yaml`** — แก้ image registry + domain:

```yaml
backend:
  image: ghcr.io/YOUR_ORG/helpdesk-backend   # ← เปลี่ยนตรงนี้
frontend:
  image: ghcr.io/YOUR_ORG/helpdesk-frontend  # ← เปลี่ยนตรงนี้

ingress:
  host: helpdesk.yourdomain.com              # ← เปลี่ยนตรงนี้
```

Commit + push ทั้งสองไฟล์

---

### Step 6 — deploy ArgoCD Application

```sh
kubectl apply -f argocd/application.yaml
```

ArgoCD จะ sync Helm chart ไปยัง cluster ภายในไม่กี่วินาที ตรวจสอบสถานะ:

```sh
# ผ่าน CLI
kubectl get application -n argocd helpdesk

# หรือผ่าน ArgoCD CLI
argocd app get helpdesk
argocd app sync helpdesk   # force sync ทันที

# sync
kubectl annotate application -n argocd helpdesk \
    argocd.argoproj.io/refresh=hard --overwrite
```

### Step 7 — CI/CD pipeline (อัปเดต image tag)

ทุกครั้งที่ push code ให้ CI build image แล้วอัปเดต tag ใน Git:

```sh
GIT_SHA=$(git rev-parse --short HEAD)

# Build + push images
docker build -f apps/backend/Dockerfile  -t ghcr.io/YOUR_ORG/helpdesk-backend:$GIT_SHA  .
docker build -f apps/frontend/Dockerfile -t ghcr.io/YOUR_ORG/helpdesk-frontend:$GIT_SHA .
docker push ghcr.io/YOUR_ORG/helpdesk-backend:$GIT_SHA
docker push ghcr.io/YOUR_ORG/helpdesk-frontend:$GIT_SHA

# อัปเดต tag ใน values-prod.yaml แล้ว commit กลับ
# ArgoCD จะ detect การเปลี่ยนแปลงและ sync อัตโนมัติ
```

หรือใช้ `argocd app set` โดยไม่ต้องแก้ไฟล์:

```sh
argocd app set helpdesk \
  -p backend.tag=$GIT_SHA \
  -p frontend.tag=$GIT_SHA
```

---

### ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
|------|---------|
| `argocd/application.yaml` | ArgoCD Application manifest — ชี้ repo + Helm chart |
| `argocd/cluster-secret-store-aws.yaml` | ClusterSecretStore สำหรับ AWS Secrets Manager |
| `argocd/cluster-secret-store-vault.yaml` | ClusterSecretStore สำหรับ HashiCorp Vault |
| `helm/helpdesk/` | Helm chart (templates + values) |
| `helm/helpdesk/values.yaml` | ค่า default (dev/local) |
| `helm/helpdesk/values-prod.yaml` | ค่า override สำหรับ production |

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
