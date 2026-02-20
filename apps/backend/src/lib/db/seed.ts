import { db } from './index';
import { users, categories, tickets, messages, ticketTags } from './schema';
import { hashPassword } from '../../auth/password';

async function seed() {
  console.log('Seeding database...');

  // Create users
  const adminPassword = await hashPassword('admin123');
  const agentPassword = await hashPassword('agent123');
  const customerPassword = await hashPassword('customer123');

  const [admin] = await db
    .insert(users)
    .values({
      email: 'admin@helpdesk.com',
      passwordHash: adminPassword,
      name: 'Admin User',
      role: 'admin',
    })
    .onConflictDoNothing()
    .returning();

  const [agent] = await db
    .insert(users)
    .values({
      email: 'agent@helpdesk.com',
      passwordHash: agentPassword,
      name: 'Support Agent',
      role: 'agent',
    })
    .onConflictDoNothing()
    .returning();

  const [developer] = await db
    .insert(users)
    .values({
      email: 'dev@helpdesk.com',
      passwordHash: agentPassword,
      name: 'Developer',
      role: 'developer',
    })
    .onConflictDoNothing()
    .returning();

  const [customer] = await db
    .insert(users)
    .values({
      email: 'customer@example.com',
      passwordHash: customerPassword,
      name: 'John Customer',
      role: 'customer',
    })
    .onConflictDoNothing()
    .returning();

  if (!admin || !agent || !developer || !customer) {
    console.log('Users already exist, skipping...');
    process.exit(0);
  }

  console.log('Created users:', { admin: admin.email, agent: agent.email, customer: customer.email });

  // Create categories
  const [catBug] = await db
    .insert(categories)
    .values({ name: 'Bug Report', description: 'Something is not working correctly' })
    .returning();

  const [catFeature] = await db
    .insert(categories)
    .values({ name: 'Feature Request', description: 'Request for new functionality' })
    .returning();

  const [catQuestion] = await db
    .insert(categories)
    .values({ name: 'Question', description: 'General questions and help' })
    .returning();

  const [catBilling] = await db
    .insert(categories)
    .values({ name: 'Billing', description: 'Payment and billing issues' })
    .returning();

  if (!catBug || !catFeature || !catQuestion || !catBilling) {
    throw new Error('Failed to create categories');
  }

  console.log('Created categories');

  // Create tickets
  const [ticket1] = await db
    .insert(tickets)
    .values({
      title: 'Cannot login to dashboard',
      description: 'I keep getting a 500 error when trying to login. This started happening after the latest update.',
      status: 'open',
      priority: 'high',
      customerId: customer.id,
      categoryId: catBug.id,
    })
    .returning();

  const [ticket2] = await db
    .insert(tickets)
    .values({
      title: 'Add dark mode support',
      description: 'It would be great to have a dark mode option for the dashboard.',
      status: 'in_progress',
      priority: 'medium',
      customerId: customer.id,
      assignedAgentId: agent.id,
      categoryId: catFeature.id,
    })
    .returning();

  const [ticket3] = await db
    .insert(tickets)
    .values({
      title: 'How to export data?',
      description: 'Is there a way to export my data as CSV?',
      status: 'resolved',
      priority: 'low',
      customerId: customer.id,
      assignedAgentId: agent.id,
      categoryId: catQuestion.id,
    })
    .returning();

  if (!ticket1 || !ticket2 || !ticket3) {
    throw new Error('Failed to create tickets');
  }

  console.log('Created tickets');

  // Add tags
  await db.insert(ticketTags).values([
    { ticketId: ticket1.id, tag: 'login' },
    { ticketId: ticket1.id, tag: 'critical' },
    { ticketId: ticket2.id, tag: 'ui' },
    { ticketId: ticket2.id, tag: 'enhancement' },
  ]);

  // Add messages
  await db.insert(messages).values([
    {
      ticketId: ticket1.id,
      authorId: customer.id,
      body: 'This is really urgent, I cannot access my account at all!',
    },
    {
      ticketId: ticket1.id,
      authorId: agent.id,
      body: 'Hi John, I can see the issue. Let me investigate the server logs.',
    },
    {
      ticketId: ticket1.id,
      authorId: agent.id,
      body: 'Found the root cause - the auth service crashed after deployment.',
      isInternal: true,
    },
    {
      ticketId: ticket2.id,
      authorId: agent.id,
      body: 'Thanks for the suggestion! We have added this to our roadmap.',
    },
    {
      ticketId: ticket3.id,
      authorId: agent.id,
      body: 'Yes! Go to Settings > Export and you can download CSV files.',
    },
    {
      ticketId: ticket3.id,
      authorId: customer.id,
      body: 'Found it, thank you!',
    },
  ]);

  console.log('Created messages');
  console.log('Seed completed successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
