'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

const API = 'https://ai-crm-api-pcdn.onrender.com';
const STATUS_ORDER = ['NEW', 'UNDER_QUALIFICATION', 'MQL', 'SQL', 'DISCARDED'];
const STATUS_COLORS: Record<string, string> = { NEW: '#475569', UNDER_QUALIFICATION: '#b45309', MQL: '#1d4ed8', SQL: '#15803d', DISCARDED: '#7f1d1d' };
const STATUS_LABELS: Record<string, string> = { NEW: 'New', UNDER_QUALIFICATION: 'Under Qual.', MQL: 'MQL', SQL: 'SQL', DISCARDED: 'Descartado' };

function ScoreBar({ score }: { score: number }) {
  const s = score || 0;
  const color = s >= 100 ? '#4ade80' : s >= 70 ? '#60a5fa' : '#475569';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ color, fontWeight: 700, fontSize: '13px', minWidth: '28px' }}>{s}</span>
      <div style={{ flex: 1, height: '4px', background: '#0f172a', borderRadius: '2px', minWidth: '60px' }}>
        <div style={{ width: Math.min(s, 200) / 2 + '%', height: '100%', background: color, borderRadius: '2px' }} />
      </div>
    </div>
  );
}
function StatusBadge({ status }: { status: string }) {
  return <span style={{ background: STATUS_COLORS[status] || '#475569', color: 'white', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>{STATUS_LABELS[status] || status}</span>;
}
function EmptyState({ msg }: { msg: string }) {
  return <div style={{ padding: '40px', textAlign: 'center', color: '#475569', fontSize: '14px' }}>{msg}</div>;
}
function ProbBadge({ value }: { value: string }) {
  const high = ['alta', 'high'].includes((value || '').toLowerCase());
  const med = ['media', 'medio', 'medium'].includes((value || '').toLowerCase());
  return <span style={{ background: high ? '#15803d' : med ? '#1d4ed8' : '#475569', color: 'white', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>{value || '-'}</span>;
}
function isNew(dateStr: string) { return new Date().getTime() - new Date(dateStr).getTime() < 48 * 60 * 60 * 1000; }
function NewBadge({ date }: { date: string }) {
  if (!isNew(date)) return null;
  return <span style={{ background: '#7c3aed', color: 'white', padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 700, marginLeft: '6px' }}>NOVO</span>;
}
function DateCell({ date }: { date: string }) {
  if (!date) return <span style={{ color: '#475569' }}>-</span>;
  const d = new Date(date);
  return <div><div style={{ color: '#94a3b8', fontSize: '12px' }}>{d.toLocaleDateString('pt-PT')}</div><div style={{ color: '#475569', fontSize: '11px' }}>{d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</div></div>;
}
const tabStyle = (active: boolean) => ({ padding: '10px 20px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, borderRadius: '8px 8px 0 0', border: 'none', background: active ? '#1e293b' : 'transparent', color: active ? '#f8fafc' : '#64748b', borderBottom: active ? '2px solid #7c3aed' : '2px solid transparent' } as const);
const inputStyle = { background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', padding: '8px 12px', fontSize: '13px', outline: 'none' } as const;

export default function Dashboard() {
  const router = useRouter();
  const [tab, setTab] = useState('pipeline');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [leads, setLeads] = useState<any[]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [erpProspects, setErpProspects] = useState<any[]>([]);
  const [employment, setEmployment] = useState<any[]>([]);
  const [migratingId, setMigratingId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSector, setFilterSector] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterScoreMin, setFilterScoreMin] = useState('');
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'date' | 'updated'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [lr, sr, secr, erpr, empr] = await Promise.all([fetch(API + '/api/leads?limit=200'), fetch(API + '/api/signals?limit=200'), fetch(API + '/api/sectors?limit=100'), fetch(API + '/api/leads/erp-prospects'), fetch(API + '/api/signals/employment')]);
      const [ld, sd, secd, erpd, empd] = await Promise.all([lr.json(), sr.json(), secr.json(), erpr.json(), empr.json()]);
      setLeads(ld.leads || ld || []);
      setSignals(sd.signals || sd || []);
      setSectors(secd.sectors || secd || []);
      setErpProspects(Array.isArray(erpd) ? erpd : []);
      setEmployment(Array.isArray(empd) ? empd : []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    // Restore scroll position when returning from lead detail
    const savedY = sessionStorage.getItem('pipelineScrollY');
    if (savedY) {
      setTimeout(() => { window.scrollTo({ top: Number(savedY), behavior: 'instant' }); }, 100);
      sessionStorage.removeItem('pipelineScrollY');
    }
  }, []);

  const uniqueSectors = useMemo(() => [...new Set(leads.map((l: any) => l.company?.sector).filter(Boolean))].sort() as string[], [leads]);
  const uniqueAgents = useMemo(() => [...new Set(leads.flatMap((l: any) => (l.company?.signals || []).map((s: any) => s.agentName?.replace('SAP_S4HANA_', '').replace('_Daily', '').replace('_Excel', ''))).filter(Boolean))].sort() as string[], [leads]);

  const filteredLeads = useMemo(() => {
    let r = [...leads];
    if (search) { const q = search.toLowerCase(); r = r.filter(l => l.company?.name?.toLowerCase().includes(q) || l.company?.sector?.toLowerCase().includes(q) || l.company?.country?.toLowerCase().includes(q)); }
    if (filterStatus) r = r.filter(l => l.status === filterStatus);
    if (filterSector) r = r.filter(l => l.company?.sector === filterSector);
    if (filterAgent) r = r.filter(l => (l.company?.signals || []).some((s: any) => s.agentName?.replace('SAP_S4HANA_', '').replace('_Daily', '').replace('_Excel', '') === filterAgent));
    if (filterScoreMin) r = r.filter(l => (l.totalScore || 0) >= Number(filterScoreMin));
    r.sort((a, b) => {
      let va: any, vb: any;
      if (sortBy === 'score') { va = a.totalScore || 0; vb = b.totalScore || 0; }
      else if (sortBy === 'name') { va = a.company?.name || ''; vb = b.company?.name || ''; }
      else if (sortBy === 'updated') { va = new Date(a.updatedAt || a.createdAt).getTime(); vb = new Date(b.updatedAt || b.createdAt).getTime(); }
      else { va = new Date(a.createdAt).getTime(); vb = new Date(b.createdAt).getTime(); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return r;
  }, [leads, search, filterStatus, filterSector, filterAgent, filterScoreMin, sortBy, sortDir]);

  const stats = useMemo(() => ({ total: leads.length, mql: leads.filter((l: any) => l.status === 'MQL').length, sql: leads.filter((l: any) => l.status === 'SQL').length, filtered: filteredLeads.length }), [leads, filteredLeads]);
  const clevels = signals.filter(s => s.triggerType === 'C_LEVEL_CHANGE');
  const rfps = signals.filter(s => s.triggerType === 'RFP_SIGNAL');
  const expansions = signals.filter(s => s.triggerType === 'EXPANSION_SIGNAL');
  const tabs = [{ id: 'pipeline', label: 'Pipeline', count: leads.length }, { id: 'clevels', label: 'C-Level', count: clevels.length }, { id: 'rfp', label: 'RFP', count: rfps.length }, { id: 'expansion', label: 'Expansao', count: expansions.length }, { id: 'lorena', label: '🤖 Lorena / ERP', count: erpProspects.length }, { id: 'employment', label: '💼 Emprego', count: employment.length }, { id: 'scoring', label: 'Scoring', count: 0 }, { id: 'sectors', label: 'Setores', count: sectors.length }];
  const kpis = [{ label: 'Total Leads', value: stats.total, color: '#f8fafc' }, { label: 'MQL', value: stats.mql, color: '#60a5fa' }, { label: 'SQL', value: stats.sql, color: '#4ade80' }, { label: 'Filtrados', value: stats.filtered, color: '#a78bfa' }];

  async function migrateToPipeline(signalId: string) {
    setMigratingId(signalId);
    await fetch(API + '/api/leads/erp-prospects/' + signalId + '/migrate', { method: 'POST' });
    setMigratingId(null);
    load();
  }

  async function handleDrop(leadId: string, newStatus: string) {
    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.status === newStatus) return;
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
    await fetch(API + '/api/leads/' + leadId + '/status', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
  }
  function toggleSort(field: 'score' | 'name' | 'date' | 'updated') { if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(field); setSortDir('desc'); } }
  function SortIcon({ field }: { field: string }) { if (sortBy !== field) return <span style={{ color: '#334155', marginLeft: '4px' }}>↕</span>; return <span style={{ color: '#7c3aed', marginLeft: '4px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>; }
  const hasFilters = search || filterStatus || filterSector || filterAgent || filterScoreMin;
  function clearFilters() { setSearch(''); setFilterStatus(''); setFilterSector(''); setFilterAgent(''); setFilterScoreMin(''); }

  const agentShort = (name: string) => (name || '').replace('SAP_S4HANA_', '').replace('_Daily', '').replace('_Excel', '');

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '20px', fontWeight: 800 }}>Ai CRM</span>
        <span style={{ background: '#7c3aed', color: 'white', padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>Gobii Intelligence</span>
        <a href="/settings" style={{ marginLeft: 'auto', color: '#64748b', textDecoration: 'none', fontSize: '13px', padding: '6px 14px', border: '1px solid #334155', borderRadius: '8px' }}>Configuracoes</a>
      </div>
      <div style={{ padding: '32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: '#1e293b', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{k.label}</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #1e293b', flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button key={t.id} style={tabStyle(tab === t.id)} onClick={() => setTab(t.id)}>
              {t.label}{t.count > 0 ? <span style={{ marginLeft: '6px', background: '#7c3aed', color: 'white', borderRadius: '10px', padding: '1px 6px', fontSize: '10px' }}>{t.count}</span> : null}
            </button>
          ))}
        </div>

        {tab === 'pipeline' && (
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '16px 20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="text" placeholder="Pesquisar empresa, setor, pais..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ ...inputStyle, flex: 1, minWidth: '200px' }} />
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', minWidth: '130px' }}>
                <option value="">Todos os status</option>
                {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
              <select value={filterSector} onChange={e => setFilterSector(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', minWidth: '130px' }}>
                <option value="">Todos os setores</option>
                {uniqueSectors.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', minWidth: '130px' }}>
                <option value="">Todos os agentes</option>
                {uniqueAgents.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <input type="number" placeholder="Score min." value={filterScoreMin} onChange={e => setFilterScoreMin(e.target.value)} style={{ ...inputStyle, width: '100px' }} />
              <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto', flexWrap: 'wrap' }}>
                {(['score', 'name', 'date', 'updated'] as const).map(f => (
                  <button key={f} onClick={() => toggleSort(f)}
                    style={{ background: sortBy === f ? '#7c3aed' : '#0f172a', color: sortBy === f ? 'white' : '#64748b', border: '1px solid #334155', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                    {f === 'score' ? 'Score' : f === 'name' ? 'Nome' : f === 'date' ? 'Entrada' : 'Alteração'}{sortBy === f ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </button>
                ))}
                <div style={{ display: 'flex', border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden' }}>
                  <button onClick={() => setViewMode('table')} style={{ background: viewMode === 'table' ? '#7c3aed' : '#0f172a', color: viewMode === 'table' ? 'white' : '#64748b', border: 'none', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}>Lista</button>
                  <button onClick={() => setViewMode('kanban')} style={{ background: viewMode === 'kanban' ? '#7c3aed' : '#0f172a', color: viewMode === 'kanban' ? 'white' : '#64748b', border: 'none', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}>Kanban</button>
                </div>
                {hasFilters && <button onClick={clearFilters} style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>Limpar</button>}
              </div>
            </div>
            <div style={{ marginTop: '10px', fontSize: '12px', color: '#475569' }}>
              {filteredLeads.length} de {leads.length} leads{hasFilters && <span style={{ color: '#7c3aed', marginLeft: '6px' }}>filtros ativos</span>}
            </div>
          </div>
        )}

        {!loading && tab === 'pipeline' && viewMode === 'table' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#1e293b', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', cursor: 'pointer' }} onClick={() => toggleSort('name')}>Empresa <SortIcon field="name" /></th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Setor</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', cursor: 'pointer' }} onClick={() => toggleSort('score')}>Score <SortIcon field="score" /></th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', cursor: 'pointer' }} onClick={() => toggleSort('date')}>Entrada <SortIcon field="date" /></th>
                <th style={{ padding: '12px 16px', textAlign: 'left', cursor: 'pointer' }} onClick={() => toggleSort('updated')}>Ult. Alteração <SortIcon field="updated" /></th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0
                ? <tr><td colSpan={6}><EmptyState msg="Nenhum lead encontrado com estes filtros." /></td></tr>
                : filteredLeads.map((lead: any) => (
                  <tr key={lead.id}
                    onClick={() => { sessionStorage.setItem('pipelineScrollY', String(window.scrollY)); router.push('/leads/' + lead.id); }}
                    style={{ cursor: 'pointer', borderBottom: '1px solid #1e293b' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                      {lead.company?.name || '-'}<NewBadge date={lead.createdAt} />
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{lead.company?.sector || '-'}</td>
                    <td style={{ padding: '12px 16px' }}><ScoreBar score={lead.totalScore} /></td>
                    <td style={{ padding: '12px 16px' }}><StatusBadge status={lead.status} /></td>
                    <td style={{ padding: '12px 16px' }}><DateCell date={lead.createdAt} /></td>
                    <td style={{ padding: '12px 16px' }}><DateCell date={lead.updatedAt || lead.createdAt} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {!loading && tab === 'pipeline' && viewMode === 'kanban' && (
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '16px', alignItems: 'flex-start' }}>
            {STATUS_ORDER.map(status => {
              const colLeads = filteredLeads.filter(l => l.status === status);
              return (
                <div key={status} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (dragging) handleDrop(dragging, status); setDragging(null); }}
                  style={{ minWidth: '210px', flex: '1', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: STATUS_COLORS[status] }} />
                      <span style={{ fontWeight: 700, fontSize: '12px' }}>{STATUS_LABELS[status]}</span>
                    </div>
                    <span style={{ background: STATUS_COLORS[status], color: 'white', borderRadius: '10px', padding: '1px 8px', fontSize: '11px', fontWeight: 700 }}>{colLeads.length}</span>
                  </div>
                  <div style={{ padding: '8px', minHeight: '80px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {colLeads.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: '#334155', fontSize: '12px', border: '2px dashed #334155', borderRadius: '8px' }}>Arrasta aqui</div>}
                    {colLeads.map((lead: any) => (
                      <div key={lead.id} draggable onDragStart={() => setDragging(lead.id)} onDragEnd={() => setDragging(null)} onClick={() => router.push('/leads/' + lead.id)}
                        style={{ background: '#0f172a', borderRadius: '8px', padding: '12px', cursor: 'grab', border: '1px solid #334155', opacity: dragging === lead.id ? 0.5 : 1 }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#7c3aed')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#334155')}>
                        <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>{lead.company?.name || '-'}<NewBadge date={lead.createdAt} /></div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>{[lead.company?.sector, lead.company?.country].filter(Boolean).join(' · ')}</div>
                        <ScoreBar score={lead.totalScore} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && tab === 'clevels' && (
          <div style={{ marginTop: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead><tr style={{ background: '#1e293b', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Empresa</th><th style={{ padding: '12px 16px', textAlign: 'left' }}>Pais</th><th style={{ padding: '12px 16px', textAlign: 'left' }}>Setor</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Pessoa</th><th style={{ padding: '12px 16px', textAlign: 'left' }}>Cargo</th><th style={{ padding: '12px 16px', textAlign: 'left' }}>Impacto ERP</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Fonte</th><th style={{ padding: '12px 16px', textAlign: 'left' }}>Data</th>
              </tr></thead>
              <tbody>{clevels.length === 0 ? <tr><td colSpan={8}><EmptyState msg="Nenhuma alteracao C-Level." /></td></tr> : clevels.map((s: any) => { const r = s.rawData || {}; return (
                <tr key={s.id} onClick={() => { const l = leads.find(l => l.company?.id === s.companyId); if (l) router.push('/leads/' + l.id); }} style={{ cursor: 'pointer', borderBottom: '1px solid #1e293b' }} onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.empresa || '-'}<NewBadge date={s.createdAt} /></td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{r.pais || '-'}</td><td style={{ padding: '12px 16px', color: '#94a3b8' }}>{r.setor || '-'}</td>
                  <td style={{ padding: '12px 16px' }}>{r.nome_pessoa || '-'}</td><td style={{ padding: '12px 16px', color: '#60a5fa', fontSize: '12px' }}>{r.cargo || '-'}</td>
                  <td style={{ padding: '12px 16px' }}>{r.impacto_erp || '-'}</td>
                  <td style={{ padding: '12px 16px' }}>{s.sourceUrl?.startsWith('http') ? <a href={s.sourceUrl} target="_blank" style={{ color: '#7c3aed' }} onClick={e => e.stopPropagation()}>Ver fonte</a> : '-'}</td>
                  <td style={{ padding: '12px 16px' }}><DateCell date={s.detectedAt || s.createdAt} /></td>
                </tr>);})}
              </tbody>
            </table>
          </div>
        )}

        {!loading && tab === 'rfp' && (
          <div style={{ marginTop: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead><tr style={{ background: '#1e293b', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Entidade</th><th style={{ padding: '12px 16px', textAlign: 'left' }}>Pais</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Descricao</th><th style={{ padding: '12px 16px', textAlign: 'left' }}>Valor</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Prazo</th><th style={{ padding: '12px 16px', textAlign: 'left' }}>Fonte</th><th style={{ padding: '12px 16px', textAlign: 'left' }}>Data</th>
              </tr></thead>
              <tbody>{rfps.length === 0 ? <tr><td colSpan={7}><EmptyState msg="Nenhum RFP." /></td></tr> : rfps.map((s: any) => { const r = s.rawData || {}; return (
                <tr key={s.id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.entidade || r.empresa || '-'}<NewBadge date={s.createdAt} /></td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{r.pais || 'PT'}</td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8', maxWidth: '280px' }}>{r.descricao || r.titulo || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#4ade80' }}>{r.valor_estimado || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#fb923c' }}>{r.prazo || '-'}</td>
                  <td style={{ padding: '12px 16px' }}>{s.sourceUrl ? <a href={s.sourceUrl} target="_blank" style={{ color: '#7c3aed' }}>Ver fonte</a> : '-'}</td>
                  <td style={{ padding: '12px 16px' }}><DateCell date={s.detectedAt || s.createdAt} /></td>
                </tr>);})}
              </tbody>
            </table>
          </div>
        )}

        {!loading && tab === 'expansion' && (
          <div style={{ marginTop: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead><tr style={{ background: '#1e293b', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Empresa</th><th style={{ padding: '12px 16px', textAlign: 'left' }}>Pais</th><th style={{ padding: '12px 16px', textAlign: 'left' }}>Setor</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Tipo Expansao</th><th style={{ padding: '12px 16px', textAlign: 'left' }}>Impacto ERP</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Prob ERP</th><th style={{ padding: '12px 16px', textAlign: 'left' }}>Fonte</th><th style={{ padding: '12px 16px', textAlign: 'left' }}>Data</th>
              </tr></thead>
              <tbody>{expansions.length === 0 ? <tr><td colSpan={8}><EmptyState msg="Nenhuma expansao." /></td></tr> : expansions.map((s: any) => { const r = s.rawData || {}; return (
                <tr key={s.id} onClick={() => { const l = leads.find(l => l.company?.id === s.companyId); if (l) router.push('/leads/' + l.id); }} style={{ cursor: 'pointer', borderBottom: '1px solid #1e293b' }} onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.empresa || '-'}<NewBadge date={s.createdAt} /></td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{r.pais || '-'}</td><td style={{ padding: '12px 16px', color: '#94a3b8' }}>{r.setor || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#60a5fa', fontSize: '12px' }}>{r.tipo_expansao || '-'}</td>
                  <td style={{ padding: '12px 16px' }}>{r.impacto_erp || '-'}</td>
                  <td style={{ padding: '12px 16px' }}><ProbBadge value={r.probabilidade_erp || ''} /></td>
                  <td style={{ padding: '12px 16px' }}>{s.sourceUrl?.startsWith('http') ? <a href={s.sourceUrl} target="_blank" style={{ color: '#7c3aed' }} onClick={e => e.stopPropagation()}>Ver fonte</a> : '-'}</td>
                  <td style={{ padding: '12px 16px' }}><DateCell date={s.detectedAt || s.createdAt} /></td>
                </tr>);})}
              </tbody>
            </table>
          </div>
        )}

        {!loading && tab === 'lorena' && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ background: '#1e293b', borderRadius: '8px', padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>Leads identificados pela Lorena Lee — empresas PT com receita &gt;5M€ a avaliar substituição de ERP. Clica <b style={{color:'#f8fafc'}}>Migrar</b> para mover para o Pipeline.</span>
            </div>
            {erpProspects.length === 0 ? <EmptyState msg="Sem prospects da Lorena Lee. Configura o webhook para começar a receber dados." /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead><tr style={{ background: '#1e293b', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Empresa</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Pais</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Setor</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>ERP Atual</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Revenue</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Resumo / Fit</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Score</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Data</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Ação</th>
              </tr></thead>
              <tbody>{erpProspects.map((s: any) => { const r = s.rawData || {}; return (
                <tr key={s.id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.empresa || s.company?.name || '-'}<NewBadge date={s.createdAt} /></td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{r.pais || s.company?.country || 'PT'}</td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{r.setor || s.company?.sector || '-'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px' }}>
                    <span style={{ color: '#fb923c' }}>{r.erp_atual || r.current_erp_vendor || '-'}</span>
                    {r.erp_confidence && <span style={{ marginLeft: '6px', color: '#475569', fontSize: '10px' }}>({r.erp_confidence})</span>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '12px' }}>
                    {r.revenue_eur ? <span style={{ color: '#4ade80', fontWeight: 700 }}>€{Number(r.revenue_eur).toLocaleString('pt-PT')}</span> : <span style={{ color: '#475569' }}>{r.revenue_range_eur || r.revenue_status || '-'}</span>}
                  </td>
                  <td style={{ padding: '12px 16px', maxWidth: '240px', fontSize: '12px' }}>
                    <div style={{ color: '#94a3b8' }}>{s.summary || r.resumo || r.why_now || '-'}</div>
                    {r.fit_for_s4hana && <span style={{ fontSize: '10px', color: r.fit_for_s4hana === 'high' ? '#4ade80' : r.fit_for_s4hana === 'medium' ? '#f59e0b' : '#475569', fontWeight: 700 }}>S/4HANA fit: {r.fit_for_s4hana}</span>}
                  </td>
                  <td style={{ padding: '12px 16px' }}><ScoreBar score={s.score_final || r.lead_score || 0} /></td>
                  <td style={{ padding: '12px 16px' }}><DateCell date={s.createdAt} /></td>
                  <td style={{ padding: '12px 16px' }}>
                    {s.lead
                      ? <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: 700 }}>✓ No Pipeline</span>
                      : <button onClick={() => migrateToPipeline(s.id)} disabled={migratingId === s.id}
                          style={{ background: migratingId === s.id ? '#334155' : '#7c3aed', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                          {migratingId === s.id ? '...' : 'Migrar →'}
                        </button>}
                  </td>
                </tr>);})}
              </tbody>
            </table>)}
          </div>
        )}

        {!loading && tab === 'employment' && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ background: '#1e293b', borderRadius: '8px', padding: '14px 20px', marginBottom: '20px' }}>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>Sinais de recrutamento detetados — estas empresas estão a recrutar, o que pode indicar crescimento mas <b style={{color:'#f8fafc'}}>não são leads de ERP diretos</b>.</span>
            </div>
            {employment.length === 0 ? <EmptyState msg="Nenhum sinal de emprego/recrutamento detetado." /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead><tr style={{ background: '#1e293b', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Empresa</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Pais</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Setor</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Sinal</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Fonte</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Data</th>
              </tr></thead>
              <tbody>{employment.map((s: any) => { const r = s.rawData || {}; return (
                <tr key={s.id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.empresa || s.company?.name || '-'}<NewBadge date={s.createdAt} /></td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{r.pais || s.company?.country || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{r.setor || s.company?.sector || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8', maxWidth: '300px', fontSize: '12px' }}>{s.summary || r.resumo || r.titulo || '-'}</td>
                  <td style={{ padding: '12px 16px' }}>{s.sourceUrl ? <a href={s.sourceUrl} target="_blank" style={{ color: '#7c3aed' }}>Ver fonte</a> : '-'}</td>
                  <td style={{ padding: '12px 16px' }}><DateCell date={s.createdAt} /></td>
                </tr>);})}
              </tbody>
            </table>)}
          </div>
        )}

        {!loading && tab === 'scoring' && (
          <div style={{ marginTop: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead><tr style={{ background: '#1e293b', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Empresa</th><th style={{ padding: '12px 16px', textAlign: 'left' }}>Pais</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Setor</th><th style={{ padding: '12px 16px', textAlign: 'left' }}>Score</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Status</th><th style={{ padding: '12px 16px', textAlign: 'left' }}>Agente</th>
              </tr></thead>
              <tbody>{[...leads].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0)).map((lead: any) => (
                <tr key={lead.id} onClick={() => router.push('/leads/' + lead.id)} style={{ cursor: 'pointer', borderBottom: '1px solid #1e293b' }} onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{lead.company?.name || '-'}<NewBadge date={lead.createdAt} /></td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{lead.company?.country || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{lead.company?.sector || '-'}</td>
                  <td style={{ padding: '12px 16px' }}><ScoreBar score={lead.totalScore} /></td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge status={lead.status} /></td>
                  <td style={{ padding: '12px 16px', color: '#7c3aed', fontSize: '12px' }}>{agentShort(lead.company?.signals?.[0]?.agentName)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {!loading && tab === 'sectors' && (
          <div style={{ marginTop: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead><tr style={{ background: '#1e293b', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Setor</th><th style={{ padding: '12px 16px', textAlign: 'left' }}>Crescimento</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Investimento</th><th style={{ padding: '12px 16px', textAlign: 'left' }}>Maturidade Tech</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Prob ERP</th><th style={{ padding: '12px 16px', textAlign: 'left' }}>Nota</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Score</th><th style={{ padding: '12px 16px', textAlign: 'left' }}>Fonte</th>
              </tr></thead>
              <tbody>{sectors.map((s: any) => { const r = s.rawData || s; return (
                <tr key={s.id || r.setor} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.setor || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#4ade80' }}>{r.crescimento || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#60a5fa' }}>{r.investimento || '-'}</td>
                  <td style={{ padding: '12px 16px' }}>{r.maturidade_tech || '-'}</td>
                  <td style={{ padding: '12px 16px' }}><ProbBadge value={r.probabilidade_erp || ''} /></td>
                  <td style={{ padding: '12px 16px', color: '#fb923c', fontWeight: 700 }}>{r.nota_final || '-'}</td>
                  <td style={{ padding: '12px 16px' }}><ScoreBar score={Number(r.score_investimento) || 0} /></td>
                  <td style={{ padding: '12px 16px' }}>{r.fonte_principal ? <a href={r.fonte_principal} target="_blank" style={{ color: '#7c3aed' }}>Ver fonte</a> : '-'}</td>
                </tr>);})}
              </tbody>
            </table>
          </div>
        )}

        {loading && <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}>A carregar...</div>}
      </div>
    </div>
  );
}
