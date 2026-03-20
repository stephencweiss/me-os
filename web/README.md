# MeOS web (Next.js)

## Setup

From **repo root**:

```bash
pnpm install
cd web && pnpm install
```

Copy `web/.env.local.example` to `web/.env.local` and fill in values.

## Develop

```bash
cd web && pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Test / build

```bash
cd web && pnpm test:run
cd web && pnpm build
```

This package uses **pnpm** only; do not commit `package-lock.json` (ignored at repo root).
