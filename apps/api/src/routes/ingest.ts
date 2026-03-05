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
  'Lorena_Lee': 'ERP_PROSPECT',
  'LorenaLee': 'ERP_PROSPECT',
  'Lorena Lee': 'ERP_PROSPECT',
  'ERP_ReplacementScorer': 'ERP_REPLACEMENT',
  'ERPReplacementScorer': 'ERP_REPLACEMENT',
  'ERP Replacement Scorer': 'ERP_REPLACEMENT',
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
  subsector?: string;
  size?: string;
  // New Company fields
  legalName?: string;
  nif?: string;
  phone?: string;
  email?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  municipality?: string;
  district?: string;
  digitalMaturityScore?: number;
  partOfGroup?: boolean;
  parentCompany?: string;
  numberOfSites?: number;
  // Contact fields
  contactName?: string;
  contactEmail?: string;
  contactRole?: string;
  contactDepartment?: string;
  contactConfidence?: string;
  contactLinkedin?: string;
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
  if (s.triggerType === 'SECTOR_INVESTMENT') return false;
  if (!isValidCompanyName(s.companyName)) return false;
  if (s.triggerType === 'RFP_SIGNAL' || s.triggerType === 'CLEVEL_CHANGE' || s.triggerType === 'ERP_REPLACEMENT') {
    return true;
  }
  return !!(s.domain);
}

function isValidCompanyName(name: string): boolean {
  if (!name || name.length < 2) return false;
  // Reject if it looks like a field label or sentence fragment
  const INVALID_PATTERNS = [
    /^(Revenue|Industry|Headquarters|Employees|Number of|Pharmaceuticals|Purchase|The |Hence|Companies|Power Generation)/i,
    /:\s*$/,           // ends with colon
    /^(yes|no|true|false|null|undefined)$/i,
    /(consists of|engaged in|utilize|such as|including)/i,
  ];
  if (INVALID_PATTERNS.some(p => p.test(name))) return false;
  if (name.length > 100) return false;
  return true;
}

