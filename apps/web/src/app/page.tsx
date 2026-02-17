const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function getDashboardData() {
  try {
    const [statsRes, leadsRes] = await Promise.all([
      fetch(API + '/api/leads/stats', { next: { revalidate: 30 } }),
      fetch(API + '/api/leads?limit=50', { next: { revalidate: 30 } })
    ]);
    const stats = statsRes.ok ? await statsRes.json() : { total: 0, mql: 0, sql: 0, opportunities: 0, pipeline: 0 };
    const leads = leadsRes.ok ? await leadsRes.json() : { data: [] };
    return { stats, leads: leads.data || [] };
  } catch {
    return { stats: { total: 0, mql: 0, sql: 0, opportunities: 0, pipeline: 0 }, leads: [] };
  }
}

export default async function Dashboard() {
  const { stats, leads } = await getDashboardData();

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
          <div className="value">{stats.opportunities}</div>
          <div className="sub">oportunidades ativas</div>
        </div>
        <div className="kpi-card orange">
          <div className="label">Pipeline Total</div>
          <div className="value">€{Number(stats.pipeline || 0).toLocaleString('pt-PT')}</div>
          <div className="sub">valor estimado</div>
        </div>
      </div>

      <div className="section-title">Pipeline de Leads</div>
      <table>
        <thead>
          <tr>
            <th>Empresa</th>
            <th>Setor</th>
            <th>Score</th>
            <th>Status</th>
            <th>Último Trigger</th>
            <th>Agente</th>
            <th>Última Atividade</th>
          </tr>
        </thead>
        <tbody>
          {leads.length === 0 ? (
            <tr><td colSpan={7} style={{textAlign:'center', color:'#475569', padding:'48px'}}>
              Nenhum lead ainda. Envie dados via POST /api/ingest/gobii
            </td></tr>
          ) : leads.map((lead: any) => (
            <tr key={lead.id}>
              <td style={{fontWeight:600}}>{lead.company?.name || '-'}</td>
              <td style={{color:'#94a3b8'}}>{lead.company?.sector || '-'}</td>
              <td>
                <span style={{fontWeight:700, color: lead.totalScore >= 100 ? '#4ade80' : lead.totalScore >= 70 ? '#60a5fa' : '#94a3b8'}}>
                  {Math.round(lead.totalScore)}
                </span>
                <div className="score-bar">
                  <div className="score-fill" style={{width: Math.min(100, lead.totalScore) + '%'}}></div>
                </div>
              </td>
              <td><span className={'badge-status badge-' + lead.status}>{lead.status}</span></td>
              <td style={{color:'#94a3b8', fontSize:'12px'}}>{lead.company?.signals?.[0]?.triggerType || '-'}</td>
              <td style={{color:'#7c3aed', fontSize:'12px'}}>{lead.company?.signals?.[0]?.agentName?.replace('SAP_S4HANA_','').replace('_Daily','') || '-'}</td>
              <td style={{color:'#64748b', fontSize:'12px'}}>{new Date(lead.lastActivityDate).toLocaleDateString('pt-PT')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
