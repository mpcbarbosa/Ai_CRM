import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { calculateSignalScore, recalculateScore, updateLeadStatus } from '../scoring/engine';

const GobiiPayloadSchema = z.object({
  agentName: z.string(),
  triggerType: z.string(),
  company: z.object({
    name: z.string(),
    domain: z.string().optional(),
    website: z.string().optional(),
    country: z.string().optional(),
    sector: z.string().optional(),
    size: z.string().optional(),
    description: z.string().optional(),
  }),
  contact: z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    role: z.string().optional(),
  }).optional(),
  summary: z.string().optional(),
  sourceUrl: z.string().optional(),
  probability: z.number().optional(),
  score_trigger: z.number().optional(),
  score_probability: z.number().optional(),
  rawData: z.record(z.unknown()).optional(),
});

function normalizeDomain(domain?: string, name?: string): string {
  if (domain) return domain.toLowerCase().replace(/^www\./, '');
  // Fallback: normalize company name as domain key
  return name!.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
}

export async function ingestRoutes(app: FastifyInstance) {
  app.post('/api/ingest/gobii', async (request, reply) => {
    const parseResult = GobiiPayloadSchema.safeParse(request.body);

    if (!parseResult.success) {
      logger.warn({ errors: parseResult.error.issues }, 'Invalid ingest payload');
      return reply.status(400).send({ error: 'Invalid payload', details: parseResult.error.issues });
    }

    const payload = parseResult.data;
    const domain = normalizeDomain(payload.company.domain, payload.company.name);

    try {
      // 1. Upsert Company (deduplicate by domain)
      const company = await prisma.company.upsert({
        where: { domain },
        update: {
          name: payload.company.name,
          website: payload.company.website,
          country: payload.company.country,
          sector: payload.company.sector,
          size: payload.company.size,
          description: payload.company.description,
          updatedAt: new Date(),
        },
        create: {
          name: payload.company.name,
          domain,
          website: payload.company.website,
          country: payload.company.country,
          sector: payload.company.sector,
          size: payload.company.size,
          description: payload.company.description,
        },
      });

      // 2. Upsert Contact if provided
      if (payload.contact?.email) {
        await prisma.contact.upsert({
          where: { id: (await prisma.contact.findFirst({ where: { email: payload.contact.email, companyId: company.id } }))?.id || 'new' },
          update: { role: payload.contact.role, sourceAgent: payload.agentName },
          create: {
            companyId: company.id,
            name: payload.contact.name || '',
            email: payload.contact.email,
            role: payload.contact.role,
            sourceAgent: payload.agentName,
          },
        });
      }

      // 3. Calculate signal score
      const rawData = { ...payload.rawData, ...payload.company, probability: payload.probability };
      const score_final = calculateSignalScore(payload.agentName, rawData);

      // 4. Create LeadSignal (never lose raw data)
      const signal = await prisma.leadSignal.create({
        data: {
          companyId: company.id,
          agentName: payload.agentName,
          triggerType: payload.triggerType,
          rawData: rawData as object,
          score_trigger: payload.score_trigger || 0,
          score_probability: payload.score_probability || payload.probability || 0,
          score_final,
          probability: payload.probability,
          summary: payload.summary,
          sourceUrl: payload.sourceUrl,
        },
      });

      // 5. Upsert Lead
      await prisma.lead.upsert({
        where: { companyId: company.id },
        update: { lastActivityDate: new Date() },
        create: { companyId: company.id },
      });

      // 6. Recalculate total score and update status
      const totalScore = await recalculateScore(company.id);
      const newStatus = await updateLeadStatus(company.id, totalScore);

      logger.info({
        companyId: company.id,
        domain,
        agentName: payload.agentName,
        score_final,
        totalScore,
        newStatus,
      }, 'Lead signal ingested');

      return reply.status(201).send({
        success: true,
        companyId: company.id,
        signalId: signal.id,
        totalScore,
        status: newStatus,
      });

    } catch (err) {
      logger.error({ err, domain }, 'Error ingesting lead signal');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
