import { pgTable, uuid, text, timestamp, boolean, pgEnum, integer, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['customer', 'agent', 'developer', 'admin']);
export const ticketStatusEnum = pgEnum('ticket_status', ['open', 'in_progress', 'waiting', 'resolved', 'closed']);
export const ticketPriorityEnum = pgEnum('ticket_priority', ['low', 'medium', 'high', 'urgent']);
export const providerEnum = pgEnum('provider', ['github', 'bitbucket']);

// Users
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: userRoleEnum('role').notNull().default('customer'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Categories
export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Tickets
export const tickets = pgTable('tickets', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketNumber: integer('ticket_number').generatedAlwaysAsIdentity().notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: ticketStatusEnum('status').notNull().default('open'),
  priority: ticketPriorityEnum('priority').notNull().default('medium'),
  customerId: uuid('customer_id').notNull().references(() => users.id),
  assignedAgentId: uuid('assigned_agent_id').references(() => users.id),
  categoryId: uuid('category_id').references(() => categories.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Ticket Tags (many-to-many)
export const ticketTags = pgTable('ticket_tags', {
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  tag: text('tag').notNull(),
}, (table) => [
  primaryKey({ columns: [table.ticketId, table.tag] }),
]);

// Messages
export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id),
  body: text('body').notNull(),
  isInternal: boolean('is_internal').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Integrations
export const integrations = pgTable('integrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  provider: providerEnum('provider').notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  owner: text('owner').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Linked Issues
export const linkedIssues = pgTable('linked_issues', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  integrationId: uuid('integration_id').notNull().references(() => integrations.id),
  provider: providerEnum('provider').notNull(),
  repoFullName: text('repo_full_name').notNull(),
  issueNumber: integer('issue_number').notNull(),
  issueUrl: text('issue_url').notNull(),
  issueState: text('issue_state'),
  assigneeLogin: text('assignee_login'),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  tickets: many(tickets, { relationName: 'customerTickets' }),
  assignedTickets: many(tickets, { relationName: 'agentTickets' }),
  messages: many(messages),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  customer: one(users, { fields: [tickets.customerId], references: [users.id], relationName: 'customerTickets' }),
  assignedAgent: one(users, { fields: [tickets.assignedAgentId], references: [users.id], relationName: 'agentTickets' }),
  category: one(categories, { fields: [tickets.categoryId], references: [categories.id] }),
  tags: many(ticketTags),
  messages: many(messages),
  linkedIssues: many(linkedIssues),
}));

export const ticketTagsRelations = relations(ticketTags, ({ one }) => ({
  ticket: one(tickets, { fields: [ticketTags.ticketId], references: [tickets.id] }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  ticket: one(tickets, { fields: [messages.ticketId], references: [tickets.id] }),
  author: one(users, { fields: [messages.authorId], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  tickets: many(tickets),
}));

export const integrationsRelations = relations(integrations, ({ one, many }) => ({
  createdByUser: one(users, { fields: [integrations.createdBy], references: [users.id] }),
  linkedIssues: many(linkedIssues),
}));

export const linkedIssuesRelations = relations(linkedIssues, ({ one }) => ({
  ticket: one(tickets, { fields: [linkedIssues.ticketId], references: [tickets.id] }),
  integration: one(integrations, { fields: [linkedIssues.integrationId], references: [integrations.id] }),
}));
