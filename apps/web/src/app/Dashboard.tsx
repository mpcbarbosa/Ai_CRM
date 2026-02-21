'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = 'https://ai-crm-api-pcdn.onrender.com';

function ScoreBar({ score }: { score: number }) {
  const s = score || 0;
  const color = s >= 100 ? '#4ade80' : s >= 70 ? '#60a5fa' : '#475569';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ color, fontWeight: 700, fontSize: '13px', minWidth: '28px' }}>{s}</span>
      <div style={{ flex: 1, height: '4px', background: '#1e293b', borderRadius: '2px', minWidth: '60px' }}>
        <div style={{ width: Math.min(s, 100) + '%', height: '100%', background: color, borderRadius: '2px' }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string,string> = { NEW: '#475569', UNDER_QUALIFICATION: '#b45309', MQL: '#1d4ed8', SQL: '#15803d', DISCARDED: '#7f1d1d' };
  return <span style={{ background: colors[status] || '#475569', color: 'white', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>{status}</span>;
}

function EmptyState({ msg }: { msg: string }) {
  return <div style={{ padding: '40px', textAlign: 'center', color: '#475569', fontSize: '14px' }}>{msg}</div>;
}

function ProbBadge({ value }: { value: string }) {
  const high = ['alta', 'high'].includes(value);
  const med = ['media', 'medio', 'medium'].includes(value);
  return <span style={{ background: high ? '#15803d' : med ? '#1d4ed8' : '#475569', color: 'white', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>{value || '-'}</span>;
}

const tabStyle = (active: boolean) => ({
  padding: '10px 20px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
  borderRadius: '8px 8px 0 0', border: 'none', background: active ? '#1e293b' : 'transparent',
  color: active ? '#f8fafc' : '#64748b', borderBottom: active ? '2px solid #7c3aed' : '2px solid transparent',
} as const);

export default function Dashboard() {
  const router = useRouter();
  const [tab, setTab] = useState('pipeline');
  const [stats, setStats] = useState({ total: 0, mql: 0, sql: 0, opportunities: 0, pipeline: 0 });
  const [leads, setLeads] = useState<any[]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [leadsRes, signalsRes, sectorsRes] = await Promise.all([
        fetch(API + '/api/leads?limit=100'),
        fetch(API + '/api/signals?limit=200'),
        fetch(API + '/api/sectors?limit=100'),
      ]);
      const leadsData = await leadsRes.json();
      const signalsData = await signalsRes.json();
      const sectorsData = await sectorsRes.json();

      const allLeads = leadsData.leads || leadsData || [];
      const allSignals = signalsData.signals || signalsData || [];
      const allSectors = sectorsData.sectors || sectorsData || [];

      setLeads(allLeads);
      setSignals(allSignals);
      setSectors(allSectors);
      setStats({
        total: allLeads.length,
        mql: allLeads.filter((l: any) => l.status === 'MQL').length,
        sql: allLeads.filter((l: any) => l.status === 'SQL').length,
        opportunities: 0,
        pipeline: allLeads.reduce((sum: number, l: any) => sum + (l.totalScore || 0), 0),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const clevels = signals.filter(s => s.triggerType === 'C_LEVEL_CHANGE');
  const rfps = signals.filter(s => s.triggerType === 'RFP_SIGNAL');
  const expansions = signals.filter(s => s.triggerType === 'EXPANSION_SIGNAL');

  const tabs = [
    { id: 'pipeline', label: 'Pipeline', count: leads.length },
    { id: 'clevels', label: 'C-Level Changes', count: clevels.length },
    { id: 'rfp', label: 'RFP / Concursos', count: rfps.length },
    { id: 'expansion', label: 'Expansao', count: expansions.length },
    { id: 'scoring', label: 'Lead Scoring', count: 0 },
    { id: 'sectors', label: 'Setores', count: sectors.length },
  ];

  const kpis = [
    { label: 'Total Leads', value: stats.total, sub: 'empresas em pipeline', cls: '' },
    { label: 'MQL', value: stats.mql, sub: 'Marketing Qualified', cls: 'blue' },
    { label: 'SQL', value: stats.sql, sub: 'Sales Qualified', cls: 'green' },
    { label: 'Opportunities', value: stats.opportunities, sub: 'oportunidades ativas', cls: 'purple' },
    { label: 'Pipeline Total', value: '€' + Number(stats.pipeline || 0).toLocaleString('pt-PT'), sub: 'valor estimado', cls: 'orange' },
  ];

  const clsColor: Record<string,string> = { blue: '#60a5fa', green: '#4ade80', purple: '#a78bfa', orange: '#fb923c' };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc' }}>Ai CRM</span>
        <span style={{ background: '#7c3aed', color: 'white', padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>Gobii Intelligence</span>
      </div>

      <div style={{ padding: '32px' }}>
        <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: '#1e293b', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{k.label}</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: clsColor[k.cls] || '#f8fafc' }}>{k.value}</div>
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>{k.sub}</div>
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

        {!loading && tab === 'pipeline' && (
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Pipeline de Leads</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead><tr style={{ background: '#1e293b', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Empresa</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Setor</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Score</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Ultimo Trigger</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Agente</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Ultima Atividade</th>
              </tr></thead>
              <tbody>
                {leads.length === 0 ? <tr><td colSpan={7}><EmptyState msg="Nenhum lead ainda." /></td></tr>
                  : leads.map((lead: any) => (
                    <tr key={lead.id} onClick={() => router.push('/leads/' + lead.id)} style={{ cursor: 'pointer', borderBottom: '1px solid #1e293b' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{lead.company?.name || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{lead.company?.sector || '-'}</td>
                      <td style={{ padding: '12px 16px' }}><ScoreBar score={lead.totalScore} /></td>
                      <td style={{ padding: '12px 16px' }}><StatusBadge status={lead.status} /></td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '12px' }}>{lead.company?.signals?.[0]?.triggerType || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#7c3aed', fontSize: '12px' }}>{lead.company?.signals?.[0]?.agentName?.replace('SAP_S4HANA_', '').replace('_Daily', '').replace('_Excel', '') || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>{lead.updatedAt ? new Date(lead.updatedAt).toLocaleDateString('pt-PT') : '-'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && tab === 'clevels' && (
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>C-Level Changes</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead><tr style={{ background: '#1e293b', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Empresa</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Pais</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Setor</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Pessoa</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Cargo</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Impacto ERP</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Fonte</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Data</th>
              </tr></thead>
              <tbody>
                {clevels.length === 0 ? <tr><td colSpan={8}><EmptyState msg="Nenhuma alteracao C-Level registada." /></td></tr>
                  : clevels.map((s: any) => { const r = s.rawData || {}; return (
                    <tr key={s.id} onClick={() => { const l = leads.find(l => l.company?.id === s.companyId); if (l) router.push('/leads/' + l.id); }} style={{ cursor: 'pointer', borderBottom: '1px solid #1e293b' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.empresa || s.companyId}</td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{r.pais || r.country || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{r.setor || r.sector || '-'}</td>
                      <td style={{ padding: '12px 16px' }}>{r.nome_pessoa || r.pessoa || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#60a5fa', fontSize: '12px' }}>{r.cargo || '-'}</td>
                      <td style={{ padding: '12px 16px' }}>{r.impacto_erp || '-'}</td>
                      <td style={{ padding: '12px 16px' }}>{s.sourceUrl ? <a href={s.sourceUrl} target="_blank" style={{ color: '#7c3aed' }} onClick={e => e.stopPropagation()}>Ver fonte</a> : '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>{new Date(s.detectedAt || s.createdAt).toLocaleDateString('pt-PT')}</td>
                    </tr>
                  );})}
              </tbody>
            </table>
          </div>
        )}

        {!loading && tab === 'rfp' && (
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>RFP / Concursos Publicos</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead><tr style={{ background: '#1e293b', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Entidade</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Pais</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Descricao</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Valor Estimado</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Prazo</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Fonte</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Data</th>
              </tr></thead>
              <tbody>
                {rfps.length === 0 ? <tr><td colSpan={7}><EmptyState msg="Nenhum RFP registado." /></td></tr>
                  : rfps.map((s: any) => { const r = s.rawData || {}; return (
                    <tr key={s.id} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.entidade || r.empresa || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{r.pais || r.country || 'PT'}</td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8', maxWidth: '300px' }}>{r.descricao || r.titulo || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#4ade80' }}>{r.valor_estimado || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#fb923c' }}>{r.prazo || '-'}</td>
                      <td style={{ padding: '12px 16px' }}>{s.sourceUrl ? <a href={s.sourceUrl} target="_blank" style={{ color: '#7c3aed' }} onClick={e => e.stopPropagation()}>Ver fonte</a> : '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>{new Date(s.detectedAt || s.createdAt).toLocaleDateString('pt-PT')}</td>
                    </tr>
                  );})}
              </tbody>
            </table>
          </div>
        )}

        {!loading && tab === 'expansion' && (
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Expansao de Empresas</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead><tr style={{ background: '#1e293b', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Empresa</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Pais</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Setor</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Tipo Expansao</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Impacto ERP</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Prob. ERP</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Fonte</th>
              </tr></thead>
              <tbody>
                {expansions.length === 0 ? <tr><td colSpan={7}><EmptyState msg="Nenhuma expansao registada." /></td></tr>
                  : expansions.map((s: any) => { const r = s.rawData || {}; return (
                    <tr key={s.id} onClick={() => { const l = leads.find(l => l.company?.id === s.companyId); if (l) router.push('/leads/' + l.id); }} style={{ cursor: 'pointer', borderBottom: '1px solid #1e293b' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.empresa || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{r.pais || r.country || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{r.setor || r.sector || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#60a5fa', fontSize: '12px' }}>{r.tipo_expansao || '-'}</td>
                      <td style={{ padding: '12px 16px' }}>{r.impacto_erp || '-'}</td>
                      <td style={{ padding: '12px 16px' }}><ProbBadge value={r.probabilidade_erp || ''} /></td>
                      <td style={{ padding: '12px 16px' }}>{s.sourceUrl ? <a href={s.sourceUrl} target="_blank" style={{ color: '#7c3aed' }} onClick={e => e.stopPropagation()}>Ver fonte</a> : '-'}</td>
                    </tr>
                  );})}
              </tbody>
            </table>
          </div>
        )}

        {!loading && tab === 'scoring' && (
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Lead Scoring</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead><tr style={{ background: '#1e293b', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Empresa</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Pais</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Setor</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Score Final</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Trigger</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Probabilidade</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Agente</th>
              </tr></thead>
              <tbody>
                {leads.length === 0 ? <tr><td colSpan={7}><EmptyState msg="Nenhum lead ainda." /></td></tr>
                  : [...leads].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0)).map((lead: any) => (
                    <tr key={lead.id} onClick={() => router.push('/leads/' + lead.id)} style={{ cursor: 'pointer', borderBottom: '1px solid #1e293b' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{lead.company?.name || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{lead.company?.country || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{lead.company?.sector || '-'}</td>
                      <td style={{ padding: '12px 16px' }}><ScoreBar score={lead.totalScore} /></td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '12px' }}>{lead.company?.signals?.[0]?.triggerType || '-'}</td>
                      <td style={{ padding: '12px 16px' }}><ProbBadge value={lead.company?.signals?.[0]?.rawData?.probabilidade_erp || ''} /></td>
                      <td style={{ padding: '12px 16px', color: '#7c3aed', fontSize: '12px' }}>{lead.company?.signals?.[0]?.agentName?.replace('SAP_S4HANA_', '').replace('_Daily', '').replace('_Excel', '') || '-'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && tab === 'sectors' && (
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Analise Setorial - Portugal</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead><tr style={{ background: '#1e293b', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Setor</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Crescimento</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Investimento</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Maturidade Tech</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Drivers</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Prob. ERP</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Nota</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Score</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Fonte</th>
              </tr></thead>
              <tbody>
                {sectors.length === 0 ? <tr><td colSpan={9}><EmptyState msg="Nenhuma analise setorial registada." /></td></tr>
                  : sectors.map((s: any) => { const r = s.rawData || s; return (
                    <tr key={s.id || r.setor} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.setor || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#4ade80' }}>{r.crescimento || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#60a5fa' }}>{r.investimento || '-'}</td>
                      <td style={{ padding: '12px 16px' }}>{r.maturidade_tech || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '12px', maxWidth: '200px' }}>{r.drivers_adocao || '-'}</td>
                      <td style={{ padding: '12px 16px' }}><ProbBadge value={r.probabilidade_erp || ''} /></td>
                      <td style={{ padding: '12px 16px', color: '#fb923c', fontWeight: 700 }}>{r.nota_final || '-'}</td>
                      <td style={{ padding: '12px 16px' }}><ScoreBar score={Number(r.score_investimento) || 0} /></td>
                      <td style={{ padding: '12px 16px' }}>{r.fonte_principal ? <a href={r.fonte_principal} target="_blank" style={{ color: '#7c3aed' }}>Ver fonte</a> : '-'}</td>
                    </tr>
                  );})}
              </tbody>
            </table>
          </div>
        )}

        {loading && <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}>A carregar...</div>}
      </div>
    </div>
  );
}
