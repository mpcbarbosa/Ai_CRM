import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { calculateScore } from '../scoring/engine';

// Agent name → trigger type mapping
const AGENT_TRIGGER_MAP: Record<string, string> = {
  'SAP_S4HANA_SectorInvestmentScanner_Daily': 'SECTOR_INVESTMENT',
  'SAP_S4HANA_RFPScanner_Daily': 'RFP_SIGNAL',
  'SAP_S4HANA_ExpansionScanner_Daily': 'EXPANSION_SIGNAL',
  'SAP_S4HANA_CLevelScanner_Daily': 'CLEVEL_CHANGE',
  'SAP_S4HANA_LeadScanner_Daily': 'LEAD_SCAN',
  'SAP_S4HANA_LeadScoring_Excel': 'EXCEL_SCORE',
};

function normalizeDomain(domain?: string, name?: string): string {
  if (domain) return domain.toLowerCase().replace(/^www\./, '').trim();
  if (name) return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').trim() + '.unknown';
  return 'unknown-' + Date.now();
}

export async function ingestRoutes(app: FastifyInstance) {
  app.post('/api/ingest/gobii', async (req, reply) => {
    const body = req.body as any;
    const MQL_THRESHOLD = Number(process.env.MQL_THRESHOLD || 70);

    logger.info({ agent: body.agentName, company: body.companyName }, 'Ingest received');

    // 1. Normalize
    const domain = normalizeDomain(body.domain || body.companyDomain, body.companyName || body.name);
    const agentName = body.agentName || 'UNKNOWN_AGENT';
    const triggerType = AGENT_TRIGGER_MAP[agentName] || body.triggerType || 'GENERIC';

    // 2. Upsert Company (deduplicate by domain)
    const company = await prisma.company.upsert({
      where: { domain },
      update: {
        name: body.companyName || body.name || domain,
        website: body.website || body.companyWebsite || undefined,
        country: body.country || undefined,
        sector: body.sector || body.industry || undefined,
        size: body.companySize || body.size || undefined,
        description: body.description || undefined,
        updatedAt: new Date(),
      },
      create: {
        domain,
        name: body.companyName || body.name || domain,
        website: body.website || body.companyWebsite || undefined,
        country: body.country || undefined,
        sector: body.sector || body.industry || undefined,
        size: body.companySize || body.size || undefined,
        description: body.description || undefined,
      }
    });

    // 3. Create Contact if present
    if (body.contactName || body.contactEmail) {
      await prisma.contact.create({
        data: {
          companyId: company.id,
          name: body.contactName || 'Unknown',
          email: body.contactEmail || undefined,
          role: body.contactRole || body.contactTitle || undefined,
          sourceAgent: agentName,
        }
      }).catch(() => {}); // ignore duplicate contacts
    }

    // 4. Calculate scores
    const scores = calculateScore(agentName, triggerType, body);

    // 5. Create LeadSignal (always, never lose raw data)
    const signal = await prisma.leadSignal.create({
      data: {
        companyId: company.id,
        agentName,
        triggerType,
        rawData: body,
        score_trigger: scores.trigger,
        score_probability: scores.probability,
        score_final: scores.final,
        probability: scores.probability / 100,
        summary: body.summary || body.description || null,
        sourceUrl: body.sourceUrl || body.url || null,
      }
    });

    // 6. Compute cumulative score (last 90 days)
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const recentSignals = await prisma.leadSignal.findMany({
      where: { companyId: company.id, createdAt: { gte: since } },
      select: { score_final: true }
    });
    const totalScore = recentSignals.reduce((sum, s) => sum + s.score_final, 0);

    // 7. Determine new lead status
    const currentLead = await prisma.lead.findUnique({ where: { companyId: company.id } });
    let newStatus: 'NEW' | 'MQL' | 'SQL' | 'LOST' = currentLead?.status as any || 'NEW';
    
    // Only auto-upgrade (never downgrade SQL/LOST)
    if (newStatus !== 'SQL' && newStatus !== 'LOST') {
      if (totalScore >= MQL_THRESHOLD) newStatus = 'MQL';
    }

    // 8. Upsert Lead
    const lead = await prisma.lead.upsert({
      where: { companyId: company.id },
      update: {
        totalScore,
        status: newStatus,
        marketingQualified: newStatus === 'MQL' || newStatus === 'SQL',
        lastActivityDate: new Date(),
        updatedAt: new Date(),
      },
      create: {
        companyId: company.id,
        totalScore,
        status: newStatus,
        marketingQualified: newStatus === 'MQL' || newStatus === 'SQL',
        lastActivityDate: new Date(),
      }
    });

    logger.info({ companyId: company.id, totalScore, newStatus, signalId: signal.id }, 'Ingest processed');

    return reply.code(201).send({
      company: { id: company.id, name: company.name, domain: company.domain },
      signal: { id: signal.id, triggerType, score_final: scores.final },
      lead: { id: lead.id, totalScore, status: newStatus },
    });
  });
}
