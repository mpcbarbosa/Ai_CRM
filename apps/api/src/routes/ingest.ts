import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { calculateScore } from '../scoring/engine';

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
  if (name) {
    return name.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      .substring(0, 50) + '.unknown';
  }
  return 'unknown-' + Date.now();
}

interface NormalizedSignal {
  companyName: string;
  domain: string;
  website?: string;
  country?: string;
  sector?: string;
  size?: string;
  contactName?: string;
  contactEmail?: string;
  contactRole?: string;
  triggerType: string;
  summary?: string;
  sourceUrl?: string;
  estimatedValue?: number;
  urgency?: string;
  score_trigger?: number;
  score_probability?: number;
  score_final?: number;
  raw: Record<string, unknown>;
}

function normalizePayload(agentName: string, body: Record<string, unknown>): NormalizedSignal[] {
  const triggerType = AGENT_TRIGGER_MAP[agentName] || 'GENERIC';

  if (agentName === 'SAP_S4HANA_LeadScanner_Daily' && body.company) {
    const c = body.company as Record<string, unknown>;
    const raw = (body.raw as Record<string, unknown>) || {};
    return [{
      companyName: String(c.name || ''),
      domain: normalizeDomain(c.domain as string, c.name as string),
      website: c.website as string,
      country: c.country as string,
      sector: raw.setor as string,
      triggerType,
      summary: body.summary as string,
      sourceUrl: raw.fonte as string,
      score_trigger: Number(body.score_trigger || 0),
      score_probability: Number(body.score_probability || 0),
      score_final: Number(body.score_final || 0),
      raw: body,
    }];
  }

  if (agentName === 'SAP_S4HANA_CLevelScanner_Daily') {
    const items = Array.isArray(body) ? body : [body];
    return (items as Record<string, unknown>[]).map(item => ({
      companyName: String(item.empresa || ''),
      domain: normalizeDomain(undefined, item.empresa as string),
      country: item.pais as string,
      sector: item.setor as string,
      contactName: item.nome_pessoa as string,
      contactRole: item.cargo_alterado as string,
      triggerType,
      summary: item.impacto_ERP as string,
      sourceUrl: item.fonte as string,
      urgency: String(item.probabilidade || '').toLowerCase() === 'alta' ? 'HIGH' : undefined,
      raw: item,
    }));
  }

  if (agentName === 'SAP_S4HANA_RFPScanner_Daily') {
    const items = Array.isArray(body) ? body : [body];
    return (items as Record<string, unknown>[]).map(item => {
      let estimatedValue: number | undefined;
      if (item.valor_estimado) {
        const cleaned = String(item.valor_estimado).replace(/\s*EUR\s*/i, '').replace(/\./g, '').replace(',', '.');
        const parsed = parseFloat(cleaned);
        if (!isNaN(parsed)) estimatedValue = parsed;
      }
      return {
        companyName: String(item.entidade || ''),
        domain: normalizeDomain(undefined, item.entidade as string),
        country: item.pais as string,
        triggerType,
        summary: item.descricao as string,
        sourceUrl: item.fonte as string,
        estimatedValue,
        urgency: String(item.pertinencia_ERP || '').toLowerCase() === 'alto' ? 'HIGH' : undefined,
        raw: item,
      };
    });
  }

  if (agentName === 'SAP_S4HANA_ExpansionScanner_Daily') {
    const items = Array.isArray(body) ? body : [body];
    return (items as Record<string, unknown>[])
      .filter(item => !!item.empresa)
      .map(item => ({
        companyName: String(item.empresa || ''),
        domain: normalizeDomain(undefined, item.empresa as string),
        country: item.pais as string,
        sector: item.setor as string,
        triggerType,
        summary: item.impacto_ERP as string,
        sourceUrl: item.fonte as string,
        urgency: String(item.probabilidade || '').toLowerCase() === 'alta' ? 'HIGH' : undefined,
        raw: item,
      }));
  }

  if (agentName === 'SAP_S4HANA_LeadScoring_Excel') {
    const items = Array.isArray(body) ? body : [body];
    return (items as Record<string, unknown>[])
      .filter(item => item.empresa && item.empresa !== 'Empresa não identificada')
      .map(item => ({
        companyName: String(item.empresa || ''),
        domain: normalizeDomain(undefined, item.empresa as string),
        country: item.pais as string,
        sector: item.setor as string,
        size: item.tamanho as string,
        triggerType,
        summary: item.resumo as string,
        sourceUrl: item.fonte as string,
        score_trigger: Number(item.score_trigger || 0),
        score_probability: Number(item.score_probabilidade || 0),
        score_final: Number(item.score_final || 0),
        raw: item,
      }));
  }

  const items = Array.isArray(body) ? body : [body];
  return (items as Record<string, unknown>[]).map(item => ({
    companyName: String(item.companyName || item.empresa || item.entidade || item.name || 'Unknown'),
    domain: normalizeDomain(
      (item.domain || item.companyDomain) as string,
      (item.companyName || item.empresa || item.entidade) as string
    ),
    country: (item.country || item.pais) as string,
    sector: (item.sector || item.setor) as string,
    website: (item.website || item.companyWebsite) as string,
    contactName: (item.contactName || item.nome_pessoa) as string,
    contactRole: (item.contactRole || item.cargo_alterado) as string,
    triggerType,
    summary: (item.summary || item.resumo || item.impacto_ERP || item.descricao) as string,
    sourceUrl: (item.sourceUrl || item.url || item.fonte) as string,
    score_trigger: Number(item.score_trigger || 0),
    score_probability: Number(item.score_probabilidade || item.score_probability || 0),
    score_final: Number(item.score_final || 0),
    raw: item,
  }));
}

