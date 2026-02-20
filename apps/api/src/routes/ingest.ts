import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { calculateScore } from '../scoring/engine';
import { Prisma } from '@prisma/client';

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
  return '';
}

function extractArray(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  const b = body as Record<string, unknown>;
  for (const key of ['findings', 'leads', 'results', 'data', 'items', 'records', 'sectors', 'signals']) {
    if (Array.isArray(b[key])) return b[key] as Record<string, unknown>[];
  }
  return [b];
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

function isValidSignal(s: NormalizedSignal): boolean {
  if (s.triggerType === 'SECTOR_INVESTMENT') return !!(s.companyName && s.domain);
  return !!(s.companyName && s.companyName !== 'Unknown' && s.companyName !== '-' && s.domain);
}

function normalizePayload(agentName: string, body: unknown): NormalizedSignal[] {
  const triggerType = AGENT_TRIGGER_MAP[agentName] || 'GENERIC';

  if (agentName === 'SAP_S4HANA_LeadScanner_Daily') {
    const b = body as Record<string, unknown>;
    const leadsArray = Array.isArray(b.leads) ? b.leads as Record<string, unknown>[] : null;

    if (leadsArray) {
      return leadsArray.map(item => {
        const c = (item.company || {}) as Record<string, unknown>;
        const raw = (item.raw || {}) as Record<string, unknown>;
        return {
          companyName: String(c.name || ''),
          domain: normalizeDomain(c.domain as string, c.name as string),
          website: c.website as string,
          country: c.country as string,
          sector: raw.setor as string,
          triggerType,
          summary: item.summary as string,
          sourceUrl: raw.fonte as string,
          score_trigger: Number(item.score_trigger || 0),
          score_probability: Number(item.score_probability || 0),
          score_final: Number(item.score_final || 0),
          raw: item,
        };
      });
    }

    if (b.company) {
      const c = b.company as Record<string, unknown>;
      const raw = (b.raw as Record<string, unknown>) || {};
      return [{
        companyName: String(c.name || ''),
        domain: normalizeDomain(c.domain as string, c.name as string),
        website: c.website as string,
        country: c.country as string,
        sector: raw.setor as string,
        triggerType,
        summary: b.summary as string,
        sourceUrl: raw.fonte as string,
        score_trigger: Number(b.score_trigger || 0),
        score_probability: Number(b.score_probability || 0),
        score_final: Number(b.score_final || 0),
        raw: b,
      }];
    }
  }

  if (agentName === 'SAP_S4HANA_CLevelScanner_Daily') {
    return extractArray(body).map(item => ({
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
    return extractArray(body).map(item => {
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
    return extractArray(body)
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
    return extractArray(body)
      .filter(item => item.empresa && item.empresa !== 'Empresa n\u00e3o identificada')
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

  if (agentName === 'SAP_S4HANA_SectorInvestmentScanner_Daily') {
    return extractArray(body)
      .filter(item => !!item.setor)
      .map(item => ({
        companyName: String(item.setor || ''),
        domain: normalizeDomain(undefined, item.setor as string),
        sector: item.setor as string,
        country: 'Portugal',
        triggerType,
        summary: item.noticias_relevantes as string,
        sourceUrl: item.fonte_principal as string,
        urgency: String(item.probabilidade_ERP || '').toLowerCase() === 'alto' ? 'HIGH' : undefined,
        raw: item,
      }));
  }

  return extractArray(body).map(item => ({
    companyName: String(item.companyName || item.empresa || item.entidade || item.name || ''),
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
    const gobiiToken = process.env.GOBII_WEBHOOK_TOKEN;
    if (gobiiToken) {
      const provided = (req.headers['x-gobii-token'] as string)
        || (req.headers['x-webhook-token'] as string)
        || (req.headers['authorization'] as string)?.replace('Bearer ', '');
      if (provided !== gobiiToken) {
        logger.warn({ provided }, 'Unauthorized webhook attempt');
      }
    }

    const query = req.query as Record<string, string>;
    const body = req.body as Record<string, unknown>;
    const agentName = query.agent || String(body?.agentName || 'UNKNOWN_AGENT');
    const MQL_THRESHOLD = Number(process.env.MQL_THRESHOLD || 70);

    logger.info({ agent: agentName }, 'Gobii ingest received');

    const allSignals = normalizePayload(agentName, req.body);
    const signals = allSignals.filter(isValidSignal);
    const skipped = allSignals.length - signals.length;

    if (skipped > 0) {
      logger.warn({ agent: agentName, skipped }, 'Skipped records without company name');
    }

    if (signals.length === 0) {
      return reply.code(200).send({ message: 'No processable records', agent: agentName, skipped });
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
            rawData: signal.raw as Prisma.InputJsonValue,
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
      agent: agentName,
      processed: results.filter(r => !('error' in r)).length,
      skipped,
      errors: results.filter(r => 'error' in r).length,
      results,
    });
  });
}
