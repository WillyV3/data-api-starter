# data-api-starter

A data-API starter built for Cloudflare's free plan: landing page, sign-up,
self-serve API keys, key-protected JSON endpoints, and generated API docs, in one Worker.

| Job | Framework |
|---|---|
| Routing + validation + OpenAPI | [Hono](https://hono.dev) with `@hono/zod-openapi` and Zod |
| Docs page (`/docs`) | Scalar, generated from the same Zod schemas |
| Database | Cloudflare D1 through Drizzle ORM, migrations by `drizzle-kit` |
| Sign-up, sessions, API keys, per-key rate limits | [better-auth](https://better-auth.com) + `@better-auth/api-key` |
| Landing page + dashboard | one static file, `public/index.html`, served by the same Worker |
| Tests | Vitest inside the Workers runtime (`@cloudflare/vitest-plugin`) |

No other vendors. No billing code: add Stripe when someone asks to pay.

## Run it locally

```sh
pnpm install
cp .dev.vars.example .dev.vars   # then put a real secret in it: openssl rand -base64 32
pnpm db:migrate:local
pnpm db:seed:local
pnpm dev                # http://localhost:8787
```

Open the page, sign up, click "Create API key", then:

```sh
curl -H "x-api-key: sk_..." "http://localhost:8787/v1/orgs?state=NY"
```

`pnpm test` and `pnpm typecheck` should both pass before you change anything.

## Deploy (free)

```sh
pnpm wrangler login
pnpm wrangler d1 create data-api-starter     # paste the printed database_id into wrangler.jsonc
pnpm db:migrate:remote
pnpm db:seed:remote                          # sample rows; skip once you load real data
pnpm wrangler secret put BETTER_AUTH_SECRET  # paste: openssl rand -base64 32
pnpm run deploy
```

## Put your own data in

1. Replace the `orgs` table in `src/db/schema.ts` with your tables.
2. `pnpm db:generate` writes a migration into `drizzle/`; `pnpm db:migrate:local` applies it.
3. Copy the two route blocks in `src/index.ts` and change the Zod schemas and the query.
4. Bulk-load rows with `wrangler d1 execute DB --remote --file your-data.sql`.

If you add a better-auth plugin, run `pnpm auth:generate` and then `pnpm db:generate`.

## Free-plan limits (Cloudflare docs, checked 2026-11-11)

- Workers: 100,000 requests/day, 10 ms CPU per request.
- D1: 5 million rows read/day, 100,000 rows written/day, 5 GB storage.
- Each API call writes one row (the key's usage counter), so the write limit caps you at
  roughly 100,000 API calls/day. The per-key limit is 1,000/day; change it in `src/auth.ts`.


**Not yet tested on a deployed free Worker.** Everything here was verified locally with
`wrangler dev`, which does not enforce the 10 ms CPU limit. Two places could exceed it:
password hashing on sign-up and sign-in, and the per-request auth setup plus key check on every
`/v1` call. After your first deploy, run `pnpm wrangler tail` and make a few calls. If you see
"exceeded CPU" (error 1102), the fixes are the Workers Paid plan, or for sign-in only, a social
provider in `src/auth.ts` (no password hashing).

## Not included

Stripe billing, email verification, password reset (the last two need an email sender).