export async function ingestRoutes(app: FastifyInstance) {
  app.post('/api/ingest/gobii', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const agentName = String(body.agentName || 'UNKNOWN_AGENT');
    const MQL_THRESHOLD = Number(process.env.MQL_THRESHOLD || 70);

    logger.info({ agent: agentName }, 'Gobii ingest received');

    const signals = normalizePayload(agentName, body);

    if (signals.length === 0) {
      return reply.code(200).send({ message: 'No processable records', received: body });
    }

    const results = [];

    for (const signal of signals) {
      try {
        const company = await prisma.company.upsert({
          where: { domain: signal.domain },
          update: {
            name: signal.companyName,
            website: signal.website || undefined,
            country: signal.country || undefined,
            sector: signal.sector || undefined,
            size: signal.size || undefined,
            updatedAt: new Date(),
          },
          create: {
            domain: signal.domain,
            name: signal.companyName,
            website: signal.website || undefined,
            country: signal.country || undefined,
            sector: signal.sector || undefined,
            size: signal.size || undefined,
          },
        });

        if (signal.contactName) {
          await prisma.contact.create({
            data: {
              companyId: company.id,
              name: signal.contactName,
              email: signal.contactEmail || undefined,
              role: signal.contactRole || undefined,
              sourceAgent: agentName,
            },
          }).catch(() => {});
        }

        const scores = (signal.score_final && signal.score_final > 0)
          ? { trigger: signal.score_trigger || 0, probability: signal.score_probability || 0, final: signal.score_final }
          : calculateScore(agentName, signal.triggerType, { ...signal.raw, urgency: signal.urgency });

        if (signal.estimatedValue && signal.estimatedValue > 100000) {
          scores.final = Math.min(scores.final + 10, 150);
        }

        const leadSignal = await prisma.leadSignal.create({
          data: {
            companyId: company.id,
            agentName,
            triggerType: signal.triggerType,
            rawData: signal.raw,
            score_trigger: scores.trigger,
            score_probability: scores.probability,
            score_final: scores.final,
            probability: scores.probability / 100,
            summary: signal.summary || null,
            sourceUrl: signal.sourceUrl || null,
          },
        });

        const since = new Date();
        since.setDate(since.getDate() - 90);
        const recentSignals = await prisma.leadSignal.findMany({
          where: { companyId: company.id, createdAt: { gte: since } },
          select: { score_final: true },
        });
        const totalScore = recentSignals.reduce((sum, s) => sum + s.score_final, 0);

        const currentLead = await prisma.lead.findUnique({ where: { companyId: company.id } });
        let newStatus: 'NEW' | 'MQL' | 'SQL' | 'LOST' = (currentLead?.status as any) || 'NEW';
        if (newStatus !== 'SQL' && newStatus !== 'LOST') {
          if (totalScore >= MQL_THRESHOLD) newStatus = 'MQL';
        }

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
          },
        });

        logger.info({ company: company.domain, totalScore, status: newStatus }, 'Signal processed');

        results.push({
          company: { id: company.id, name: company.name, domain: company.domain },
          signal: { id: leadSignal.id, triggerType: signal.triggerType, score_final: scores.final },
          lead: { id: lead.id, totalScore, status: newStatus },
        });

      } catch (err: any) {
        logger.error({ err: err.message, company: signal.companyName }, 'Error processing signal');
        results.push({ error: err.message, company: signal.companyName });
      }
    }

    return reply.code(201).send({
      processed: results.filter(r => !r.error).length,
      errors: results.filter(r => (r as any).error).length,
      results,
    });
  });
}
