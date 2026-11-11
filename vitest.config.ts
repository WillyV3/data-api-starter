import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

export default defineConfig(async () => ({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          BETTER_AUTH_SECRET: 'test-only-secret-not-used-anywhere-real-0000',
          TEST_MIGRATIONS: await readD1Migrations('./drizzle'),
        },
      },
    }),
  ],
}))
