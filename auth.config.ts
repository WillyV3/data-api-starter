// Only read by `pnpm auth:generate` to emit src/db/auth-schema.ts. Not part of the Worker.
import { createAuth } from './src/auth'

export const auth = createAuth({ DB: {} as D1Database, BETTER_AUTH_SECRET: 'generate-only-not-a-real-secret-0000' }, 'http://localhost:8787')
