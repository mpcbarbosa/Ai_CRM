'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = 'https://ai-crm-api-pcdn.onrender.com';
const ACTIVITY_TYPES = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK'];
const ACTIVITY_ICONS = { CALL: 'ÃÂÃÂ°ÃÂÃÂÃÂÃÂÃÂÃÂ', EMAIL: 'ÃÂÃÂ°ÃÂÃÂÃÂÃÂÃÂÃÂ§', MEETING: 'ÃÂÃÂ°ÃÂÃÂÃÂÃÂ¤ÃÂÃÂ', NOTE: 'ÃÂÃÂ°ÃÂÃÂÃÂÃÂÃÂÃÂ', TASK: 'ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ' };
const STATUS_COLORS = { NEW: '#475569', MQL: '#1d4ed8', SQL: '#15803d', LOST: '#991b1b' };
const STAGE_COLORS = { DISCOVERY: '#7c3aed', PROPOSAL: '#1d4ed8', NEGOTIATION: '#b45309', WON: '#15803d', LOST: '#991b1b' };

const tabStyle = (active: boolean) => ({
  padding: '10px 20px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
  borderRadius: '8px 8px 0 0', border: 'none', background: active ? '#1e293b' : 'transparent',
  color: active ? '#f8fafc' : '#64748b', borderBottom: active ? '2px solid #7c3aed' : '2px solid transparent',
  transition: 'all 0.15s',
});

const inputStyle = {
  width: '100%', background: '#1e293b', border: '1px solid #334155',
  borderRadius: '6px', color: '#f8fafc', padding: '8px 12px',
  fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box',
};

const card = { background: '#1e293b', borderRadius: '10px', padding: '16px', marginBottom: '12px' };

function ProbBadge({ value }: { value: string }) {
  const v = String(value || '').toLowerCase();
  const high = ['alta', 'alto', 'high'].includes(v);
  const med = ['media', 'medio', 'medium', 'mÃÂÃÂÃÂÃÂ©dio'].includes(v);
  const bg = high ? '#166534' : med ? '#1e3a5f' : '#1e293b';
  const color = high ? '#4ade80' : med ? '#60a5fa' : '#94a3b8';
  return <span style={{ background: bg, color, padding: '2px 8px', borderRadius: '8px', fontSize: '11px' }}>{value || '-'}</span>;
}

