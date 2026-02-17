// Scoring weights per agent and trigger type
const AGENT_WEIGHTS: Record<string, number> = {
  'SAP_S4HANA_SectorInvestmentScanner_Daily': 15,
  'SAP_S4HANA_RFPScanner_Daily': 25,
  'SAP_S4HANA_ExpansionScanner_Daily': 20,
  'SAP_S4HANA_CLevelScanner_Daily': 20,
  'SAP_S4HANA_LeadScanner_Daily': 15,
  'SAP_S4HANA_LeadScoring_Excel': 30,
};

const TRIGGER_WEIGHTS: Record<string, number> = {
  'RFP_SIGNAL': 30,
  'CLEVEL_CHANGE': 25,
  'EXPANSION_SIGNAL': 20,
  'SECTOR_INVESTMENT': 15,
  'LEAD_SCAN': 15,
  'EXCEL_SCORE': 30,
  'GENERIC': 10,
};

export interface ScoreResult {
  trigger: number;
  probability: number;
  final: number;
}

export function calculateScore(agentName: string, triggerType: string, rawData: any): ScoreResult {
  const agentWeight = AGENT_WEIGHTS[agentName] || 10;
  const triggerWeight = TRIGGER_WEIGHTS[triggerType] || 10;
  
  // Base score from agent + trigger
  const baseScore = (agentWeight + triggerWeight) / 2;
  
  // Boost if raw data has enrichment signals
  let boost = 0;
  if (rawData.revenue || rawData.annualRevenue) boost += 5;
  if (rawData.employees || rawData.headcount) boost += 3;
  if (rawData.contactEmail || rawData.contactName) boost += 4;
  if (rawData.urgency === 'HIGH' || rawData.priority === 'HIGH') boost += 8;
  if (rawData.budget || rawData.budgetRange) boost += 6;
  if (rawData.timeline || rawData.deadline) boost += 4;
  
  // Extract explicit score if agent provided one
  const explicitScore = rawData.score || rawData.leadScore || rawData.qualityScore;
  
  const triggerScore = baseScore + boost;
  const probabilityScore = explicitScore ? Math.min(100, Number(explicitScore)) : Math.min(100, triggerScore * 1.5);
  const finalScore = explicitScore 
    ? (triggerScore * 0.4 + Number(explicitScore) * 0.6)
    : triggerScore;

  return {
    trigger: Math.round(triggerScore * 10) / 10,
    probability: Math.round(probabilityScore * 10) / 10,
    final: Math.round(finalScore * 10) / 10,
  };
}
