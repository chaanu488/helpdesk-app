# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
bun x sv create --template minimal --types ts --install bun apps/frontend
```

## Developing

Install dependencies and start the dev server:

```sh
bun install
bun run dev
```

## Building

```sh
bun run build
bun run preview
```

## Testing

### Unit tests (Vitest)

```sh
bun test
```

### E2E tests (Playwright)

ต้องการ backend รันอยู่ก่อน จากนั้นรัน:

```sh
bun run test:e2e
```

**Test coverage:**
- `tests/login.spec.ts` — กรอก email/password แล้ว submit form, assert redirect ไป `/` และ welcome heading
- `tests/tickets.spec.ts` — login ผ่าน API, create ticket, assert redirect + title, read ticket + assert fields

**Setup ก่อนรันครั้งแรก:**

1. ติดตั้ง Chromium browser binary:
   ```sh
   bunx playwright install chromium
   ```

2. ตั้งค่า test credentials ใน `.env`:
   ```sh
   TEST_EMAIL=your-test-user@example.com
   TEST_PASSWORD=yourpassword
   ```
   account นี้ต้องมีอยู่ใน DB แล้ว (เช่น จาก seed)

**หมายเหตุ:** `bun run` ไม่ auto-load `.env` เข้า Playwright worker processes — `playwright.config.ts` จัดการ parse และ inject ให้อัตโนมัติอยู่แล้ว