function normalizePayload(agentName: string, body: unknown): NormalizedSignal[] {
  const triggerType = AGENT_TRIGGER_MAP[agentName] || 'GENERIC';

  if (agentName === 'SAP_S4HANA_LeadScanner_Daily') {
    const b = body as Record<string, unknown>;
    const leadsArray = Array.isArray(b.leads) ? b.leads as Record<string, unknown>[] : null;

    // Smart reclassification based on trigger content
    function classifyTrigger(item: Record<string, unknown>): string {
      const trigger = String(item.trigger || item.triggerType || item.signal_type || '').toLowerCase();
      const summary = String(item.summary || item.description || '').toLowerCase();
      const CLEVEL_KEYWORDS = ['cfo', 'cio', 'ceo', 'coo', 'cto', 'chief', 'diretor', 'director', 'c-level', 'clevel', 'board', 'presidente', 'vp ', 'vice president', 'managing director'];
      const RFP_KEYWORDS = ['rfp', 'concurso', 'tender', 'licitação', 'adjudicação', 'procurement'];
      const EXPANSION_KEYWORDS = ['expansão', 'expansion', 'nova fábrica', 'new factory', 'aquisição', 'acquisition', 'm&a', 'merger', 'fusão'];
      if (CLEVEL_KEYWORDS.some(k => trigger.includes(k) || summary.includes(k))) return 'C_LEVEL_CHANGE';
      if (RFP_KEYWORDS.some(k => trigger.includes(k) || summary.includes(k))) return 'RFP_SIGNAL';
      if (EXPANSION_KEYWORDS.some(k => trigger.includes(k) || summary.includes(k))) return 'EXPANSION_SIGNAL';
      return 'LEAD_SCAN';
    }

    if (leadsArray) {
      return leadsArray.map(item => {
        const c = (item.company || {}) as Record<string, unknown>;
        const raw = (item.raw || {}) as Record<string, unknown>;
        const detectedType = classifyTrigger(item);
        return {
          companyName: String(c.name || ''),
          domain: normalizeDomain(c.domain as string, c.name as string),
          website: c.website as string,
          country: c.country as string,
          sector: raw.setor as string,
          triggerType: detectedType,
          summary: item.summary as string,
          sourceUrl: raw.fonte as string,
          score_trigger: Number(item.score_trigger || 0),
          score_probability: Number(item.score_probability || 0),
          score_final: Number(item.score_final || 0),
          raw: { ...item as object, detectedTriggerType: detectedType },
        };
      });
    }

    if (b.company) {
      const c = b.company as Record<string, unknown>;
      const raw = (b.raw as Record<string, unknown>) || {};
      const detectedType = classifyTrigger(b);
      return [{
        companyName: String(c.name || ''),
        domain: normalizeDomain(c.domain as string, c.name as string),
        website: c.website as string,
        country: c.country as string,
        sector: raw.setor as string,
        triggerType: detectedType,
        summary: b.summary as string,
        sourceUrl: raw.fonte as string,
        score_trigger: Number(b.score_trigger || 0),
        score_probability: Number(b.score_probability || 0),
        score_final: Number(b.score_final || 0),
        raw: { ...b as object, detectedTriggerType: detectedType },
      }];
    }
  }

  if (agentName === 'SAP_S4HANA_CLevelScanner_Daily') {
  if (['ERP_ReplacementScorer', 'ERPReplacementScorer', 'ERP Replacement Scorer'].includes(agentName)) {
    const items = extractArray(body);
    return items
      .filter(item => !!(item.company_name))
      .map(item => ({
        companyName: String(item.company_name || ''),
        domain: normalizeDomain(String(item.domain || ''), String(item.company_name || '')),
        country: String(item.country || 'PT'),
        sector: '',
        triggerType: 'ERP_REPLACEMENT',
        summary: String(item.replacement_rationale_pt || ''),
        sourceUrl: '',
        score_final: Number(item.replacement_urgency_score_0_100 || 0),
        score_trigger: Number(item.replacement_urgency_score_0_100 || 0),
        score_probability: Number(item.replacement_urgency_score_0_100 || 0),
        raw: item,
      }));
  }

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
    return extractArray(body)
      .filter(item => !!(item.entidade || item.empresa || item.titulo || item.descricao))
      .map(item => {
        let estimatedValue: number | undefined;
        if (item.valor_estimado) {
          const cleaned = String(item.valor_estimado).replace(/\s*EUR\s*/i, '').replace(/\./g, '').replace(',', '.');
          const parsed = parseFloat(cleaned);
          if (!isNaN(parsed)) estimatedValue = parsed;
        }
        const name = String(item.entidade || item.empresa || item.titulo || 'RFP ' + (item.data || ''));
        return {
          companyName: name,
          domain: normalizeDomain(undefined, name) ||
            name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 40) + '.rfp.pt',
          country: String(item.pais || 'Portugal'),
          sector: String(item.tipo_entidade || ''),
          triggerType,
          summary: String(item.descricao || item.keywords || ''),
          sourceUrl: String(item.fonte || ''),
          estimatedValue,
          urgency: String(item.pertinencia_ERP || '').toLowerCase().includes('alto') ? 'HIGH' : undefined,
          raw: item,
        };
      });
  }

  if (agentName === 'SAP_S4HANA_ExpansionScanner_Daily') {
    return extractArray(body)
      .filter(item => !!(item.empresa || item.entidade))
      .map(item => ({
        companyName: String(item.empresa || item.entidade || ''),
        domain: normalizeDomain(undefined, String(item.empresa || item.entidade || '')),
        country: String(item.pais || 'Portugal'),
        sector: String(item.setor || ''),
        triggerType,
        summary: String(item.impacto_ERP || item.impacto_erp || item.descricao || ''),
        sourceUrl: String(item.fonte || ''),
        urgency: String(item.probabilidade || '').toLowerCase().includes('alta') || String(item.probabilidade || '').toLowerCase().includes('alto') ? 'HIGH' : undefined,
        raw: { ...item as object, tipo_expansao: item.tipo_expansao, empresa: item.empresa },
      }));
  }

  if (agentName === 'SAP_S4HANA_LeadScoring_Excel') {
    return extractArray(body)
      .filter(item => item.empresa && !String(item.empresa).toLowerCase().includes('não identificada') && !String(item.empresa).toLowerCase().includes('nao identificada'))
      .map(item => ({
        companyName: String(item.empresa || ''),
        domain: normalizeDomain(String(item.domain || item.dominio || ''), String(item.empresa || '')),
        country: String(item.pais || 'Portugal'),
        sector: String(item.setor || ''),
        size: String(item.tamanho || item.size || ''),
        triggerType: 'LEAD_SCAN',
        summary: String(item.resumo || item.summary || item.descricao || ''),
        sourceUrl: String(item.fonte || item.source || ''),
        score_trigger: Number(item.score_trigger || 0),
        score_probability: Number(item.score_probabilidade || item.score_probability || 0),
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

  if (['Lorena_Lee', 'LorenaLee', 'Lorena Lee'].includes(agentName)) {
    const items: Record<string, unknown>[] = (body as any)?.leads || extractArray(body);
    return items.map((r) => {
      const signals = Array.isArray(r.buying_signals) ? (r.buying_signals as any[]).map((s: any) => s.details || s.signal_type).filter(Boolean).join('; ') : '';
      const summary = [r.why_now, signals, r.notes].filter(Boolean).join(' | ').substring(0, 500);
      const sources = Array.isArray(r.sources) ? r.sources as any[] : [];
      const sourceUrl = String(sources[0]?.url || (Array.isArray(r.buying_signals) ? (r.buying_signals as any[])[0]?.url : '') || '');
      const erpInfo = [r.current_erp_vendor, r.current_erp_product].filter(Boolean).join(' ');
      // Map key_people first contact if available
      const keyPeople = Array.isArray(r.key_people) ? r.key_people as any[] : [];
      const primaryContact = keyPeople[0];
      // identification block
      const identification = (r.identification || {}) as Record<string, unknown>;
      const address = (identification.address || {}) as Record<string, unknown>;
      const generalContacts = (identification.general_contacts || {}) as Record<string, unknown>;
      // business_profile block
      const bizProfile = (r.business_profile || {}) as Record<string, unknown>;
      const groupStruct = (bizProfile.group_structure || {}) as Record<string, unknown>;

      return {
        companyName: String(r.company_name || identification.trade_name || identification.legal_name || ''),
        legalName: String(identification.legal_name || r.legal_name || ''),
        nif: String(identification.nif || r.nif || ''),
        domain: normalizeDomain(String(r.domain || identification.website || ''), String(r.company_name || '')),
        website: String(r.domain || identification.website || ''),
        country: String(r.country || address.country || 'PT'),
        sector: String(r.sector || bizProfile.sector || ''),
        subsector: String(bizProfile.subsector || r.subsector || ''),
        size: String(r.employee_range || ''),
        phone: String(identification.phone || generalContacts.phone || ''),
        email: String(identification.email || generalContacts.email || ''),
        street: String(address.street || r.street || ''),
        postalCode: String(address.postal_code || r.postal_code || ''),
        city: String(address.city || r.headquarters_city || ''),
        municipality: String(address.municipality || ''),
        district: String(address.district || ''),
        digitalMaturityScore: Number(r.digital_maturity_score || (r.digital_maturity as any)?.score_1_5 || 0) || undefined,
        partOfGroup: Boolean(groupStruct.part_of_group || r.part_of_group) || undefined,
        parentCompany: String(groupStruct.parent_company || r.parent_company || ''),
        numberOfSites: Number(bizProfile.number_of_sites || r.number_of_sites || 0) || undefined,
        contactName: String(primaryContact?.name || r.primary_contact_hint || ''),
        contactRole: String(primaryContact?.role || ''),
        contactEmail: String(primaryContact?.email_if_public || ''),
        contactDepartment: String(primaryContact?.department || ''),
        contactConfidence: String(primaryContact?.confidence || ''),
        contactLinkedin: String(primaryContact?.linkedin_url || ''),
        summary: summary || String(r.notes || ''),
        sourceUrl,
        triggerType: 'ERP_PROSPECT' as string,
        score_trigger: Number(r.lead_score || (r.scoring as any)?.priority_score_0_100 || 0),
        score_probability: Number(r.lead_score || (r.scoring as any)?.priority_score_0_100 || 0),
        score_final: Number(r.lead_score || (r.scoring as any)?.priority_score_0_100 || 0),
        raw: {
          ...r,
          erp_atual: erpInfo || 'Desconhecido',
          resumo: summary,
          headquarters_city: r.headquarters_city || address.city,
          fit_for_s4hana: r.fit_for_s4hana,
          revenue_eur: r.revenue_eur || (bizProfile.estimated_revenue_eur as any)?.value,
          revenue_range_eur: r.revenue_range_eur,
          revenue_status: r.revenue_status,
          recommended_next_action: r.recommended_next_action || (r.company_specific_analysis as any)?.why_contact_now_pt,
          primary_contact_hint: r.primary_contact_hint,
        },
      };
    }).filter((s) => s.companyName && s.companyName !== 'Unknown');
  }


  if (['ERP_ReplacementScorer', 'ERPReplacementScorer', 'ERP Replacement Scorer'].includes(agentName)) {
    return extractArray(body)
      .filter(item => !!(item.company_name))
      .map(item => ({
        companyName: String(item.company_name || ''),
        domain: normalizeDomain(String(item.domain || ''), String(item.company_name || '')),
        country: 'PT',
        sector: '',
        triggerType: 'ERP_REPLACEMENT',
        summary: String(item.replacement_rationale_pt || ''),
        sourceUrl: '',
        score_final: Number(item.replacement_urgency_score_0_100 || 0),
        score_trigger: Number(item.replacement_urgency_score_0_100 || 0),
        score_probability: Number(item.replacement_urgency_score_0_100 || 0),
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
      const qry = req.query as Record<string, string>;
      const bd = req.body as Record<string, unknown>;
      const candidates = [
        req.headers['x-gobii-token'] as string,
        req.headers['x-webhook-token'] as string,
        (req.headers['authorization'] as string)?.replace(/^Bearer\s+/i, ''),
        qry.secret, qry.token, qry.key,
        String(bd?.webhookSecret || ''), String(bd?.secret || ''),
        String(bd?.token || ''), String(bd?.key || ''),
      ];
      // Accept primary token OR short secondary token (GOBII_WEBHOOK_TOKEN_SHORT)
      const gobiiTokenShort = process.env.GOBII_WEBHOOK_TOKEN_SHORT;
      const validTokens = [gobiiToken.trim(), gobiiTokenShort?.trim()].filter(Boolean);
      const match = candidates.find(c => c && validTokens.includes(c.trim()));
      if (!match) {
        logger.warn({ 
          first: (candidates.find(c => c && c.length > 5) || '').substring(0, 30),
          queryKeys: Object.keys(qry),
          url: req.url,
        }, 'Unauthorized webhook attempt');
        return reply.status(401).send({ error: 'Unauthorized' });
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

    // Handle SECTOR_INVESTMENT separately - store raw data without creating companies/leads
    const sectorSignals = allSignals.filter(s => s.triggerType === 'SECTOR_INVESTMENT');
    for (const s of sectorSignals) {
      try {
        // Store in a generic company placeholder for sector data
        await (prisma as any).sectorData.upsert({
          where: { id: s.raw.setor as string || s.companyName },
          update: { rawData: s.raw as any, updatedAt: new Date() },
          create: { id: s.raw.setor as string || s.companyName, rawData: s.raw as any },
        }).catch(() => {
          // If sectorData table doesn't exist yet, just log
          logger.info({ setor: s.companyName }, 'Sector signal stored');
        });
      } catch(e) { /* ignore */ }
    }

    for (const signal of signals) {
      try {
        // Only update company fields if agent provides non-empty values (never overwrite with empty)
        const companyUpdate: Record<string, any> = { updatedAt: new Date() };
        if (signal.companyName) companyUpdate.name = signal.companyName;
        if (signal.legalName) companyUpdate.legalName = signal.legalName;
        if (signal.nif) companyUpdate.nif = signal.nif;
        if (signal.website) companyUpdate.website = signal.website;
        if (signal.country) companyUpdate.country = signal.country;
        if (signal.sector) companyUpdate.sector = signal.sector;
        if (signal.subsector) companyUpdate.subsector = signal.subsector;
        if (signal.size) companyUpdate.size = signal.size;
        if (signal.phone) companyUpdate.phone = signal.phone;
        if (signal.email) companyUpdate.email = signal.email;
        if (signal.street) companyUpdate.street = signal.street;
        if (signal.postalCode) companyUpdate.postalCode = signal.postalCode;
        if (signal.city) companyUpdate.city = signal.city;
        if (signal.municipality) companyUpdate.municipality = signal.municipality;
        if (signal.district) companyUpdate.district = signal.district;
        if (signal.digitalMaturityScore) companyUpdate.digitalMaturityScore = signal.digitalMaturityScore;
        if (signal.partOfGroup !== undefined) companyUpdate.partOfGroup = signal.partOfGroup;
        if (signal.parentCompany) companyUpdate.parentCompany = signal.parentCompany;
        if (signal.numberOfSites) companyUpdate.numberOfSites = signal.numberOfSites;

        const company = await prisma.company.upsert({
          where: { domain: signal.domain },
          update: companyUpdate,
          create: {
            domain: signal.domain,
            name: signal.companyName,
            legalName: signal.legalName || undefined,
            nif: signal.nif || undefined,
            website: signal.website || undefined,
            country: signal.country || undefined,
            sector: signal.sector || undefined,
            subsector: signal.subsector || undefined,
            size: signal.size || undefined,
            phone: signal.phone || undefined,
            email: signal.email || undefined,
            street: signal.street || undefined,
            postalCode: signal.postalCode || undefined,
            city: signal.city || undefined,
            municipality: signal.municipality || undefined,
            district: signal.district || undefined,
            digitalMaturityScore: signal.digitalMaturityScore || undefined,
            partOfGroup: signal.partOfGroup || undefined,
            parentCompany: signal.parentCompany || undefined,
            numberOfSites: signal.numberOfSites || undefined,
          },
        });

        if (signal.contactName) {
          // Only create contact if not already exists (same name in same company)
          const existingContact = await prisma.contact.findFirst({
            where: { companyId: company.id, name: signal.contactName },
          });
          if (!existingContact) {
            await prisma.contact.create({
              data: {
                companyId: company.id,
                name: signal.contactName,
                email: signal.contactEmail || undefined,
                role: signal.contactRole || undefined,
                department: signal.contactDepartment || undefined,
                confidence: signal.contactConfidence || undefined,
                linkedin: signal.contactLinkedin || undefined,
                sourceAgent: agentName,
              },
            }).catch(() => {});
          }
        }

        const scores = (signal.score_final && signal.score_final > 0)
          ? { trigger: signal.score_trigger || 0, probability: signal.score_probability || 0, final: signal.score_final }
          : calculateScore(agentName, signal.triggerType, { ...signal.raw, urgency: signal.urgency });

        if (signal.estimatedValue && signal.estimatedValue > 100000) {
          scores.final = Math.min(scores.final + 10, 150);
        }

        // Deduplicate signals: skip if same company+triggerType+summary in last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const existingSignal = signal.summary ? await prisma.leadSignal.findFirst({
          where: {
            companyId: company.id,
            triggerType: signal.triggerType,
            summary: signal.summary,
            createdAt: { gte: sevenDaysAgo },
          },
        }) : null;

        if (existingSignal) {
          results.push({
            company: { id: company.id, name: company.name, domain: company.domain },
            signal: { id: existingSignal.id, triggerType: signal.triggerType, score_final: scores.final, skipped: true },
            lead: { id: 'existing', totalScore: 0, status: 'skipped' },
          });
          continue;
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
        let newStatus: 'NEW' | 'UNDER_QUALIFICATION' | 'MQL' | 'SQL' | 'DISCARDED' = (currentLead?.status as any) || 'NEW';
        // Status can only go forward, never backward (agent runs never downgrade)
        const STATUS_ORDER = ['NEW', 'UNDER_QUALIFICATION', 'MQL', 'SQL', 'DISCARDED'];
        const currentIdx = STATUS_ORDER.indexOf(newStatus);
        if (newStatus !== 'SQL' && newStatus !== 'DISCARDED') {
          if (totalScore >= MQL_THRESHOLD) {
            const proposedIdx = STATUS_ORDER.indexOf('MQL');
            if (proposedIdx > currentIdx) newStatus = 'MQL';
          }
        }

        // ERP_REPLACEMENT: only update existing leads, never create new ones
        if (signal.triggerType === 'ERP_REPLACEMENT') {
          const r = signal.raw as Record<string, any>;
          const existingLead = await prisma.lead.findUnique({ where: { companyId: company.id } });
          if (!existingLead) {
            logger.warn({ company: signal.companyName }, 'ERP_REPLACEMENT skipped - company not in pipeline');
            results.push({ skipped: true, reason: 'not_in_pipeline', company: signal.companyName });
            continue;
          }
          const updated = await prisma.lead.update({
            where: { companyId: company.id },
            data: {
              replacementTier: r.replacement_tier || null,
              replacementScore: r.replacement_urgency_score_0_100 ? Number(r.replacement_urgency_score_0_100) : null,
              replacementRationale: r.replacement_rationale_pt || null,
              attackAngle: r.strategic_attack_angle_pt || null,
              recommendedProduct: r.recommended_sap_product || null,
              entryRole: r.suggested_entry_role || null,
              updatedAt: new Date(),
            },
          });
          results.push({
            company: { id: company.id, name: company.name },
            lead: { id: updated.id, replacementTier: updated.replacementTier, replacementScore: updated.replacementScore },
          });
          continue;
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
