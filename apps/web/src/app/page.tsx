import { TabDashboard } from './TabDashboard';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function getDashboardData() {
  try {
    const [statsRes, leadsRes, signalsRes] = await Promise.all([
      fetch(API + '/api/stats', { next: { revalidate: 30 } }),
      fetch(API + '/api/leads', { next: { revalidate: 30 } }),
      fetch(API + '/api/signals', { next: { revalidate: 30 } }),
    ]);
    const stats = statsRes.ok ? await statsRes.json() : { total: 0, mql: 0, sql: 0, opportunities: 0, pipeline: 0 };
    const leads = leadsRes.ok ? await leadsRes.json() : [];
    const signals = signalsRes.ok ? await signalsRes.json() : [];
    return { stats, leads: Array.isArray(leads) ? leads : [], signals: Array.isArray(signals) ? signals : [] };
  } catch {
    return { stats: { total: 0, mql: 0, sql: 0, opportunities: 0, pipeline: 0 }, leads: [], signals: [] };
  }
}

export default async function Dashboard() {
  const { stats, leads, signals } = await getDashboardData();

  const clevels = signals.filter((s: any) => s.triggerType === 'CLEVEL_CHANGE');
  const rfps = signals.filter((s: any) => s.triggerType === 'RFP_SIGNAL');
  const expansions = signals.filter((s: any) => s.triggerType === 'EXPANSION_SIGNAL');
  const scoring = signals.filter((s: any) => s.triggerType === 'EXCEL_SCORE');

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="label">Total Leads</div>
          <div className="value">{stats.total}</div>
          <div className="sub">empresas em pipeline</div>
        </div>
        <div className="kpi-card blue">
          <div className="label">MQL</div>
          <div className="value">{stats.mql}</div>
          <div className="sub">Marketing Qualified</div>
        </div>
        <div className="kpi-card green">
          <div className="label">SQL</div>
          <div className="value">{stats.sql}</div>
          <div className="sub">Sales Qualified</div>
        </div>
        <div className="kpi-card purple">
          <div className="label">Opportunities</div>
          <div className="value">{stats.opportunities || 0}</div>
          <div className="sub">oportunidades ativas</div>
        </div>
        <div className="kpi-card orange">
          <div className="label">Pipeline Total</div>
          <div className="value">€{Number(stats.pipeline || 0).toLocaleString('pt-PT')}</div>
          <div className="sub">valor estimado</div>
        </div>
      </div>

      <TabDashboard
        pipeline={leads}
        clevels={clevels}
        rfps={rfps}
        expansions={expansions}
        scoring={scoring}
      />
    </>
  );
}
