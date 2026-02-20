'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = 'https://ai-crm-api-pcdn.onrender.com';

const ACTIVITY_TYPES = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK'];
const ACTIVITY_ICONS: Record<string, string> = {
  CALL: 'ÃÂ°ÃÂÃÂÃÂ', EMAIL: 'ÃÂ°ÃÂÃÂÃÂ§', MEETING: 'ÃÂ°ÃÂÃÂ¤ÃÂ', NOTE: 'ÃÂ°ÃÂÃÂÃÂ', TASK: 'ÃÂ¢ÃÂÃÂ'
};
const STATUS_COLORS: Record<string, string> = {
  NEW: '#475569', MQL: '#1d4ed8', SQL: '#15803d', LOST: '#991b1b'
};
const STAGE_COLORS: Record<string, string> = {
  DISCOVERY: '#7c3aed', PROPOSAL: '#1d4ed8', NEGOTIATION: '#b45309', WON: '#15803d', LOST: '#991b1b'
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 20px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
  borderRadius: '8px 8px 0 0', border: 'none', background: active ? '#1e293b' : 'transparent',
  color: active ? '#f8fafc' : '#64748b', borderBottom: active ? '2px solid #7c3aed' : '2px solid transparent',
  transition: 'all 0.15s',
});

function EmptyState({ msg }: { msg: string }) {
  return <div style={{ textAlign: 'center', color: '#475569', padding: '48px' }}>{msg}</div>;
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 100 ? '#4ade80' : score >= 70 ? '#60a5fa' : '#94a3b8';
  return (
    <>
      <span style={{ fontWeight: 700, color }}>{Math.round(score)}</span>
      <div className="score-bar"><div className="score-fill" style={{ width: Math.min(100, score) + '%' }}></div></div>
    </>
  );
}

function ProbBadge({ value }: { value: string }) {
  const v = String(value || '').toLowerCase();
  const high = ['alta', 'alto', 'high'].includes(v);
  const med = ['media', 'mÃÂÃÂ©dio', 'medio', 'medium'].includes(v);
  const bg = high ? '#166534' : med ? '#1e3a5f' : '#1e293b';
  const color = high ? '#4ade80' : med ? '#60a5fa' : '#94a3b8';
  return <span style={{ background: bg, color, padding: '2px 8px', borderRadius: '8px', fontSize: '11px' }}>{value || '-'}</span>;
}

function StatusBadge({ status, onClick }: { status: string; onClick?: () => void }) {
  return (
    <span onClick={onClick} style={{
      background: STATUS_COLORS[status] || '#475569', color: 'white',
      padding: '3px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
      cursor: onClick ? 'pointer' : 'default'
    }}>{status}</span>
  );
}

const modalOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
};
const modalBox: React.CSSProperties = {
  background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px',
  padding: '28px', width: '100%', maxWidth: '900px', maxHeight: '90vh',
  overflowY: 'auto', position: 'relative',
};
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#1e293b', border: '1px solid #334155',
  borderRadius: '6px', color: '#f8fafc', padding: '8px 12px',
  fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box',
};

