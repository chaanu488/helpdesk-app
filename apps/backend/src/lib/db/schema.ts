import { pgTable, uuid, text, timestamp, boolean, pgEnum, integer, primaryKey, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['customer', 'product_owner', 'agent', 'developer', 'admin']);
export const ticketStatusEnum = pgEnum('ticket_status', ['open', 'in_progress', 'waiting', 'resolved', 'closed']);
export const ticketPriorityEnum = pgEnum('ticket_priority', ['low', 'medium', 'high', 'urgent']);
export const providerEnum = pgEnum('provider', ['github', 'bitbucket']);

// Companies
export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  logoUrl: text('logo_url'),
  settings: jsonb('settings'),
  domains: text('domains').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Users
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: userRoleEnum('role').notNull().default('customer'),
  avatarUrl: text('avatar_url'),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
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
  ccEmails: text('cc_emails').array(),
  slaDeadline: timestamp('sla_deadline', { withTimezone: true }),
  firstResponseAt: timestamp('first_response_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
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

// Attachments
export const attachments = pgTable('attachments', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  messageId: uuid('message_id').references(() => messages.id, { onDelete: 'set null' }),
  uploadedBy: uuid('uploaded_by').notNull().references(() => users.id),
  fileName: text('file_name').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: text('mime_type').notNull(),
  storageKey: text('storage_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Notifications
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Invitations
export const invitations = pgTable('invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  role: userRoleEnum('role').notNull().default('customer'),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  invitedBy: uuid('invited_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Password Reset Tokens
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  actorName: text('actor_name').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
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
export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
  invitations: many(invitations),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, { fields: [users.companyId], references: [companies.id] }),
  tickets: many(tickets, { relationName: 'customerTickets' }),
  assignedTickets: many(tickets, { relationName: 'agentTickets' }),
  messages: many(messages),
  notifications: many(notifications),
  attachments: many(attachments),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  customer: one(users, { fields: [tickets.customerId], references: [users.id], relationName: 'customerTickets' }),
  assignedAgent: one(users, { fields: [tickets.assignedAgentId], references: [users.id], relationName: 'agentTickets' }),
  category: one(categories, { fields: [tickets.categoryId], references: [categories.id] }),
  tags: many(ticketTags),
  messages: many(messages),
  linkedIssues: many(linkedIssues),
  attachments: many(attachments),
}));

export const ticketTagsRelations = relations(ticketTags, ({ one }) => ({
  ticket: one(tickets, { fields: [ticketTags.ticketId], references: [tickets.id] }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  ticket: one(tickets, { fields: [messages.ticketId], references: [tickets.id] }),
  author: one(users, { fields: [messages.authorId], references: [users.id] }),
  attachments: many(attachments),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  tickets: many(tickets),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  ticket: one(tickets, { fields: [attachments.ticketId], references: [tickets.id] }),
  message: one(messages, { fields: [attachments.messageId], references: [messages.id] }),
  uploadedByUser: one(users, { fields: [attachments.uploadedBy], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  invitedByUser: one(users, { fields: [invitations.invitedBy], references: [users.id] }),
  company: one(companies, { fields: [invitations.companyId], references: [companies.id] }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, { fields: [auditLogs.actorId], references: [users.id] }),
}));

export const integrationsRelations = relations(integrations, ({ one, many }) => ({
  createdByUser: one(users, { fields: [integrations.createdBy], references: [users.id] }),
  linkedIssues: many(linkedIssues),
}));

export const linkedIssuesRelations = relations(linkedIssues, ({ one }) => ({
  ticket: one(tickets, { fields: [linkedIssues.ticketId], references: [tickets.id] }),
  integration: one(integrations, { fields: [linkedIssues.integrationId], references: [integrations.id] }),
}));
