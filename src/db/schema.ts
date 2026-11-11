import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export * from './auth-schema'

// Sample dataset. Replace with your own tables, then: pnpm db:generate && pnpm db:migrate:local
export const orgs = sqliteTable('orgs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  state: text('state').notNull(),
  employees: integer('employees').notNull(),
  year: integer('year').notNull(),
})
