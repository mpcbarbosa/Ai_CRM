import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export async function leadsRoutes(app: FastifyInstance) {
  // GET /api/leads - list all leads with company and last signal
  app.get('/api/leads', async (req, reply) => {
    const { limit = 50, status } = req.query as any;
    const where = status ? { status } : {};
    const leads = await prisma.lead.findMany({
      where,
      take: Number(limit),
      orderBy: { lastActivityDate: 'desc' },
      include: {
        company: {
          include: {
            signals: { orderBy: { createdAt: 'desc' }, take: 1 }
          }
        },
        opportunities: true
      }
    });
    return reply.send({ data: leads, total: leads.length });
  });

  // GET /api/leads/stats - KPI counts for dashboard
  app.get('/api/leads/stats', async (req, reply) => {
    const [total, mql, sql, opportunities, pipeline] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { status: 'MQL' } }),
      prisma.lead.count({ where: { status: 'SQL' } }),
      prisma.opportunity.count(),
      prisma.opportunity.aggregate({ _sum: { estimatedValue: true } })
    ]);
    return reply.send({
      total, mql, sql, opportunities,
      pipeline: pipeline._sum.estimatedValue || 0
    });
  });

  // GET /api/leads/:id - lead detail
  app.get('/api/leads/:id', async (req, reply) => {
    const { id } = req.params as any;
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        company: { include: { contacts: true, signals: { orderBy: { createdAt: 'desc' } } } },
        opportunities: true
      }
    });
    if (!lead) return reply.code(404).send({ error: 'Lead not found' });
    return reply.send(lead);
  });

  // PATCH /api/leads/:id/qualify-sql - Sales qualifies a lead as SQL
  app.patch('/api/leads/:id/qualify-sql', async (req, reply) => {
    const { id } = req.params as any;
    const { owner, estimatedValue, probability } = req.body as any;

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return reply.code(404).send({ error: 'Lead not found' });
    if (lead.status === 'SQL') return reply.send({ message: 'Already SQL', lead });

    // Update lead to SQL
    const updated = await prisma.lead.update({
      where: { id },
      data: {
        status: 'SQL',
        salesQualified: true,
        updatedAt: new Date()
      }
    });

    // Create Opportunity automatically
    const opportunity = await prisma.opportunity.create({
      data: {
        leadId: id,
        companyId: lead.companyId,
        stage: 'DISCOVERY',
        estimatedValue: estimatedValue || null,
        probability: probability || 0.3,
        owner: owner || 'Sales Team'
      }
    });

    logger.info({ leadId: id, opportunityId: opportunity.id }, 'Lead qualified as SQL, Opportunity created');
    return reply.send({ lead: updated, opportunity });
  });
}
