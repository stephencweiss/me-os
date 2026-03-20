# MeOS webapp (Next.js)

## Setup

From **repo root**:

```bash
pnpm install
cd webapp && pnpm install
```

Copy `webapp/.env.local.example` to `webapp/.env.local` and fill in values.

## Develop

```bash
cd webapp && pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Test / build

```bash
cd webapp && pnpm test:run
cd webapp && pnpm build
```

This package uses **pnpm** only; do not commit `package-lock.json` (ignored at repo root).
