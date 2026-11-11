import { apiKey } from '@better-auth/api-key'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from './db/schema'

export type Env = { DB: D1Database; BETTER_AUTH_SECRET: string }

// D1 only exists inside a request, so auth is built per request. baseURL comes from the
// request origin, so the same code runs on localhost, workers.dev and a custom domain.
export const createAuth = (env: Env, origin: string) =>
  betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: origin,
    database: drizzleAdapter(drizzle(env.DB), { provider: 'sqlite', schema }),
    emailAndPassword: { enabled: true },
    plugins: [
      apiKey({
        defaultPrefix: 'sk_',
        // per-key limit; the plugin default is 10 requests/day
        rateLimit: { enabled: true, timeWindow: 1000 * 60 * 60 * 24, maxRequests: 1000 },
      }),
    ],
  })