function LeadModal({ leadId, onClose, onStatusChange }: {
  leadId: string; onClose: () => void; onStatusChange: () => void;
}) {
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'signals' | 'activities' | 'opportunities'>('overview');
  const [newActivity, setNewActivity] = useState({ type: 'CALL', title: '', notes: '' });
  const [newOpp, setNewOpp] = useState({ stage: 'DISCOVERY', estimatedValue: '', owner: '' });
  const [saving, setSaving] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showOppForm, setShowOppForm] = useState(false);

  const loadLead = useCallback(async () => {
    const r = await fetch(API + '/api/leads/' + leadId).then(r => r.json());
    setLead(r);
    setLoading(false);
  }, [leadId]);

  useEffect(() => { loadLead(); }, [loadLead]);

  async function changeStatus(status: string) {
    await fetch(API + '/api/leads/' + leadId + '/status', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    loadLead(); onStatusChange();
  }

  async function addActivity() {
    if (!newActivity.title) return;
    setSaving(true);
    await fetch(API + '/api/leads/' + leadId + '/activities', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newActivity),
    });
    setNewActivity({ type: 'CALL', title: '', notes: '' });
    setShowActivityForm(false); setSaving(false); loadLead();
  }

  async function addOpportunity() {
    setSaving(true);
    await fetch(API + '/api/leads/' + leadId + '/opportunities', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: newOpp.stage,
        estimatedValue: newOpp.estimatedValue ? Number(newOpp.estimatedValue) : undefined,
        owner: newOpp.owner || undefined,
      }),
    });
    setNewOpp({ stage: 'DISCOVERY', estimatedValue: '', owner: '' });
    setShowOppForm(false); setSaving(false); loadLead();
  }

  if (loading) return (
    <div style={modalOverlay}>
      <div style={modalBox}>
        <div style={{ color: '#94a3b8', padding: '48px', textAlign: 'center' }}>A carregar...</div>
      </div>
    </div>
  );

  const c = lead.company;
  const rawFields = (signal: any) => Object.entries(signal.rawData || {}).filter(([k]) => !['raw', 'dedupeKey', 'processed_at'].includes(k));

  return (
    <div style={modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modalBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <h2 style={{ color: '#f8fafc', fontSize: '22px', fontWeight: 700, margin: 0 }}>{c.name}</h2>
              <StatusBadge status={lead.status} />
            </div>
            <div style={{ color: '#64748b', fontSize: '13px' }}>
              {c.sector && <span style={{ marginRight: '12px' }}>ÃÂ°ÃÂÃÂÃÂ {c.sector}</span>}
              {c.country && <span style={{ marginRight: '12px' }}>ÃÂ°ÃÂÃÂÃÂ {c.country}</span>}
              {c.website && <a href={c.website} target="_blank" style={{ color: '#7c3aed' }}>ÃÂ°ÃÂÃÂÃÂ {c.website}</a>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '24px', cursor: 'pointer' }}>ÃÂ¢ÃÂÃÂ</button>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {[
            { label: 'SCORE TOTAL', value: Math.round(lead.totalScore) },
            { label: 'SINAIS', value: c.signals?.length || 0 },
            { label: 'ATIVIDADES', value: lead.activities?.length || 0 },
            { label: 'OPORTUNIDADES', value: lead.opportunities?.length || 0 },
          ].map(k => (
            <div key={k.label} style={{ background: '#0f172a', borderRadius: '8px', padding: '12px 20px', flex: 1, minWidth: '100px' }}>
              <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>{k.label}</div>
              <div style={{ color: '#f8fafc', fontSize: '24px', fontWeight: 700 }}>{k.value}</div>
            </div>
          ))}
          <div style={{ background: '#0f172a', borderRadius: '8px', padding: '12px 20px', flex: 2, minWidth: '180px' }}>
            <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '6px' }}>MOVER PARA</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['NEW', 'MQL', 'SQL', 'LOST'].filter(s => s !== lead.status).map(s => (
                <button key={s} onClick={() => changeStatus(s)} style={{
                  background: STATUS_COLORS[s], color: 'white', border: 'none',
                  padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 700
                }}>{s}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #1e293b', marginBottom: '20px' }}>
          {(['overview', 'signals', 'activities', 'opportunities'] as const).map(t => (
            <button key={t} style={tabStyle(activeTab === t)} onClick={() => setActiveTab(t)}>
              {t === 'overview' ? 'VisÃÂÃÂ£o Geral' : t === 'signals' ? `Sinais (${c.signals?.length || 0})` : t === 'activities' ? `Atividades (${lead.activities?.length || 0})` : `Oportunidades (${lead.opportunities?.length || 0})`}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div>
            {c.contacts?.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>Contactos</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {c.contacts.map((ct: any) => (
                    <div key={ct.id} style={{ background: '#0f172a', borderRadius: '8px', padding: '10px 14px' }}>
                      <div style={{ color: '#f8fafc', fontWeight: 600 }}>{ct.name}</div>
                      {ct.role && <div style={{ color: '#60a5fa', fontSize: '12px' }}>{ct.role}</div>}
                      {ct.email && <div style={{ color: '#64748b', fontSize: '12px' }}>{ct.email}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {c.signals?.[0] && (
              <div>
                <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>ÃÂÃÂltimo Sinal</div>
                <div style={{ background: '#0f172a', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ color: '#7c3aed', fontSize: '12px', fontWeight: 700 }}>{c.signals[0].triggerType}</span>
                    <span style={{ color: '#64748b', fontSize: '12px' }}>{new Date(c.signals[0].createdAt).toLocaleDateString('pt-PT')}</span>
                  </div>
                  {c.signals[0].summary && <div style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '10px' }}>{c.signals[0].summary}</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {rawFields(c.signals[0]).map(([k, v]) => (
                      <div key={k} style={{ background: '#1e293b', borderRadius: '6px', padding: '8px' }}>
                        <div style={{ color: '#475569', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>{k}</div>
                        <div style={{ color: '#cbd5e1', fontSize: '12px', wordBreak: 'break-word' }}>
                          {typeof v === 'object' ? JSON.stringify(v) : String(v || '-')}
                        </div>
                      </div>
                    ))}
                  </div>
                  {c.signals[0].sourceUrl && <a href={c.signals[0].sourceUrl} target="_blank" style={{ color: '#7c3aed', fontSize: '12px', display: 'block', marginTop: '10px' }}>ÃÂ°ÃÂÃÂÃÂ Ver fonte</a>}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'signals' && (
          <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {c.signals?.length === 0 && <EmptyState msg="Nenhum sinal registado." />}
            {c.signals?.map((s: any) => (
              <div key={s.id} style={{ background: '#0f172a', borderRadius: '8px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#7c3aed', fontSize: '12px', fontWeight: 700 }}>{s.triggerType}</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: '#4ade80', fontWeight: 700, fontSize: '13px' }}>{Math.round(s.score_final)}</span>
                    <span style={{ color: '#64748b', fontSize: '11px' }}>{new Date(s.createdAt).toLocaleDateString('pt-PT')}</span>
                  </div>
                </div>
                {s.summary && <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>{s.summary}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                  {rawFields(s).slice(0, 8).map(([k, v]) => (
                    <div key={k} style={{ background: '#1e293b', borderRadius: '4px', padding: '6px' }}>
                      <div style={{ color: '#475569', fontSize: '10px', textTransform: 'uppercase' }}>{k}</div>
                      <div style={{ color: '#cbd5e1', fontSize: '11px', wordBreak: 'break-word' }}>
                        {typeof v === 'object' ? JSON.stringify(v).substring(0, 100) : String(v || '-').substring(0, 100)}
                      </div>
                    </div>
                  ))}
                </div>
                {s.sourceUrl && <a href={s.sourceUrl} target="_blank" style={{ color: '#7c3aed', fontSize: '11px', display: 'block', marginTop: '6px' }}>ÃÂ°ÃÂÃÂÃÂ Fonte</a>}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'activities' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
              <button onClick={() => setShowActivityForm(!showActivityForm)} style={{
                background: '#7c3aed', color: 'white', border: 'none', padding: '8px 16px',
                borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600
              }}>+ Nova Atividade</button>
            </div>
            {showActivityForm && (
              <div style={{ background: '#0f172a', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  {ACTIVITY_TYPES.map(t => (
                    <button key={t} onClick={() => setNewActivity(a => ({ ...a, type: t }))} style={{
                      background: newActivity.type === t ? '#7c3aed' : '#1e293b',
                      color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px'
                    }}>{ACTIVITY_ICONS[t]} {t}</button>
                  ))}
                </div>
                <input placeholder="TÃÂÃÂ­tulo da atividade *" value={newActivity.title}
                  onChange={e => setNewActivity(a => ({ ...a, title: e.target.value }))} style={inputStyle} />
                <textarea placeholder="Notas (opcional)" value={newActivity.notes}
                  onChange={e => setNewActivity(a => ({ ...a, notes: e.target.value }))}
                  style={{ ...inputStyle, height: '80px', resize: 'vertical' as const }} />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowActivityForm(false)} style={{ background: '#1e293b', color: '#94a3b8', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={addActivity} disabled={saving} style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                    {saving ? 'A guardar...' : 'Guardar'}
                  </button>
                </div>
              </div>
            )}
            <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {lead.activities?.length === 0 && <EmptyState msg="Nenhuma atividade registada." />}
              {lead.activities?.map((a: any) => (
                <div key={a.id} style={{ background: '#0f172a', borderRadius: '8px', padding: '12px', display: 'flex', gap: '12px' }}>
                  <div style={{ fontSize: '20px' }}>{ACTIVITY_ICONS[a.type]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#f8fafc', fontWeight: 600, marginBottom: '2px' }}>{a.title}</div>
                    {a.notes && <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>{a.notes}</div>}
                    <div style={{ color: '#475569', fontSize: '11px' }}>{a.type} ÃÂÃÂ· {new Date(a.createdAt).toLocaleDateString('pt-PT')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'opportunities' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
              <button onClick={() => setShowOppForm(!showOppForm)} style={{
                background: '#7c3aed', color: 'white', border: 'none', padding: '8px 16px',
                borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600
              }}>+ Nova Oportunidade</button>
            </div>
            {showOppForm && (
              <div style={{ background: '#0f172a', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  {['DISCOVERY', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'].map(s => (
                    <button key={s} onClick={() => setNewOpp(o => ({ ...o, stage: s }))} style={{
                      background: newOpp.stage === s ? STAGE_COLORS[s] : '#1e293b',
                      color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px'
                    }}>{s}</button>
                  ))}
                </div>
                <input placeholder="Valor estimado (ÃÂ¢ÃÂÃÂ¬)" value={newOpp.estimatedValue}
                  onChange={e => setNewOpp(o => ({ ...o, estimatedValue: e.target.value }))} style={inputStyle} type="number" />
                <input placeholder="ResponsÃÂÃÂ¡vel" value={newOpp.owner}
                  onChange={e => setNewOpp(o => ({ ...o, owner: e.target.value }))} style={inputStyle} />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowOppForm(false)} style={{ background: '#1e293b', color: '#94a3b8', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={addOpportunity} disabled={saving} style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                    {saving ? 'A guardar...' : 'Guardar'}
                  </button>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
              {lead.opportunities?.length === 0 && <EmptyState msg="Nenhuma oportunidade registada." />}
              {lead.opportunities?.map((o: any) => (
                <div key={o.id} style={{ background: '#0f172a', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ background: STAGE_COLORS[o.stage], color: 'white', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>{o.stage}</span>
                    {o.estimatedValue && <span style={{ color: '#4ade80', fontWeight: 700 }}>ÃÂ¢ÃÂÃÂ¬{Number(o.estimatedValue).toLocaleString('pt-PT')}</span>}
                  </div>
                  {o.owner && <div style={{ color: '#94a3b8', fontSize: '12px' }}>ÃÂ°ÃÂÃÂÃÂ¤ {o.owner}</div>}
                  <div style={{ color: '#475569', fontSize: '11px', marginTop: '4px' }}>{new Date(o.createdAt).toLocaleDateString('pt-PT')}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
    { id: 'expansion', label: 'ExpansÃÂÃÂ£o', count: expansions.length },
    { id: 'scoring', label: 'Lead Scoring', count: scoring.length },
    { id: 'sectors', label: 'Setores', count: sectors.length },
  ];

  return (
    <>
      {selectedLeadId && (
        <LeadModal leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} onStatusChange={load} />
      )}
      <div className="kpi-grid">
        {[
          { label: 'Total Leads', value: stats.total, sub: 'empresas em pipeline', cls: '' },
          { label: 'MQL', value: stats.mql, sub: 'Marketing Qualified', cls: 'blue' },
          { label: 'SQL', value: stats.sql, sub: 'Sales Qualified', cls: 'green' },
          { label: 'Opportunities', value: stats.opportunities || 0, sub: 'oportunidades ativas', cls: 'purple' },
          { label: 'Pipeline Total', value: 'ÃÂ¢ÃÂÃÂ¬' + Number(stats.pipeline || 0).toLocaleString('pt-PT'), sub: 'valor estimado', cls: 'orange' },
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
            <th>ÃÂÃÂltimo Trigger</th><th>Agente</th><th>ÃÂÃÂltima Atividade</th>
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
            <th>Empresa</th><th>PaÃÂÃÂ­s</th><th>Setor</th><th>Pessoa</th><th>Cargo</th><th>Impacto ERP</th><th>Fonte</th><th>Data</th>
          </tr></thead><tbody>
            {clevels.length === 0 ? <tr><td colSpan={8}><EmptyState msg="Nenhuma alteraÃÂÃÂ§ÃÂÃÂ£o C-Level registada." /></td></tr>
              : clevels.map((s: any) => { const r = s.rawData || {};
                return <tr key={s.id} onClick={() => { const l = leads.find(l => l.companyId === s.companyId); if (l) router.push('/leads/' + l.id); }} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600 }}>{s.company?.name || '-'}</td>
                  <td style={{ color: '#94a3b8' }}>{r.pais || s.company?.country || '-'}</td>
                  <td style={{ color: '#94a3b8' }}>{r.setor || s.company?.sector || '-'}</td>
                  <td>{r.nome_pessoa || '-'}</td>
                  <td style={{ color: '#60a5fa', fontSize: '12px' }}>{r.cargo_alterado || '-'}</td>
                  <td style={{ color: '#94a3b8', fontSize: '12px', maxWidth: '200px' }}>{r.impacto_ERP || s.summary || '-'}</td>
                  <td>{s.sourceUrl ? <a href={s.sourceUrl} target="_blank" style={{ color: '#7c3aed' }} onClick={e => e.stopPropagation()}>ÃÂ°ÃÂÃÂÃÂ</a> : '-'}</td>
                  <td style={{ color: '#64748b', fontSize: '12px' }}>{new Date(s.createdAt).toLocaleDateString('pt-PT')}</td>
                </tr>; })}
          </tbody></table>
        </>
      )}
      {!loading && tab === 'rfp' && (
        <>
          <div className="section-title">RFP / Concursos PÃÂÃÂºblicos</div>
          <table><thead><tr>
            <th>Entidade</th><th>PaÃÂÃÂ­s</th><th>DescriÃÂÃÂ§ÃÂÃÂ£o</th><th>Valor Estimado</th><th>PertinÃÂÃÂªncia ERP</th><th>Fonte</th><th>Data</th>
          </tr></thead><tbody>
            {rfps.length === 0 ? <tr><td colSpan={7}><EmptyState msg="Nenhum RFP registado." /></td></tr>
              : rfps.map((s: any) => { const r = s.rawData || {};
                return <tr key={s.id} onClick={() => { const l = leads.find(l => l.companyId === s.companyId); if (l) router.push('/leads/' + l.id); }} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600 }}>{s.company?.name || '-'}</td>
                  <td style={{ color: '#94a3b8' }}>{r.pais || '-'}</td>
                  <td style={{ color: '#94a3b8', fontSize: '12px', maxWidth: '250px' }}>{r.descricao || s.summary || '-'}</td>
                  <td style={{ color: '#4ade80', fontWeight: 600 }}>{r.valor_estimado || '-'}</td>
                  <td><ProbBadge value={r.pertinencia_ERP} /></td>
                  <td>{s.sourceUrl ? <a href={s.sourceUrl} target="_blank" style={{ color: '#7c3aed' }} onClick={e => e.stopPropagation()}>ÃÂ°ÃÂÃÂÃÂ</a> : '-'}</td>
                  <td style={{ color: '#64748b', fontSize: '12px' }}>{new Date(s.createdAt).toLocaleDateString('pt-PT')}</td>
                </tr>; })}
          </tbody></table>
        </>
      )}
      {!loading && tab === 'expansion' && (
        <>
          <div className="section-title">ExpansÃÂÃÂ£o de Empresas</div>
          <table><thead><tr>
            <th>Empresa</th><th>PaÃÂÃÂ­s</th><th>Setor</th><th>Tipo ExpansÃÂÃÂ£o</th><th>Impacto ERP</th><th>Probabilidade</th><th>Data</th>
          </tr></thead><tbody>
            {expansions.length === 0 ? <tr><td colSpan={7}><EmptyState msg="Nenhuma expansÃÂÃÂ£o registada." /></td></tr>
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
            <th>Empresa</th><th>PaÃÂÃÂ­s</th><th>Setor</th><th>Score Final</th><th>Trigger</th><th>Probabilidade</th><th>Resumo</th><th>Data</th>
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
          <div className="section-title">AnÃÂÃÂ¡lise Setorial ÃÂ¢ÃÂÃÂ Portugal</div>
          <table><thead><tr>
            <th>Setor</th><th>Crescimento</th><th>Investimento</th><th>Maturidade Tech</th><th>Drivers</th><th>Prob. ERP</th><th>NotÃÂÃÂ­cias</th><th>Fonte</th><th>Data</th>
          </tr></thead><tbody>
            {sectors.length === 0 ? <tr><td colSpan={9}><EmptyState msg="Nenhuma anÃÂÃÂ¡lise setorial registada." /></td></tr>
              : sectors.map((s: any) => { const r = s.rawData || {};
                return <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{r.setor || s.company?.name || '-'}</td>
                  <td style={{ color: '#4ade80', fontWeight: 600 }}>{r.crescimento || '-'}</td>
                  <td style={{ color: '#60a5fa', fontSize: '12px' }}>{r.investimento_recente || '-'}</td>
                  <td style={{ color: '#94a3b8', fontSize: '12px' }}>{r.maturidade_tecnologica || '-'}</td>
                  <td style={{ color: '#94a3b8', fontSize: '12px', maxWidth: '200px' }}>{r.drivers_crescimento || '-'}</td>
                  <td><ProbBadge value={r.probabilidade_ERP} /></td>
                  <td style={{ color: '#94a3b8', fontSize: '12px', maxWidth: '200px' }}>{r.noticias_relevantes || '-'}</td>
                  <td>{r.fonte_principal ? <a href={r.fonte_principal} target="_blank" style={{ color: '#7c3aed' }}>ÃÂ°ÃÂÃÂÃÂ</a> : '-'}</td>
                  <td style={{ color: '#64748b', fontSize: '12px' }}>{new Date(s.createdAt).toLocaleDateString('pt-PT')}</td>
                </tr>; })}
          </tbody></table>
        </>
      )}
    </>
  );
}
