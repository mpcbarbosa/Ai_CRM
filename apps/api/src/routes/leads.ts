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
    const filtered = leads.filter((l: any) => {
      const sig = l.company?.signals?.[0];
      return !sig || sig.triggerType !== 'SECTOR_INVESTMENT';
    });
    return reply.send(filtered);
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


  // GET /api/leads/:id/audit - full audit timeline
  app.get('/api/leads/:id/audit', async (req, reply) => {
    const { id } = req.params as { id: string };
    const logs = await prisma.auditLog.findMany({
      where: { leadId: id },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(logs);
  });

  // GET /api/leads/:id/score-history - score evolution
  app.get('/api/leads/:id/score-history', async (req, reply) => {
    const { id } = req.params as { id: string };
    const history = await prisma.scoreHistory.findMany({
      where: { leadId: id },
      orderBy: { createdAt: 'asc' },
    });
    return reply.send(history);
  });

  // PATCH /api/leads/:id - update lead fields (notes, tags, assignedTo, lostReason)
  app.patch('/api/leads/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { notes, tags, assignedToId, lostReason } = req.body as {
      notes?: string;
      tags?: string[];
      assignedToId?: string;
      lostReason?: string;
    };
    const userName = (req.headers['x-user-name'] as string) || 'System_GobiiAgent';
    const userId = (req.headers['x-user-id'] as string) || null;

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        notes: notes ?? undefined,
        tags: tags ?? undefined,
        assignedToId: assignedToId ?? undefined,
        lostReason: lostReason ?? undefined,
        updatedAt: new Date(),
      },
    });

    if (assignedToId) {
      const assignedUser = await prisma.user.findUnique({ where: { id: assignedToId } });
      await prisma.auditLog.create({
        data: {
          leadId: id,
          userId: userId || null,
          userName,
          action: 'LEAD_ASSIGNED',
          details: { assignedTo: assignedUser?.name || assignedToId },
        },
      });
    }
    if (notes !== undefined) {
      await prisma.auditLog.create({
        data: {
          leadId: id,
          userId: userId || null,
          userName,
          action: 'NOTE_ADDED',
          details: { notes },
        },
      });
    }
    if (tags !== undefined) {
      await prisma.auditLog.create({
        data: {
          leadId: id,
          userId: userId || null,
          userName,
          action: 'LEAD_TAGGED',
          details: { tags },
        },
      });
    }

    return reply.send(lead);
  });

  // GET /api/users - list users
  app.get('/api/users', async (req, reply) => {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return reply.send(users);
  });

  // POST /api/users - create user
  app.post('/api/users', async (req, reply) => {
    const { email, name, role } = req.body as { email: string; name: string; role?: string };
    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: (role as any) || 'COMMERCIAL',
      },
    });
    return reply.code(201).send(user);
  });

  // PATCH /api/leads/:id/status with audit
    app.patch('/api/leads/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status, lostReason } = req.body as { status: LeadStatus; lostReason?: string };
    const userName = (req.headers['x-user-name'] as string) || 'System_GobiiAgent';
    const userId = (req.headers['x-user-id'] as string) || null;

    const currentLead = await prisma.lead.findUnique({ where: { id } });
    const previousStatus = currentLead?.status;

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        status,
        salesQualified: status === 'SQL',
        marketingQualified: status === 'MQL' || status === 'SQL',
        lostReason: (status === 'DISCARDED' ? lostReason : undefined) ?? undefined,
        updatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        leadId: id,
        userId: userId || null,
        userName,
        action: 'STATUS_CHANGED',
        details: { from: previousStatus, to: status, lostReason: lostReason || null },
      },
    });

    if (status === 'MQL' || status === 'SQL' || status === 'UNDER_QUALIFICATION') {
      await prisma.auditLog.create({
        data: {
          leadId: id,
          userId: userId || null,
          userName,
          action: 'LEAD_QUALIFIED',
          details: { status, qualifiedAt: new Date().toISOString() },
        },
      });
    }

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
    const aUserName = (req.headers['x-user-name'] as string) || createdBy || 'System_GobiiAgent';
    const aUserId = (req.headers['x-user-id'] as string) || null;
    await prisma.auditLog.create({
      data: {
        leadId: id,
        userId: aUserId || null,
        userName: aUserName,
        action: 'ACTIVITY_CREATED',
        details: { type, title, notes: notes || null },
      },
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

    // Capture previous values
    const before = await prisma.company.findUnique({ where: { id } });

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

    // Build diff
    const fields = req.body as Record<string, string>;
    const changes: Record<string, { before: any; after: any }> = {};
    for (const key of Object.keys(fields)) {
      const beforeVal = (before as any)?.[key];
      const afterVal = (company as any)[key];
      if (beforeVal !== afterVal) {
        changes[key] = { before: beforeVal ?? null, after: afterVal ?? null };
      }
    }
    const cUserName = (req.headers['x-user-name'] as string) || 'System_GobiiAgent';
    const cUserId = (req.headers['x-user-id'] as string) || null;
    const companyLead = await prisma.lead.findUnique({ where: { companyId: id } });
    if (companyLead) {
      await prisma.auditLog.create({
        data: {
          leadId: companyLead.id,
          userId: cUserId || null,
          userName: cUserName,
          action: 'COMPANY_EDITED',
          details: { fields: Object.keys(req.body as object), values: req.body as Record<string, unknown> } as any,
        },
      });
    }
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

  app.post('/api/admin/resolve-migration', async (req, reply) => {
    // Resolve failed migration 20260221000002 by marking it as rolled back
    await prisma.$executeRawUnsafe(`
      UPDATE "_prisma_migrations" 
      SET rolled_back_at = NOW(), finished_at = NULL
      WHERE migration_name = '20260221000002_update_lead_status'
      AND rolled_back_at IS NULL
    `);
    return reply.send({ message: 'Migration marked as rolled back, redeploy to re-apply' });
  });

  app.post('/api/admin/reset', async (req, reply) => {
    const secret = process.env.RESET_SECRET;
    const { confirm } = req.body as { confirm?: string };
    if (secret && confirm !== secret) {
      return reply.code(401).send({ error: 'Invalid confirm secret' });
    }
    await prisma.auditLog.deleteMany();
    await prisma.scoreHistory.deleteMany();
    await prisma.activity.deleteMany();
    await prisma.opportunity.deleteMany();
    await prisma.leadSignal.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.contact.deleteMany();
    await prisma.company.deleteMany();
    logger.warn('Database reset by admin');
    return reply.send({ message: 'Database cleared successfully' });
  });
}
