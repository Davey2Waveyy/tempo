import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
  revision: integer('revision').notNull().default(0),
});
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    role: text('role', { enum: ['owner', 'member'] }).notNull(),
    tokenVersion: integer('token_version').notNull().default(0),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('one_owner')
      .on(t.role)
      .where(sql`${t.role} = 'owner'`),
  ],
);
export const credentials = sqliteTable(
  'credentials',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    publicKey: text('public_key').notNull(),
    counter: integer('counter').notNull(),
    transports: text('transports').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('credentials_user').on(t.userId)],
);
export const setupCodes = sqliteTable('setup_codes', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),
  expiresAt: integer('expires_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
});
export const authChallenges = sqliteTable(
  'auth_challenges',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    challenge: text('challenge').notNull(),
    purpose: text('purpose').notNull(),
    origin: text('origin').notNull(),
    rpId: text('rp_id').notNull(),
    tokenVersion: integer('token_version').notNull(),
    codeHash: text('code_hash'),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [index('challenges_expiry').on(t.expiresAt)],
);
export const authSessions = sqliteTable(
  'auth_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [
    index('sessions_user').on(t.userId),
    index('sessions_expiry').on(t.expiresAt),
  ],
);
export const authLimits = sqliteTable(
  'auth_limits',
  {
    id: text('id').primaryKey(),
    count: integer('count').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [index('limits_expiry').on(t.expiresAt)],
);
