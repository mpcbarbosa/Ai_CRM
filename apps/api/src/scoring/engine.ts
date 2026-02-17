import { prisma } from '../lib/prisma';

const MQL_THRESHOLD = Number(process.env.MQL_THRESHOLD) || 70;
const SQL_THRESHOLD = Number(process.env.SQL_THRESHOLD) || 100;

// Agent score weights
const AGENT_WEIGHTS: Record<string, number> = {
  SAP_S4HANA_SectorInvestmentScanner_Daily: 15,
  SAP_S4HANA_RFPScanner_Daily: 25,
  SAP_S4HANA_ExpansionScanner_Daily: 20,
  SAP_S4HANA_CLevelScanner_Daily: 20,
  SAP_S4HANA_LeadScanner_Daily: 15,
  SAP_S4HANA_LeadScoring_Excel: 30,
  DEFAULT: 10,
};

export async function recalculateScore(companyId: string): Promise<number> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const signals = await prisma.leadSignal.findMany({
    where: { companyId, createdAt: { gte: ninetyDaysAgo } },
  });

  const totalScore = signals.reduce((sum, signal) => {
    return sum + signal.score_final;
  }, 0);

  return totalScore;
}

export async function updateLeadStatus(companyId: string, totalScore: number) {
  const lead = await prisma.lead.findUnique({ where: { companyId } });
  if (!lead) return;

  let newStatus = lead.status;

  if (totalScore >= SQL_THRESHOLD && lead.status !== 'SQL') {
    newStatus = 'SQL';
  } else if (totalScore >= MQL_THRESHOLD && lead.status === 'NEW') {
    newStatus = 'MQL';
  }

  await prisma.lead.update({
    where: { companyId },
    data: {
      totalScore,
      status: newStatus,
      marketingQualified: totalScore >= MQL_THRESHOLD,
      lastActivityDate: new Date(),
    },
  });

  // Auto-create Opportunity when SQL
  if (newStatus === 'SQL' && lead.status !== 'SQL') {
    await prisma.opportunity.create({
      data: {
        leadId: lead.id,
        companyId,
        stage: 'DISCOVERY',
        probability: 25,
      },
    });
  }

  return newStatus;
}

export function calculateSignalScore(agentName: string, rawData: Record<string, unknown>): number {
  const baseWeight = AGENT_WEIGHTS[agentName] || AGENT_WEIGHTS['DEFAULT'];
  // Probability multiplier from agent data if available
  const probability = (rawData.probability as number) || (rawData.score_probability as number) || 0.5;
  return baseWeight * probability;
}