function Field({ label, value }: { label: string; value: any }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ color: '#475569', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</div>
      <div style={{ color: '#cbd5e1', fontSize: '13px', wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

export default function LeadPage({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('company');
  const [newActivity, setNewActivity] = useState({ type: 'CALL', title: '', notes: '' });
  const [newOpp, setNewOpp] = useState({ stage: 'DISCOVERY', estimatedValue: '', owner: '' });
  const [saving, setSaving] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showOppForm, setShowOppForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({ website: '', country: '', sector: '', size: '', description: '' });

  const loadLead = useCallback(async () => {
    try {
      const r = await fetch(API + '/api/leads/' + leadId).then(r => r.json());
      setLead(r);
      setCompanyForm({
        website: r.company?.website || '',
        country: r.company?.country || '',
        sector: r.company?.sector || '',
        size: r.company?.size || '',
        description: r.company?.description || '',
      });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [leadId]);

  useEffect(() => { loadLead(); }, [loadLead]);

  async function changeStatus(status: string) {
    await fetch(API + '/api/leads/' + leadId + '/status', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    loadLead();
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
      body: JSON.stringify({ stage: newOpp.stage, estimatedValue: newOpp.estimatedValue ? Number(newOpp.estimatedValue) : undefined, owner: newOpp.owner || undefined }),
    });
    setNewOpp({ stage: 'DISCOVERY', estimatedValue: '', owner: '' });
    setShowOppForm(false); setSaving(false); loadLead();
  }

  if (loading) return <div style={{ color: '#94a3b8', padding: '60px', textAlign: 'center', fontSize: '16px' }}>A carregar lead...</div>;
  if (!lead || !lead.company) return <div style={{ color: '#ef4444', padding: '60px', textAlign: 'center' }}>Lead nÃÂÃÂÃÂÃÂ£o encontrado.</div>;

  const c = lead.company;
  const rawFields = (signal: any) => Object.entries(signal.rawData || {}).filter(([k]: [string, unknown]) => !['raw', 'dedupeKey', 'processed_at'].includes(k));

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 0 60px' }}>
      <div style={{ marginBottom: '24px' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontSize: '13px', marginBottom: '16px', padding: '0' }}>ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Voltar ao Pipeline</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <h1 style={{ color: '#f8fafc', fontSize: '28px', fontWeight: 800, margin: 0 }}>{c.name}</h1>
              <span style={{ background: (STATUS_COLORS as any)[lead.status] || '#475569', color: 'white', padding: '4px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}>{lead.status}</span>
            </div>
            <div style={{ color: '#64748b', fontSize: '13px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {c.domain && <span>ÃÂÃÂ°ÃÂÃÂÃÂÃÂÃÂÃÂ {c.domain}</span>}
              {c.sector && <span>ÃÂÃÂ°ÃÂÃÂÃÂÃÂÃÂÃÂ {c.sector}</span>}
              {c.country && <span>ÃÂÃÂ°ÃÂÃÂÃÂÃÂÃÂÃÂ {c.country}</span>}
              {c.size && <span>ÃÂÃÂ°ÃÂÃÂÃÂÃÂÃÂÃÂ¥ {c.size}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['NEW', 'MQL', 'SQL', 'LOST'].filter(s => s !== lead.status).map((s: any) => (
              <button key={s} onClick={() => changeStatus(s)} style={{ background: (STATUS_COLORS as any)[s], color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 700 }}>ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ {s}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '28px' }}>
        {[
          { label: 'Score Total', value: Math.round(lead.totalScore), color: lead.totalScore >= 100 ? '#4ade80' : lead.totalScore >= 70 ? '#60a5fa' : '#94a3b8' },
          { label: 'Sinais', value: c.signals?.length || 0, color: '#f8fafc' },
          { label: 'Contactos', value: c.contacts?.length || 0, color: '#f8fafc' },
          { label: 'Atividades', value: lead.activities?.length || 0, color: '#f8fafc' },
          { label: 'Oportunidades', value: lead.opportunities?.length || 0, color: '#f8fafc' },
        ].map((k: {label: string, value: any, color: string}) => (
          <div key={k.label} style={{ background: '#1e293b', borderRadius: '10px', padding: '16px' }}>
            <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>{k.label}</div>
            <div style={{ color: k.color, fontSize: '28px', fontWeight: 800 }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #1e293b', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { id: 'company', label: 'Empresa' },
          { id: 'signals', label: 'Sinais (' + (c.signals?.length || 0) + ')' },
          { id: 'activities', label: 'Atividades (' + (lead.activities?.length || 0) + ')' },
          { id: 'opportunities', label: 'Oportunidades (' + (lead.opportunities?.length || 0) + ')' },
        ].map((t: {id: string, label: string}) => (
          <button key={t.id} style={tabStyle(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {activeTab === 'company' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>InformaÃÂÃÂÃÂÃÂ§ÃÂÃÂÃÂÃÂ£o Geral</div>
              <button onClick={() => setEditingCompany(!editingCompany)} style={{ background: '#1e293b', border: 'none', color: '#7c3aed', cursor: 'pointer', fontSize: '12px', padding: '4px 10px', borderRadius: '6px' }}>
                {editingCompany ? 'Cancelar' : 'ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¯ÃÂÃÂ¸ÃÂÃÂ Editar'}
              </button>
            </div>
            <div style={card}>
              {editingCompany ? (
                <>
                  {[{key:'website',label:'Website'},{key:'country',label:'PaÃÂÃÂÃÂÃÂ­s'},{key:'sector',label:'Setor'},{key:'size',label:'DimensÃÂÃÂÃÂÃÂ£o'},{key:'description',label:'DescriÃÂÃÂÃÂÃÂ§ÃÂÃÂÃÂÃÂ£o'}].map((f: {key: string, label: string}) => (
                    <div key={f.key}>
                      <div style={{ color: '#475569', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>{f.label}</div>
                      <input value={(companyForm as any)[f.key]} onChange={e => setCompanyForm(cf => ({ ...cf, [f.key]: e.target.value }))} style={inputStyle} />
                    </div>
                  ))}
                  <button onClick={async () => {
                    await fetch(API + '/api/companies/' + c.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(companyForm) });
                    setEditingCompany(false); loadLead();
                  }} style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', width: '100%' }}>Guardar</button>
                </>
              ) : (
                <>
                  {c.website && <div style={{ marginBottom: '10px' }}><div style={{ color: '#475569', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>Website</div><a href={c.website} target="_blank" style={{ color: '#7c3aed', fontSize: '13px' }}>{c.website}</a></div>}
                  <Field label="DomÃÂÃÂÃÂÃÂ­nio" value={c.domain} />
                  <Field label="PaÃÂÃÂÃÂÃÂ­s" value={c.country} />
                  <Field label="Setor" value={c.sector} />
                  <Field label="DimensÃÂÃÂÃÂÃÂ£o" value={c.size} />
                  <Field label="DescriÃÂÃÂÃÂÃÂ§ÃÂÃÂÃÂÃÂ£o" value={c.description} />
                  <Field label="Criado em" value={new Date(c.createdAt).toLocaleDateString('pt-PT')} />
                </>
              )}
            </div>
          </div>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px' }}>Contactos ({c.contacts?.length || 0})</div>
            {(c.contacts?.length === 0 || !c.contacts) && <div style={{ color: '#475569', fontSize: '13px' }}>Nenhum contacto registado.</div>}
            {c.contacts?.map((ct: any) => (
              <div key={ct.id} style={{ ...card, borderLeft: '3px solid #7c3aed' }}>
                <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: '15px', marginBottom: '6px' }}>{ct.name}</div>
                {ct.role && <div style={{ color: '#60a5fa', fontSize: '13px', marginBottom: '4px' }}>ÃÂÃÂ°ÃÂÃÂÃÂÃÂÃÂÃÂ¼ {ct.role}</div>}
                {ct.email && <div style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '4px' }}>ÃÂÃÂ°ÃÂÃÂÃÂÃÂÃÂÃÂ§ <a href={'mailto:' + ct.email} style={{ color: '#7c3aed' }}>{ct.email}</a></div>}
                {ct.sourceAgent && <div style={{ color: '#475569', fontSize: '11px' }}>via {ct.sourceAgent.replace('SAP_S4HANA_', '').replace('_Daily', '')}</div>}
              </div>
            ))}
            {c.signals?.[0] && (
              <>
                <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', margin: '20px 0 12px' }}>ÃÂÃÂÃÂÃÂltimo Sinal</div>
                <div style={{ ...card, borderLeft: '3px solid #4ade80' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#7c3aed', fontSize: '12px', fontWeight: 700 }}>{c.signals[0].triggerType}</span>
                    <span style={{ color: '#4ade80', fontWeight: 700 }}>{Math.round(c.signals[0].score_final)}</span>
                  </div>
                  {c.signals[0].summary && <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>{c.signals[0].summary}</div>}
                  {c.signals[0].sourceUrl && <a href={c.signals[0].sourceUrl} target="_blank" style={{ color: '#7c3aed', fontSize: '12px' }}>ÃÂÃÂ°ÃÂÃÂÃÂÃÂÃÂÃÂ Ver fonte</a>}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'signals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {(c.signals?.length === 0 || !c.signals) && <div style={{ color: '#475569', textAlign: 'center', padding: '40px' }}>Nenhum sinal registado.</div>}
          {c.signals?.map((s: any) => (
            <div key={s.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ color: '#7c3aed', fontSize: '13px', fontWeight: 700 }}>{s.triggerType}</span>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>{s.agentName?.replace('SAP_S4HANA_', '').replace('_Daily', '').replace('_Excel', '')}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ color: '#4ade80', fontWeight: 700, fontSize: '16px' }}>{Math.round(s.score_final)}</span>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>{new Date(s.createdAt).toLocaleDateString('pt-PT')}</span>
                </div>
              </div>
              {s.summary && <div style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '12px', lineHeight: '1.5' }}>{s.summary}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '6px' }}>
                {rawFields(s).map(([k, v]: [string, unknown]) => (
                  <div key={k} style={{ background: '#0f172a', borderRadius: '6px', padding: '8px' }}>
                    <div style={{ color: '#475569', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>{k}</div>
                    <div style={{ color: '#cbd5e1', fontSize: '12px', wordBreak: 'break-word' }}>{typeof v === 'object' ? JSON.stringify(v) : String(v || '-')}</div>
                  </div>
                ))}
              </div>
              {s.sourceUrl && <a href={s.sourceUrl} target="_blank" style={{ color: '#7c3aed', fontSize: '12px', display: 'block', marginTop: '10px' }}>ÃÂÃÂ°ÃÂÃÂÃÂÃÂÃÂÃÂ Ver fonte original</a>}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'activities' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button onClick={() => setShowActivityForm(!showActivityForm)} style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>+ Nova Atividade</button>
          </div>
          {showActivityForm && (
            <div style={{ ...card, marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {ACTIVITY_TYPES.map((t: {id: string, label: string}) => (
                  <button key={t} onClick={() => setNewActivity(a => ({ ...a, type: t }))} style={{ background: newActivity.type === t ? '#7c3aed' : '#0f172a', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>{ACTIVITY_ICONS[t]} {t}</button>
                ))}
              </div>
              <input placeholder="TÃÂÃÂÃÂÃÂ­tulo *" value={newActivity.title} onChange={e => setNewActivity(a => ({ ...a, title: e.target.value }))} style={inputStyle} />
              <textarea placeholder="Notas" value={newActivity.notes} onChange={e => setNewActivity(a => ({ ...a, notes: e.target.value }))} style={{ ...inputStyle, height: '100px', resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowActivityForm(false)} style={{ background: '#0f172a', color: '#94a3b8', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={addActivity} disabled={saving} style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer' }}>{saving ? 'A guardar...' : 'Guardar'}</button>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(lead.activities?.length === 0 || !lead.activities) && <div style={{ color: '#475569', textAlign: 'center', padding: '40px' }}>Nenhuma atividade registada.</div>}
            {lead.activities?.map((a: any) => (
              <div key={a.id} style={{ ...card, display: 'flex', gap: '16px' }}>
                <div style={{ fontSize: '24px' }}>{ACTIVITY_ICONS[a.type]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '15px' }}>{a.title}</span>
                    <span style={{ color: '#475569', fontSize: '12px' }}>{new Date(a.createdAt).toLocaleDateString('pt-PT')}</span>
                  </div>
                  {a.notes && <div style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.5' }}>{a.notes}</div>}
                  <div style={{ color: '#475569', fontSize: '11px', marginTop: '4px' }}>{a.type}{a.createdBy ? ' ÃÂÃÂÃÂÃÂ· ' + a.createdBy : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'opportunities' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button onClick={() => setShowOppForm(!showOppForm)} style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>+ Nova Oportunidade</button>
          </div>
          {showOppForm && (
            <div style={{ ...card, marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {['DISCOVERY', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'].map((s: any) => (
                  <button key={s} onClick={() => setNewOpp(o => ({ ...o, stage: s }))} style={{ background: newOpp.stage === s ? (STAGE_COLORS as any)[s] : '#0f172a', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>{s}</button>
                ))}
              </div>
              <input placeholder="Valor estimado (ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ¬)" value={newOpp.estimatedValue} onChange={e => setNewOpp(o => ({ ...o, estimatedValue: e.target.value }))} style={inputStyle} type="number" />
              <input placeholder="ResponsÃÂÃÂÃÂÃÂ¡vel" value={newOpp.owner} onChange={e => setNewOpp(o => ({ ...o, owner: e.target.value }))} style={inputStyle} />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowOppForm(false)} style={{ background: '#0f172a', color: '#94a3b8', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={addOpportunity} disabled={saving} style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer' }}>{saving ? 'A guardar...' : 'Guardar'}</button>
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {(lead.opportunities?.length === 0 || !lead.opportunities) && <div style={{ color: '#475569', textAlign: 'center', padding: '40px', gridColumn: '1/-1' }}>Nenhuma oportunidade registada.</div>}
            {lead.opportunities?.map((o: any) => (
              <div key={o.id} style={{ ...card, borderTop: '3px solid ' + ((STAGE_COLORS as any)[o.stage] || '#475569') }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ background: (STAGE_COLORS as any)[o.stage], color: 'white', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>{o.stage}</span>
                  {o.estimatedValue && <span style={{ color: '#4ade80', fontWeight: 800, fontSize: '18px' }}>ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ¬{Number(o.estimatedValue).toLocaleString('pt-PT')}</span>}
                </div>
                {o.owner && <div style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>ÃÂÃÂ°ÃÂÃÂÃÂÃÂÃÂÃÂ¤ {o.owner}</div>}
                <div style={{ color: '#475569', fontSize: '11px' }}>{new Date(o.createdAt).toLocaleDateString('pt-PT')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
