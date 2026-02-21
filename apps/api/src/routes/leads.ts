import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { LeadStatus, ActivityType } from '@prisma/client';

export async function leadsRoutes(app: FastifyInstance) {
  app.get('/api/leads', async (req, reply) => {
    const leads = await prisma.lead.findMany({
      include: {
        company: {
          include: {
            signals: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
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
        company: {
          include: {
            contacts: true,
            signals: { orderBy: { createdAt: 'desc' } },
          },
        },
        opportunities: { orderBy: { createdAt: 'desc' } },
        activities: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!lead) return reply.code(404).send({ error: 'Not found' });
    return reply.send(lead);
  });

  app.patch('/api/leads/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: LeadStatus };
    const lead = await prisma.lead.update({
      where: { id },
      data: {
        status,
        salesQualified: status === 'SQL',
        marketingQualified: status === 'MQL' || status === 'SQL',
        updatedAt: new Date(),
      },
    });
    return reply.send(lead);
  });

  app.post('/api/leads/:id/activities', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { type, title, notes, createdBy } = req.body as {
      type: ActivityType;
      title: string;
      notes?: string;
      createdBy?: string;
    };
    const activity = await prisma.activity.create({
      data: {
        leadId: id,
        type,
        title,
        notes: notes || null,
        createdBy: createdBy || null,
      },
    });
    await prisma.lead.update({
      where: { id },
      data: { lastActivityDate: new Date(), updatedAt: new Date() },
    });
    return reply.code(201).send(activity);
  });

  app.get('/api/leads/:id/activities', async (req, reply) => {
    const { id } = req.params as { id: string };
    const activities = await prisma.activity.findMany({
      where: { leadId: id },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(activities);
  });

  app.delete('/api/leads/:id/activities/:activityId', async (req, reply) => {
    const { activityId } = req.params as { id: string; activityId: string };
    await prisma.activity.delete({ where: { id: activityId } });
    return reply.send({ deleted: true });
  });

  app.post('/api/leads/:id/opportunities', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { stage, estimatedValue, probability, owner } = req.body as {
      stage?: string;
      estimatedValue?: number;
      probability?: number;
      owner?: string;
    };
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return reply.code(404).send({ error: 'Lead not found' });
    const opp = await prisma.opportunity.create({
      data: {
        leadId: id,
        companyId: lead.companyId,
        stage: (stage as any) || 'DISCOVERY',
        estimatedValue: estimatedValue || null,
        probability: probability || null,
        owner: owner || null,
      },
    });
    return reply.code(201).send(opp);
  });

  app.patch('/api/leads/:id/opportunities/:oppId', async (req, reply) => {
    const { oppId } = req.params as { id: string; oppId: string };
    const data = req.body as Record<string, unknown>;
    const opp = await prisma.opportunity.update({
      where: { id: oppId },
      data,
    });
    return reply.send(opp);
  });

  app.get('/api/stats', async (req, reply) => {
    const [total, mql, sql, signals, oppResult] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { status: 'MQL' } }),
      prisma.lead.count({ where: { status: 'SQL' } }),
      prisma.leadSignal.count(),
      prisma.opportunity.aggregate({ _sum: { estimatedValue: true }, _count: true }),
    ]);
    return reply.send({
      total,
      mql,
      sql,
      signals,
      opportunities: oppResult._count,
      pipeline: oppResult._sum.estimatedValue || 0,
    });
  });

  app.get('/api/signals', async (req, reply) => {
    const query = req.query as Record<string, string>;
    const where = query.triggerType ? { triggerType: query.triggerType } : {};
    const signals = await prisma.leadSignal.findMany({
      where,
      include: { company: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return reply.send(signals);
  });

  
  // PATCH /api/companies/:id - edit company info
  app.patch('/api/companies/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { website, country, sector, size, description } = req.body as {
      website?: string;
      country?: string;
      sector?: string;
      size?: string;
      description?: string;
    };
    const company = await prisma.company.update({
      where: { id },
      data: {
        website: website ?? undefined,
        country: country ?? undefined,
        sector: sector ?? undefined,
        size: size ?? undefined,
        description: description ?? undefined,
        updatedAt: new Date(),
      },
    });
    return reply.send(company);
  });

  // GET /api/sectors - list sector investment signals
  app.get('/api/sectors', async (req, reply) => {
    const query = req.query as Record<string, string>;
    const limit = Number(query.limit || 100);
    const sectors = await prisma.leadSignal.findMany({
      where: { triggerType: 'SECTOR_INVESTMENT' },
      include: { company: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return reply.send({ sectors });
  });

  app.post('/api/admin/reset', async (req, reply) => {
    const secret = process.env.RESET_SECRET;
    const { confirm } = req.body as { confirm?: string };
    if (secret && confirm !== secret) {
      return reply.code(401).send({ error: 'Invalid confirm secret' });
    }
    await prisma.activity.deleteMany();
    await prisma.leadSignal.deleteMany();
    await prisma.opportunity.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.contact.deleteMany();
    await prisma.company.deleteMany();
    logger.warn('Database reset by admin');
    return reply.send({ message: 'Database cleared successfully' });
  });
}
