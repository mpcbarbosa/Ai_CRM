import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { LeadStatus, ActivityType } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodemailer = require('nodemailer');

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

  // POST /api/leads/:id/send-email — envio automático via Resend
  app.post('/api/leads/:id/send-email', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { extraRecipients } = req.body as { extraRecipients?: string[] };

      // Carregar lead completo
      const lead = await prisma.lead.findUnique({
        where: { id },
        include: {
          company: { include: { signals: { orderBy: { createdAt: 'desc' }, take: 5 } } },
          activities: { orderBy: { createdAt: 'desc' }, take: 3 },
          opportunities: true,
        },
      });
      if (!lead) return reply.status(404).send({ error: 'Lead not found' });

      // Carregar destinatários das settings
      const settingRow = await prisma.setting.findUnique({ where: { key: 'emailRecipients' } });
      const defaultRecipients: string[] = settingRow?.value
        ? settingRow.value.split(',').map((e: string) => e.trim()).filter(Boolean)
        : [];
      const allRecipients = [...defaultRecipients, ...(extraRecipients || [])].filter(Boolean);

      if (allRecipients.length === 0) {
        return reply.status(400).send({ error: 'Nenhum destinatário configurado. Adiciona emails em ⚙️ Configurações.' });
      }

      const c = lead.company as any;
      const signals = (c?.signals || []).map((s: any) =>
        `<li><strong>[${s.type}]</strong> ${s.title || s.type} — score: ${s.score || 0}</li>`
      ).join('');

      const scoreColor = (lead.totalScore || 0) >= 100 ? '#16a34a' : (lead.totalScore || 0) >= 70 ? '#2563eb' : '#64748b';
      const statusColors: Record<string, string> = {
        NEW: '#475569', UNDER_QUALIFICATION: '#b45309', MQL: '#1d4ed8', SQL: '#15803d', DISCARDED: '#7f1d1d'
      };
      const statusColor = statusColors[lead.status] || '#475569';

      const html = `
        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 12px; overflow: hidden;">
          <div style="background: #1e293b; padding: 24px 32px; border-bottom: 1px solid #334155;">
            <span style="font-size: 20px; font-weight: 800;">Ai CRM</span>
            <span style="background: #7c3aed; color: white; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; margin-left: 10px;">Gobii Intelligence</span>
          </div>
          <div style="padding: 32px;">
            <div style="margin-bottom: 24px;">
              <h1 style="color: #f8fafc; font-size: 24px; font-weight: 800; margin: 0 0 8px 0;">${c?.name || 'N/A'}</h1>
              <span style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 700;">${lead.status}</span>
            </div>
            <div style="margin-bottom: 24px;">
              <div style="background: #1e293b; border-radius: 8px; padding: 16px; display: inline-block; margin-right: 12px;">
                <div style="color: #64748b; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">Score Total</div>
                <div style="color: ${scoreColor}; font-size: 28px; font-weight: 800;">${lead.totalScore || 0}</div>
              </div>
              <div style="background: #1e293b; border-radius: 8px; padding: 16px; display: inline-block;">
                <div style="color: #64748b; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">Sinais</div>
                <div style="color: #f8fafc; font-size: 28px; font-weight: 800;">${c?.signals?.length || 0}</div>
              </div>
            </div>
            <div style="background: #1e293b; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
              <div style="color: #64748b; font-size: 11px; text-transform: uppercase; margin-bottom: 12px;">Informacao da Empresa</div>
              ${c?.sector ? `<div style="margin-bottom: 8px;"><span style="color: #64748b; font-size: 12px;">Sector:</span> <span style="color: #f8fafc; font-size: 13px;">${c.sector}</span></div>` : ''}
              ${c?.country ? `<div style="margin-bottom: 8px;"><span style="color: #64748b; font-size: 12px;">Pais:</span> <span style="color: #f8fafc; font-size: 13px;">${c.country}</span></div>` : ''}
              ${c?.size ? `<div style="margin-bottom: 8px;"><span style="color: #64748b; font-size: 12px;">Tamanho:</span> <span style="color: #f8fafc; font-size: 13px;">${c.size}</span></div>` : ''}
              ${(c?.website || c?.domain) ? `<div style="margin-bottom: 8px;"><span style="color: #64748b; font-size: 12px;">Website:</span> <span style="color: #7c3aed; font-size: 13px;">${c.website || c.domain}</span></div>` : ''}
            </div>
            ${signals ? `
            <div style="background: #1e293b; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <div style="color: #64748b; font-size: 11px; text-transform: uppercase; margin-bottom: 12px;">Sinais Recentes</div>
              <ul style="margin: 0; padding-left: 16px; color: #f8fafc; font-size: 13px; line-height: 1.8;">${signals}</ul>
            </div>` : ''}
            <a href="https://ai-crm-web-4blo.onrender.com/leads/${lead.id}"
              style="display: block; background: #7c3aed; color: white; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px;">
              Ver Lead no CRM
            </a>
          </div>
          <div style="background: #1e293b; padding: 16px 32px; text-align: center; color: #475569; font-size: 11px; border-top: 1px solid #334155;">
            Gobii AI CRM - Enviado automaticamente
          </div>
        </div>
      `;

      const gmailUser = process.env.GMAIL_USER;
      const gmailPass = process.env.GMAIL_APP_PASSWORD;
      if (!gmailUser || !gmailPass) {
        return reply.status(500).send({ error: 'GMAIL_USER ou GMAIL_APP_PASSWORD nao configurados no Render.' });
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass },
      });

      await transporter.sendMail({
        from: `Gobii AI CRM <${gmailUser}>`,
        to: allRecipients.join(', '),
        subject: `[Gobii CRM] ${c?.name || 'Lead'} - ${lead.status} | Score: ${lead.totalScore || 0}`,
        html,
      });

      logger.info({ recipients: allRecipients }, 'Email sent successfully via Gmail');
      return reply.send({ success: true, recipients: allRecipients });

    } catch (err: any) {
      logger.error({ err: err?.message || err }, 'send-email unexpected error');
      return reply.status(500).send({ error: 'Erro inesperado', detail: err?.message || String(err) });
    }
  });

  // GET /api/debug/email — diagnóstico do sistema de email
  app.get('/api/debug/email', async (req, reply) => {
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    return reply.send({
      gmail_user_configured: !!gmailUser,
      gmail_user: gmailUser || null,
      gmail_pass_configured: !!gmailPass,
      node_version: process.version,
    });
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

  // POST /api/leads/:id/enrich — Apollo.io enrichment
  app.post('/api/leads/:id/enrich', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const apiKey = process.env.APOLLO_API_KEY;
      if (!apiKey) return reply.status(500).send({ error: 'APOLLO_API_KEY nao configurada no Render.' });

      const lead = await prisma.lead.findUnique({
        where: { id },
        include: { company: { include: { contacts: true } } },
      });
      if (!lead) return reply.status(404).send({ error: 'Lead not found' });

      const company = lead.company as any;
      const domain = company.domain || company.website?.replace(/^https?:\/\//, '').split('/')[0];
      if (!domain) return reply.status(400).send({ error: 'Empresa sem dominio para enriquecer.' });

      // 1. Enriquecer empresa
      const orgRes = await fetch('https://api.apollo.io/api/v1/organizations/enrich?domain=' + domain, {
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      });
      const orgData = await orgRes.json() as any;
      const org = orgData.organization;

      if (org) {
        await prisma.company.update({
          where: { id: company.id },
          data: {
            sector: org.industry || company.sector || undefined,
            size: org.employee_count ? String(org.employee_count) : company.size || undefined,
            employeeCount: org.employee_count || undefined,
            revenue: org.annual_revenue_printed || org.revenue_range || undefined,
            linkedinUrl: org.linkedin_url || undefined,
            website: org.website_url || company.website || undefined,
            country: org.country || company.country || undefined,
            description: org.short_description || company.description || undefined,
            technologies: org.current_technologies?.map((t: any) => t.name).slice(0, 20) || [],
            enrichedAt: new Date(),
          },
        });
        logger.info({ companyId: company.id, org: org.name }, 'Company enriched via Apollo');
      }

      // 2. Enriquecer contactos — buscar pessoas na empresa
      const peopleRes = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_domains: [domain],
          person_titles: ['CEO', 'CFO', 'CTO', 'COO', 'CIO', 'VP', 'Director', 'Head', 'Manager'],
          per_page: 10,
        }),
      });
      const peopleData = await peopleRes.json() as any;
      const people = peopleData.people || [];

      let newContacts = 0;
      for (const person of people) {
        if (!person.name) continue;
        const existing = company.contacts?.find((c: any) => c.name === person.name || (c.email && c.email === person.email));
        if (!existing) {
          await prisma.contact.create({
            data: {
              companyId: company.id,
              name: person.name,
              email: person.email || null,
              role: person.title || null,
              linkedin: person.linkedin_url || null,
              seniority: person.seniority || null,
              sourceAgent: 'Apollo',
            },
          });
          newContacts++;
        }
      }

      // Audit log
      await prisma.auditLog.create({
        data: {
          leadId: lead.id,
          userName: 'Sistema',
          action: 'COMPANY_EDITED',
          details: {
            source: 'Apollo',
            domain,
            enriched: !!org,
            newContacts,
            technologies: org?.current_technologies?.length || 0,
          },
        },
      });

      const updatedLead = await prisma.lead.findUnique({
        where: { id },
        include: { company: { include: { contacts: true, signals: { orderBy: { createdAt: 'desc' } } } } },
      });

      return reply.send({
        success: true,
        enriched: !!org,
        newContacts,
        technologies: org?.current_technologies?.length || 0,
        lead: updatedLead,
      });

    } catch (err: any) {
      logger.error({ err: err?.message }, 'Apollo enrichment error');
      return reply.status(500).send({ error: 'Erro no enriquecimento', detail: err?.message });
    }
  });
}

// This is appended - will be integrated properly
