import { applyD1Migrations, env, SELF } from 'cloudflare:test'
import { beforeAll, expect, it } from 'vitest'

const B = 'http://localhost'
const json = { 'content-type': 'application/json', origin: B }
let key = ''

beforeAll(async () => {
  const e = env as unknown as { DB: D1Database; TEST_MIGRATIONS: Parameters<typeof applyD1Migrations>[1] }
  await applyD1Migrations(e.DB, e.TEST_MIGRATIONS)
  await e.DB.exec("INSERT INTO orgs (name, state, employees, year) VALUES ('Test Org', 'NY', 5, 2024)")

  const signUp = await SELF.fetch(`${B}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ email: 'a@example.com', password: 'test-password-1', name: 'a' }),
  })
  expect(signUp.status).toBe(200)
  const cookie = signUp.headers.getSetCookie().map((c: string) => c.split(';')[0]).join('; ')
  const created = await SELF.fetch(`${B}/api/auth/api-key/create`, { method: 'POST', headers: { ...json, cookie }, body: '{"name":"t"}' })
  key = ((await created.json()) as { key: string }).key
})

it('rejects requests without a key', async () => {
  expect((await SELF.fetch(`${B}/v1/orgs`)).status).toBe(401)
})

it('rejects a made-up key', async () => {
  expect((await SELF.fetch(`${B}/v1/orgs`, { headers: { 'x-api-key': 'sk_fake' } })).status).toBe(401)
})

it('will not create a key without a session', async () => {
  const r = await SELF.fetch(`${B}/api/auth/api-key/create`, { method: 'POST', headers: json, body: '{"name":"t"}' })
  expect(r.status).toBe(401)
})

it('returns data with a valid key', async () => {
  const r = await SELF.fetch(`${B}/v1/orgs?state=ny`, { headers: { 'x-api-key': key } })
  expect(r.status).toBe(200)
  expect(await r.json()).toEqual({ data: [{ id: 1, name: 'Test Org', state: 'NY', employees: 5, year: 2024 }] })
})

it('returns 400 on invalid input', async () => {
  const r = await SELF.fetch(`${B}/v1/orgs?limit=5000`, { headers: { 'x-api-key': key } })
  expect(r.status).toBe(400)
})

it('returns 404 for an unknown id', async () => {
  expect((await SELF.fetch(`${B}/v1/orgs/999`, { headers: { 'x-api-key': key } })).status).toBe(404)
})
