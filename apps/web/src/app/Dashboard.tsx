'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = 'https://ai-crm-api-pcdn.onrender.com';

export default function Dashboard() {
  const [tab, setTab] = useState('pipeline');
  const [stats, setStats] = useState({ total: 0, mql: 0, sql: 0, opportunities: 0, pipeline: 0 });
  const [leads, setLeads] = useState<any[]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const [s, l, sg] = await Promise.all([
        fetch(API + '/api/stats').then(r => r.json()),
        fetch(API + '/api/leads').then(r => r.json()),
        fetch(API + '/api/signals').then(r => r.json()),
      ]);
      setStats(s || {});
      setLeads(Array.isArray(l) ? l : []);
      setSignals(Array.isArray(sg) ? sg : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const clevels = signals.filter(s => s.triggerType === 'CLEVEL_CHANGE');
  const rfps = signals.filter(s => s.triggerType === 'RFP_SIGNAL');
  const expansions = signals.filter(s => s.triggerType === 'EXPANSION_SIGNAL');
  const scoring = signals.filter(s => s.triggerType === 'EXCEL_SCORE');
  const sectors = signals.filter(s => s.triggerType === 'SECTOR_INVESTMENT');

  const tabs = [
    { id: 'pipeline', label: 'Pipeline', count: leads.length },
    { id: 'clevel', label: 'C-Level Changes', count: clevels.length },
    { id: 'rfp', label: 'RFP / Concursos', count: rfps.length },
    { id: 'expansion', label: 'ExpansÃÂÃÂÃÂÃÂ£o', count: expansions.length },
    { id: 'scoring', label: 'Lead Scoring', count: scoring.length },
    { id: 'sectors', label: 'Setores', count: sectors.length },
  ];

  return (
    <>
      <div className="kpi-grid">
        {[
          { label: 'Total Leads', value: stats.total, sub: 'empresas em pipeline', cls: '' },
          { label: 'MQL', value: stats.mql, sub: 'Marketing Qualified', cls: 'blue' },
          { label: 'SQL', value: stats.sql, sub: 'Sales Qualified', cls: 'green' },
          { label: 'Opportunities', value: stats.opportunities || 0, sub: 'oportunidades ativas', cls: 'purple' },
          { label: 'Pipeline Total', value: 'ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ¬' + Number(stats.pipeline || 0).toLocaleString('pt-PT'), sub: 'valor estimado', cls: 'orange' },
        ].map(k => (
          <div key={k.label} className={'kpi-card ' + k.cls}>
            <div className="label">{k.label}</div>
            <div className="value">{loading ? '...' : k.value}</div>
            <div className="sub">{k.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #1e293b', marginBottom: '24px', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} style={tabStyle(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.label}{t.count > 0 ? <span style={{ marginLeft: '6px', background: '#7c3aed', color: 'white', borderRadius: '10px', padding: '1px 6px', fontSize: '10px' }}>{t.count}</span> : null}
          </button>
        ))}
      </div>
      {loading && <div style={{ textAlign: 'center', color: '#475569', padding: '48px' }}>A carregar...</div>}
      {!loading && tab === 'pipeline' && (
        <>
          <div className="section-title">Pipeline de Leads</div>
          <table><thead><tr>
            <th>Empresa</th><th>Setor</th><th>Score</th><th>Status</th>
            <th>ÃÂÃÂÃÂÃÂltimo Trigger</th><th>Agente</th><th>ÃÂÃÂÃÂÃÂltima Atividade</th>
          </tr></thead><tbody>
            {leads.length === 0 ? <tr><td colSpan={7}><EmptyState msg="Nenhum lead ainda." /></td></tr>
              : leads.map((lead: any) => (
                <tr key={lead.id} onClick={() => router.push('/leads/' + lead.id)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600 }}>{lead.company?.name || '-'}</td>
                  <td style={{ color: '#94a3b8' }}>{lead.company?.sector || '-'}</td>
                  <td><ScoreBar score={lead.totalScore} /></td>
                  <td><StatusBadge status={lead.status} /></td>
                  <td style={{ color: '#94a3b8', fontSize: '12px' }}>{lead.company?.signals?.[0]?.triggerType || '-'}</td>
                  <td style={{ color: '#7c3aed', fontSize: '12px' }}>{lead.company?.signals?.[0]?.agentName?.replace('SAP_S4HANA_', '').replace('_Daily', '').replace('_Excel', '') || '-'}</td>
                  <td style={{ color: '#64748b', fontSize: '12px' }}>{new Date(lead.lastActivityDate).toLocaleDateString('pt-PT')}</td>
                </tr>
              ))}
          </tbody></table>
        </>
      )}
      {!loading && tab === 'clevel' && (
        <>
          <div className="section-title">C-Level Changes</div>
          <table><thead><tr>
            <th>Empresa</th><th>PaÃÂÃÂÃÂÃÂ­s</th><th>Setor</th><th>Pessoa</th><th>Cargo</th><th>Impacto ERP</th><th>Fonte</th><th>Data</th>
          </tr></thead><tbody>
            {clevels.length === 0 ? <tr><td colSpan={8}><EmptyState msg="Nenhuma alteraÃÂÃÂÃÂÃÂ§ÃÂÃÂÃÂÃÂ£o C-Level registada." /></td></tr>
              : clevels.map((s: any) => { const r = s.rawData || {};
                return <tr key={s.id} onClick={() => { const l = leads.find(l => l.companyId === s.companyId); if (l) router.push('/leads/' + l.id); }} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600 }}>{s.company?.name || '-'}</td>
                  <td style={{ color: '#94a3b8' }}>{r.pais || s.company?.country || '-'}</td>
                  <td style={{ color: '#94a3b8' }}>{r.setor || s.company?.sector || '-'}</td>
                  <td>{r.nome_pessoa || '-'}</td>
                  <td style={{ color: '#60a5fa', fontSize: '12px' }}>{r.cargo_alterado || '-'}</td>
                  <td style={{ color: '#94a3b8', fontSize: '12px', maxWidth: '200px' }}>{r.impacto_ERP || s.summary || '-'}</td>
                  <td>{s.sourceUrl ? <a href={s.sourceUrl} target="_blank" style={{ color: '#7c3aed' }} onClick={e => e.stopPropagation()}>ÃÂÃÂ°ÃÂÃÂÃÂÃÂÃÂÃÂ</a> : '-'}</td>
                  <td style={{ color: '#64748b', fontSize: '12px' }}>{new Date(s.createdAt).toLocaleDateString('pt-PT')}</td>
                </tr>; })}
          </tbody></table>
        </>
      )}
      {!loading && tab === 'rfp' && (
        <>
          <div className="section-title">RFP / Concursos PÃÂÃÂÃÂÃÂºblicos</div>
          <table><thead><tr>
            <th>Entidade</th><th>PaÃÂÃÂÃÂÃÂ­s</th><th>DescriÃÂÃÂÃÂÃÂ§ÃÂÃÂÃÂÃÂ£o</th><th>Valor Estimado</th><th>PertinÃÂÃÂÃÂÃÂªncia ERP</th><th>Fonte</th><th>Data</th>
          </tr></thead><tbody>
            {rfps.length === 0 ? <tr><td colSpan={7}><EmptyState msg="Nenhum RFP registado." /></td></tr>
              : rfps.map((s: any) => { const r = s.rawData || {};
                return <tr key={s.id} onClick={() => { const l = leads.find(l => l.companyId === s.companyId); if (l) router.push('/leads/' + l.id); }} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600 }}>{s.company?.name || '-'}</td>
                  <td style={{ color: '#94a3b8' }}>{r.pais || '-'}</td>
                  <td style={{ color: '#94a3b8', fontSize: '12px', maxWidth: '250px' }}>{r.descricao || s.summary || '-'}</td>
                  <td style={{ color: '#4ade80', fontWeight: 600 }}>{r.valor_estimado || '-'}</td>
                  <td><ProbBadge value={r.pertinencia_ERP} /></td>
                  <td>{s.sourceUrl ? <a href={s.sourceUrl} target="_blank" style={{ color: '#7c3aed' }} onClick={e => e.stopPropagation()}>ÃÂÃÂ°ÃÂÃÂÃÂÃÂÃÂÃÂ</a> : '-'}</td>
                  <td style={{ color: '#64748b', fontSize: '12px' }}>{new Date(s.createdAt).toLocaleDateString('pt-PT')}</td>
                </tr>; })}
          </tbody></table>
        </>
      )}
      {!loading && tab === 'expansion' && (
        <>
          <div className="section-title">ExpansÃÂÃÂÃÂÃÂ£o de Empresas</div>
          <table><thead><tr>
            <th>Empresa</th><th>PaÃÂÃÂÃÂÃÂ­s</th><th>Setor</th><th>Tipo ExpansÃÂÃÂÃÂÃÂ£o</th><th>Impacto ERP</th><th>Probabilidade</th><th>Data</th>
          </tr></thead><tbody>
            {expansions.length === 0 ? <tr><td colSpan={7}><EmptyState msg="Nenhuma expansÃÂÃÂÃÂÃÂ£o registada." /></td></tr>
              : expansions.map((s: any) => { const r = s.rawData || {};
                return <tr key={s.id} onClick={() => { const l = leads.find(l => l.companyId === s.companyId); if (l) router.push('/leads/' + l.id); }} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600 }}>{s.company?.name || '-'}</td>
                  <td style={{ color: '#94a3b8' }}>{r.pais || s.company?.country || '-'}</td>
                  <td style={{ color: '#94a3b8' }}>{r.setor || s.company?.sector || '-'}</td>
                  <td style={{ color: '#60a5fa', fontSize: '12px' }}>{r.tipo_expansao || '-'}</td>
                  <td style={{ color: '#94a3b8', fontSize: '12px', maxWidth: '200px' }}>{r.impacto_ERP || s.summary || '-'}</td>
                  <td><ProbBadge value={r.probabilidade} /></td>
                  <td style={{ color: '#64748b', fontSize: '12px' }}>{new Date(s.createdAt).toLocaleDateString('pt-PT')}</td>
                </tr>; })}
          </tbody></table>
        </>
      )}
      {!loading && tab === 'scoring' && (
        <>
          <div className="section-title">Lead Scoring</div>
          <table><thead><tr>
            <th>Empresa</th><th>PaÃÂÃÂÃÂÃÂ­s</th><th>Setor</th><th>Score Final</th><th>Trigger</th><th>Probabilidade</th><th>Resumo</th><th>Data</th>
          </tr></thead><tbody>
            {scoring.length === 0 ? <tr><td colSpan={8}><EmptyState msg="Nenhum lead scoring registado." /></td></tr>
              : scoring.map((s: any) => { const r = s.rawData || {};
                return <tr key={s.id} onClick={() => { const l = leads.find(l => l.companyId === s.companyId); if (l) router.push('/leads/' + l.id); }} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600 }}>{s.company?.name || '-'}</td>
                  <td style={{ color: '#94a3b8' }}>{r.pais || s.company?.country || '-'}</td>
                  <td style={{ color: '#94a3b8' }}>{r.setor || s.company?.sector || '-'}</td>
                  <td><ScoreBar score={s.score_final} /></td>
                  <td style={{ color: '#94a3b8', fontSize: '12px' }}>{r.trigger || r.trigger_event || '-'}</td>
                  <td><ProbBadge value={r.probabilidade || r.probability} /></td>
                  <td style={{ color: '#94a3b8', fontSize: '12px', maxWidth: '200px' }}>{r.resumo || r.summary || s.summary || '-'}</td>
                  <td style={{ color: '#64748b', fontSize: '12px' }}>{new Date(s.createdAt).toLocaleDateString('pt-PT')}</td>
                </tr>; })}
          </tbody></table>
        </>
      )}
      {!loading && tab === 'sectors' && (
        <>
          <div className="section-title">AnÃÂÃÂÃÂÃÂ¡lise Setorial ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Portugal</div>
          <table><thead><tr>
            <th>Setor</th><th>Crescimento</th><th>Investimento</th><th>Maturidade Tech</th><th>Drivers</th><th>Prob. ERP</th><th>NotÃÂÃÂÃÂÃÂ­cias</th><th>Fonte</th><th>Data</th>
          </tr></thead><tbody>
            {sectors.length === 0 ? <tr><td colSpan={9}><EmptyState msg="Nenhuma anÃÂÃÂÃÂÃÂ¡lise setorial registada." /></td></tr>
              : sectors.map((s: any) => { const r = s.rawData || {};
                return <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{r.setor || s.company?.name || '-'}</td>
                  <td style={{ color: '#4ade80', fontWeight: 600 }}>{r.crescimento || '-'}</td>
                  <td style={{ color: '#60a5fa', fontSize: '12px' }}>{r.investimento_recente || '-'}</td>
                  <td style={{ color: '#94a3b8', fontSize: '12px' }}>{r.maturidade_tecnologica || '-'}</td>
                  <td style={{ color: '#94a3b8', fontSize: '12px', maxWidth: '200px' }}>{r.drivers_crescimento || '-'}</td>
                  <td><ProbBadge value={r.probabilidade_ERP} /></td>
                  <td style={{ color: '#94a3b8', fontSize: '12px', maxWidth: '200px' }}>{r.noticias_relevantes || '-'}</td>
                  <td>{r.fonte_principal ? <a href={r.fonte_principal} target="_blank" style={{ color: '#7c3aed' }}>ÃÂÃÂ°ÃÂÃÂÃÂÃÂÃÂÃÂ</a> : '-'}</td>
                  <td style={{ color: '#64748b', fontSize: '12px' }}>{new Date(s.createdAt).toLocaleDateString('pt-PT')}</td>
                </tr>; })}
          </tbody></table>
        </>
      )}
    </>
  );
}
