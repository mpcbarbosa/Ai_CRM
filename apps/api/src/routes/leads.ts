import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export async function leadsRoutes(app: FastifyInstance) {
  app.get('/api/leads', async (req, reply) => {
    const leads = await prisma.lead.findMany({
      include: {
        company: true,
        signals: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { totalScore: 'desc' },
    });
    return reply.send(leads);
  });

  app.get('/api/leads/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        company: { include: { contacts: true } },
        signals: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!lead) return reply.code(404).send({ error: 'Not found' });
    return reply.send(lead);
  });

  app.patch('/api/leads/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: string };
    const lead = await prisma.lead.update({
      where: { id },
      data: { status, updatedAt: new Date() },
    });
    return reply.send(lead);
  });

  app.get('/api/stats', async (req, reply) => {
    const [total, mql, sql, signals] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { status: 'MQL' } }),
      prisma.lead.count({ where: { status: 'SQL' } }),
      prisma.leadSignal.count(),
    ]);
    return reply.send({ total, mql, sql, signals });
  });

  // Admin reset — clears all data
  app.post('/api/admin/reset', async (req, reply) => {
    const secret = process.env.RESET_SECRET;
    const { confirm } = req.body as { confirm?: string };
    if (secret && confirm !== secret) {
      return reply.code(401).send({ error: 'Invalid confirm secret' });
    }
    await prisma.leadSignal.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.contact.deleteMany();
    await prisma.company.deleteMany();
    logger.warn('Database reset by admin');
    return reply.send({ message: 'Database cleared successfully' });
  });
}
