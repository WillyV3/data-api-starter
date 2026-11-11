import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { createMiddleware } from 'hono/factory'
import { createAuth, type Env } from './auth'
import { orgs } from './db/schema'

const app = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: (result, c) => {
    if (!result.success) return c.json({ error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, 400)
  },
})

// Sign-up, sign-in and API-key management are all served by better-auth.
app.on(['GET', 'POST'], '/api/auth/*', (c) => createAuth(c.env, new URL(c.req.url).origin).handler(c.req.raw))

// Every /v1 route needs a valid key: `x-api-key: sk_...`
const requireApiKey = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const key = c.req.header('x-api-key')
  if (!key) return c.json({ error: 'missing x-api-key header' }, 401)
  const result = await createAuth(c.env, new URL(c.req.url).origin).api.verifyApiKey({ body: { key } })
  if (!result.valid) {
    const limited = result.error?.code === 'RATE_LIMITED'
    return c.json({ error: result.error?.message ?? 'invalid api key' }, limited ? 429 : 401)
  }
  await next()
})
app.use('/v1/*', requireApiKey)

const Org = z
  .object({ id: z.number(), name: z.string(), state: z.string(), employees: z.number(), year: z.number() })
  .openapi('Org')
const ErrorBody = z.object({ error: z.string() }).openapi('Error')
const security = [{ ApiKey: [] }]

app.openapi(
  createRoute({
    method: 'get',
    path: '/v1/orgs',
    summary: 'List organizations',
    security,
    request: {
      query: z.object({
        state: z.string().length(2).toUpperCase().optional().openapi({ example: 'NY' }),
        year: z.coerce.number().int().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0),
      }),
    },
    responses: {
      200: { description: 'A page of organizations', content: { 'application/json': { schema: z.object({ data: z.array(Org) }) } } },
    },
  }),
  async (c) => {
    const { state, year, limit, offset } = c.req.valid('query')
    const where = and(state ? eq(orgs.state, state) : undefined, year ? eq(orgs.year, year) : undefined)
    const data = await drizzle(c.env.DB).select().from(orgs).where(where).orderBy(orgs.id).limit(limit).offset(offset)
    return c.json({ data }, 200)
  },
)

app.openapi(
  createRoute({
    method: 'get',
    path: '/v1/orgs/{id}',
    summary: 'Get one organization',
    security,
    request: { params: z.object({ id: z.coerce.number().int() }) },
    responses: {
      200: { description: 'The organization', content: { 'application/json': { schema: Org } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorBody } } },
    },
  }),
  async (c) => {
    const { id } = c.req.valid('param')
    const [row] = await drizzle(c.env.DB).select().from(orgs).where(eq(orgs.id, id))
    return row ? c.json(row, 200) : c.json({ error: 'not found' }, 404)
  },
)

app.openAPIRegistry.registerComponent('securitySchemes', 'ApiKey', { type: 'apiKey', in: 'header', name: 'x-api-key' })
app.doc('/openapi.json', { openapi: '3.1.0', info: { title: 'Data API', version: '1.0.0' } })
app.get('/docs', Scalar({ url: '/openapi.json' }))

export default app
