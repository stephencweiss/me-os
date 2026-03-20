---
status: ACTIVE
created: 2026-03-19
---

# Local testing: week alignment API (Phase 1)

End-to-end checklist for **`GET /api/week-alignment`** and **`POST /api/week-alignment/audit`** after you have this branch checked out.

**Path:** `docs/testing/week-alignment-local.md`

## Where to work from

Use **either**:

- **Jj workspace (feature line):**  
  `cd /Users/sweiss/code/worktrees/me-os/mobile-alignment-mvp`  
  (or your own path to the `mobile-alignment-mvp` workspace)

- **Any clone** once the bookmark/branch is merged or checked out:  
  `cd /path/to/me-os` then `cd webapp`

All **install, dev server, and tests** below assume **`webapp`** as the working directory unless noted.

```bash
cd webapp
```

---

## Open a pull request (why you might not see one yet)

There is **no GitHub PR** until the jj bookmark is **pushed** to `origin`.

From a jj checkout that has the `mobile-alignment-mvp` bookmark:

```bash
cd /path/to/me-os   # repo root that contains .jj
jj git fetch
jj git push --bookmark mobile-alignment-mvp
```

Then open GitHub → **me-os** → **Pull requests** → compare **`mobile-alignment-mvp`** (or the remote branch name jj created) into **`main`**, or run:

```bash
gh pr create --repo stephencweiss/me-os --base main --head mobile-alignment-mvp --fill
```

(Adjust `--head` if the remote branch name differs.)

---

## 1. Dependencies

```bash
cd webapp
pnpm install
```

---

## 2. Environment

Copy secrets from your main machine if this is a fresh worktree:

```bash
# from repo root, if needed
cp /path/to/main/me-os/webapp/.env.local ./webapp/
```

At minimum for **signed-in browser testing**, `webapp/.env.local` should match your usual Next app (see `webapp/.env.local.example`): **NextAuth**, **Google OAuth**, **Supabase** service URL + keys as you already use for `/api/goals`.

### Database migration (Supabase)

If you use **Supabase** in web mode, apply:

`scripts/migrations/003_alignment_mobile.sql`

in the Supabase SQL editor so **`weekly_audit_state`** and **`weekly_goals.constraints_json`** exist. Without this, **audit writes** can fail with a missing-relation error.

### Optional: “local mode” (no login)

If **`MEOS_MODE=local`** *or* both **`NEXTAUTH_URL`** and **`NEXT_PUBLIC_SUPABASE_URL`** are unset, the app treats requests as **local mode**: APIs skip session auth and use the **Turso** path with `userId: null`.

For that you also need **`TURSO_DATABASE_URL`** (and token if required) in `.env.local`, plus a DB that has your goals/events schema. The code can **auto-create** the local **`weekly_audit_state`** table on first use.

---

## 3. Automated tests (no server)

From **`webapp`**:

```bash
pnpm exec vitest run lib/week-alignment.test.ts
```

These cover DTO construction, **syncHint**, audit eligibility, and **goal constraints** parsing—not HTTP or NextAuth.

---

## 4. Dev server

```bash
cd webapp
pnpm dev
```

Default: **http://localhost:3000** (or the next free port shown in the terminal).

---

## 5. Manual API checks

Pick a real ISO week id, e.g. **`2026-W12`**.

### A. Authenticated (recommended “real” test)

1. Open **`http://localhost:3000`**, sign in with Google (same flow as the rest of the app).
2. In the **same browser**, open:
   - `http://localhost:3000/api/week-alignment?week=2026-W12`
3. Expect **`200`** and JSON with **`schemaVersion`: 1**, **`weekId`**, **`goals`**, **`syncHint`**, **`audit`**.
4. **Audit:**  
   `POST http://localhost:3000/api/week-alignment/audit`  
   with JSON body (use DevTools, curl with cookie jar, or an API client that sends session cookies):

   ```json
   { "week": "2026-W12", "action": "snooze", "snoozedUntil": "2026-12-31T23:59:59.000Z" }
   ```

   Other actions: **`dismiss`**, **`seen`** (snooze requires **`snoozedUntil`**).

5. **GET** again and confirm **`audit.snoozedUntil`** / **`promptCount`** changed as expected.

### B. Unauthenticated (web mode)

With full `.env.local` (not local mode), open the GET URL in a **private window** (no session):

- Expect **`401`** and `{ "error": "Unauthorized" }`.

### C. Validation

- Omit **`?week=`** → **`400`**.
- Invalid week format → **`400`**.

---

## 6. Quick regression

- **`GET /api/goals?week=2026-W12`** still works (same auth and data layer).
- After migration, goal CRUD in the UI still works.

---

## Related docs

- Build checklist: `plans/mobile-alignment-mvp-build.md`
- Client strategy (SwiftUI): `docs/designs/mobile-goal-alignment.md`
- JSON contract: `schemas/alignment-mobile-v1.json`
