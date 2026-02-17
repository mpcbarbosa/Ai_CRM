import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';

export async function leadsRoutes(app: FastifyInstance) {
  // GET all leads with company info
  app.get('/api/leads', async (request, reply) => {
    const leads = await prisma.lead.findMany({
      include: {
        company: true,
        opportunities: true,
      },
      orderBy: { totalScore: 'desc' },
    });
    return reply.send(leads);
  });

  // GET dashboard stats
  app.get('/api/stats', async (request, reply) => {
    const [total, mql, sql, opportunities] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { status: 'MQL' } }),
      prisma.lead.count({ where: { status: 'SQL' } }),
      prisma.opportunity.findMany(),
    ]);

    const pipeline = opportunities.reduce((sum, o) => sum + (o.estimatedValue || 0), 0);

    return reply.send({ total, mql, sql, opportunities: opportunities.length, pipeline });
  });

  // PATCH lead status (for manual SQL qualification)
  app.patch('/api/leads/:id/qualify', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        status: status as any,
        salesQualified: status === 'SQL',
        updatedAt: new Date(),
      },
    });

    // Auto-create opportunity if moving to SQL
    if (status === 'SQL') {
      const existing = await prisma.opportunity.findFirst({ where: { leadId: id } });
      if (!existing) {
        await prisma.opportunity.create({
          data: { leadId: id, companyId: lead.companyId, stage: 'DISCOVERY', probability: 25 },
        });
      }
    }

    return reply.send(lead);
  });
}
