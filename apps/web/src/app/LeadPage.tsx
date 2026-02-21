'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = 'https://ai-crm-api-pcdn.onrender.com';
const STATUS_COLORS: Record<string,string> = { NEW: '#475569', UNDER_QUALIFICATION: '#b45309', MQL: '#1d4ed8', SQL: '#15803d', DISCARDED: '#7f1d1d' };
const STAGE_COLORS: Record<string,string> = { DISCOVERY: '#7c3aed', PROPOSAL: '#1d4ed8', NEGOTIATION: '#b45309', WON: '#15803d', LOST: '#991b1b' };
const ACTIVITY_TYPES = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK'];
const ACTIVITY_ICONS: Record<string,string> = { CALL: 'Tel', EMAIL: 'Email', MEETING: 'Meet', NOTE: 'Nota', TASK: 'Task' };

const tabStyle = (active: boolean) => ({
  padding: '10px 20px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
  borderRadius: '8px 8px 0 0', border: 'none', background: active ? '#1e293b' : 'transparent',
  color: active ? '#f8fafc' : '#64748b', borderBottom: active ? '2px solid #7c3aed' : '2px solid transparent',
} as const);

function Field({ label, value }: { label: string; value: any }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ color: '#475569', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</div>
      <div style={{ color: '#f8fafc', fontSize: '13px' }}>{value}</div>
    </div>
  );
}

export default function LeadPage({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('company');
  const [editMode, setEditMode] = useState(false);
  const [companyForm, setCompanyForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [newActivity, setNewActivity] = useState({ type: 'CALL', title: '', notes: '' });
  const [newOpp, setNewOpp] = useState({ stage: 'DISCOVERY', estimatedValue: '', owner: '' });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [scoreHistory, setScoreHistory] = useState<any[]>([]);

  const loadLead = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(API + '/api/leads/' + leadId);
      const data = await res.json();
      setLead(data);
      setCompanyForm({
        website: data.company?.website || '',
        country: data.company?.country || '',
        sector: data.company?.sector || '',
        size: data.company?.size || '',
        description: data.company?.description || '',
      });
      // Load audit and score history
      const [auditRes, scoreRes] = await Promise.all([
        fetch(API + '/api/leads/' + leadId + '/audit'),
        fetch(API + '/api/leads/' + leadId + '/score-history'),
      ]);
      setAuditLogs(await auditRes.json());
      setScoreHistory(await scoreRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { loadLead(); }, [loadLead]);

  async function changeStatus(status: string) {
    await fetch(API + '/api/leads/' + leadId + '/status', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    loadLead();
  }

  async function saveActivity() {
    if (!newActivity.title) return;
    setSaving(true);
    await fetch(API + '/api/leads/' + leadId + '/activities', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newActivity),
    });
    setNewActivity({ type: 'CALL', title: '', notes: '' });
    setSaving(false);
    loadLead();
  }

  async function saveOpp() {
    setSaving(true);
    await fetch(API + '/api/leads/' + leadId + '/opportunities', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newOpp),
    });
    setNewOpp({ stage: 'DISCOVERY', estimatedValue: '', owner: '' });
    setSaving(false);
    loadLead();
  }

  const card = { background: '#1e293b', borderRadius: '10px', padding: '20px' } as const;
  const inputStyle = { width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' as const };

  if (loading) return <div style={{ color: '#94a3b8', padding: '60px', textAlign: 'center', fontSize: '16px' }}>A carregar lead...</div>;
  if (!lead || !lead.company) return <div style={{ color: '#ef4444', padding: '60px', textAlign: 'center' }}>Lead nao encontrado.</div>;

  const c = lead.company;
  const rawFields = (signal: any) => Object.entries(signal.rawData || {}).filter(([k]: [string, unknown]) => !['raw', 'dedupeKey', 'processed_at'].includes(k));

  const tabs = [
    { id: 'company', label: 'Empresa' },
    { id: 'signals', label: 'Sinais (' + (c.signals?.length || 0) + ')' },
    { id: 'activities', label: 'Atividades (' + (lead.activities?.length || 0) + ')' },
    { id: 'opportunities', label: 'Oportunidades (' + (lead.opportunities?.length || 0) + ')' },
    { id: 'history', label: 'Historico (' + auditLogs.length + ')' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc' }}>Ai CRM</span>
        <span style={{ background: '#7c3aed', color: 'white', padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>Gobii Intelligence</span>
      </div>

      <div style={{ padding: '32px' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontSize: '13px', marginBottom: '24px', padding: 0 }}>
          &larr; Voltar ao Pipeline
        </button>

        <div style={{ ...card, marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <h1 style={{ color: '#f8fafc', fontSize: '28px', fontWeight: 800, margin: 0 }}>{c.name}</h1>
            <span style={{ background: STATUS_COLORS[lead.status] || '#475569', color: 'white', padding: '4px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}>{lead.status}</span>
          </div>
          <div style={{ color: '#64748b', fontSize: '13px', display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {c.domain && <span>{c.domain}</span>}
            {c.sector && <span>{c.sector}</span>}
            {c.country && <span>{c.country}</span>}
            {c.size && <span>{c.size}</span>}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['NEW', 'UNDER_QUALIFICATION', 'MQL', 'SQL', 'DISCARDED'].filter(s => s !== lead.status).map((s: string) => (
              <button key={s} onClick={() => changeStatus(s)}
                style={{ background: STATUS_COLORS[s], color: 'white', border: 'none', padding: '6px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                {s === 'UNDER_QUALIFICATION' ? 'Under Qualification' : s === 'DISCARDED' ? 'Descartar' : 'Mover para ' + s}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Score Total', value: lead.totalScore || 0, color: (lead.totalScore || 0) >= 100 ? '#4ade80' : (lead.totalScore || 0) >= 70 ? '#60a5fa' : '#94a3b8' },
            { label: 'Sinais', value: c.signals?.length || 0, color: '#f8fafc' },
            { label: 'Contactos', value: c.contacts?.length || 0, color: '#f8fafc' },
            { label: 'Atividades', value: lead.activities?.length || 0, color: '#f8fafc' },
            { label: 'Oportunidades', value: lead.opportunities?.length || 0, color: '#f8fafc' },
          ].map(k => (
            <div key={k.label} style={{ ...card, textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>{k.label}</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #1e293b', marginBottom: '24px' }}>
          {tabs.map(t => (
            <button key={t.id} style={tabStyle(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {activeTab === 'company' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Informacao Geral</div>
                <button onClick={() => setEditMode(!editMode)} style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>
                  {editMode ? 'Cancelar' : 'Editar'}
                </button>
              </div>
              {editMode ? (
                <div>
                  {[
                    { key: 'website', label: 'Website' },
                    { key: 'country', label: 'Pais' },
                    { key: 'sector', label: 'Setor' },
                    { key: 'size', label: 'Dimensao' },
                    { key: 'description', label: 'Descricao' },
                  ].map(f => (
                    <div key={f.key} style={{ marginBottom: '10px' }}>
                      <div style={{ color: '#475569', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>{f.label}</div>
                      <input value={(companyForm as any)[f.key]} onChange={e => setCompanyForm((cf: any) => ({ ...cf, [f.key]: e.target.value }))} style={inputStyle} />
                    </div>
                  ))}
                  <button onClick={async () => {
                    setSaving(true);
                    await fetch(API + '/api/companies/' + c.id, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(companyForm),
                    });
                    setSaving(false);
                    setEditMode(false);
                    loadLead();
                  }} style={{ background: saving ? '#475569' : '#4ade80', color: '#0f172a', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
                    {saving ? 'A guardar...' : 'Guardar'}
                  </button>
                </div>
              ) : (
                <div>
                  <Field label="Website" value={c.website} />
                  <Field label="Dominio" value={c.domain} />
                  <Field label="Pais" value={c.country} />
                  <Field label="Setor" value={c.sector} />
                  <Field label="Dimensao" value={c.size} />
                  <Field label="Descricao" value={c.description} />
                </div>
              )}
            </div>
            <div style={card}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>Contactos ({c.contacts?.length || 0})</div>
              {(!c.contacts || c.contacts.length === 0) ? (
                <div style={{ color: '#475569', textAlign: 'center', padding: '20px' }}>Sem contactos</div>
              ) : c.contacts.map((ct: any) => (
                <div key={ct.id} style={{ background: '#0f172a', borderRadius: '8px', padding: '12px', marginBottom: '10px' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{ct.name}</div>
                  {ct.role && <div style={{ color: '#60a5fa', fontSize: '12px' }}>{ct.role}</div>}
                  {ct.email && <a href={'mailto:' + ct.email} style={{ color: '#7c3aed', fontSize: '12px' }}>{ct.email}</a>}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'signals' && (
          <div>
            {(!c.signals || c.signals.length === 0) ? (
              <div style={{ color: '#475569', textAlign: 'center', padding: '40px' }}>Sem sinais</div>
            ) : c.signals.map((s: any) => (
              <div key={s.id} style={{ ...card, marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <span style={{ color: '#7c3aed', fontWeight: 700, fontSize: '13px' }}>{s.triggerType}</span>
                    <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '12px' }}>{s.agentName?.replace('SAP_S4HANA_', '')}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ background: '#1d4ed8', color: 'white', padding: '2px 8px', borderRadius: '6px', fontSize: '12px' }}>Score: {s.score}</span>
                    <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>{new Date(s.detectedAt || s.createdAt).toLocaleDateString('pt-PT')}</div>
                  </div>
                </div>
                {s.summary && <div style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '12px' }}>{s.summary}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                  {rawFields(s).map(([k, v]: [string, unknown]) => (
                    <div key={k} style={{ background: '#0f172a', borderRadius: '6px', padding: '8px' }}>
                      <div style={{ color: '#475569', fontSize: '10px', textTransform: 'uppercase' }}>{k}</div>
                      <div style={{ color: '#f8fafc', fontSize: '12px' }}>{String(v)}</div>
                    </div>
                  ))}
                </div>
                {s.sourceUrl && <a href={s.sourceUrl} target="_blank" style={{ color: '#7c3aed', fontSize: '12px', display: 'block', marginTop: '12px' }}>Ver fonte original</a>}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'activities' && (
          <div>
            <div style={{ ...card, marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Nova Atividade</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {ACTIVITY_TYPES.map((t: string) => (
                  <button key={t} onClick={() => setNewActivity(a => ({ ...a, type: t }))}
                    style={{ background: newActivity.type === t ? '#7c3aed' : '#0f172a', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    {ACTIVITY_ICONS[t]} {t}
                  </button>
                ))}
              </div>
              <input placeholder="Titulo da atividade *" value={newActivity.title} onChange={e => setNewActivity(a => ({ ...a, title: e.target.value }))} style={{ ...inputStyle, marginBottom: '8px' }} />
              <textarea placeholder="Notas..." value={newActivity.notes} onChange={e => setNewActivity(a => ({ ...a, notes: e.target.value }))}
                style={{ ...inputStyle, height: '80px', resize: 'vertical', marginBottom: '12px' }} />
              <button onClick={saveActivity} disabled={saving || !newActivity.title}
                style={{ background: saving ? '#475569' : '#7c3aed', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
                {saving ? 'A guardar...' : 'Guardar Atividade'}
              </button>
            </div>
            {(!lead.activities || lead.activities.length === 0) ? (
              <div style={{ color: '#475569', textAlign: 'center', padding: '40px' }}>Sem atividades</div>
            ) : lead.activities.map((a: any) => (
              <div key={a.id} style={{ ...card, marginBottom: '12px', display: 'flex', gap: '16px' }}>
                <div style={{ fontSize: '24px' }}>{(ACTIVITY_ICONS as any)[a.type] || 'Act'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{a.title}</div>
                  {a.notes && <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>{a.notes}</div>}
                  <div style={{ color: '#475569', fontSize: '11px', marginTop: '6px' }}>{a.type} - {new Date(a.createdAt).toLocaleDateString('pt-PT')}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'opportunities' && (
          <div>
            <div style={{ ...card, marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Nova Oportunidade</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {['DISCOVERY', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'].map((s: string) => (
                  <button key={s} onClick={() => setNewOpp(o => ({ ...o, stage: s }))}
                    style={{ background: newOpp.stage === s ? STAGE_COLORS[s] : '#0f172a', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>
                    {s}
                  </button>
                ))}
              </div>
              <input placeholder="Valor estimado (EUR)" value={newOpp.estimatedValue} onChange={e => setNewOpp(o => ({ ...o, estimatedValue: e.target.value }))} style={{ ...inputStyle, marginBottom: '8px' }} />
              <input placeholder="Responsavel" value={newOpp.owner} onChange={e => setNewOpp(o => ({ ...o, owner: e.target.value }))} style={{ ...inputStyle, marginBottom: '12px' }} />
              <button onClick={saveOpp} disabled={saving}
                style={{ background: saving ? '#475569' : '#7c3aed', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
                {saving ? 'A guardar...' : 'Guardar Oportunidade'}
              </button>
            </div>
            {(!lead.opportunities || lead.opportunities.length === 0) ? (
              <div style={{ color: '#475569', textAlign: 'center', padding: '40px' }}>Sem oportunidades</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {lead.opportunities.map((o: any) => (
                  <div key={o.id} style={card}>
                    <span style={{ background: STAGE_COLORS[o.stage] || '#475569', color: 'white', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>{o.stage}</span>
                    {o.estimatedValue && <div style={{ color: '#4ade80', fontWeight: 700, fontSize: '18px', marginTop: '10px' }}>{'€'}{Number(o.estimatedValue).toLocaleString('pt-PT')}</div>}
                    {o.owner && <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>{o.owner}</div>}
                    <div style={{ color: '#64748b', fontSize: '11px', marginTop: '8px' }}>{new Date(o.createdAt).toLocaleDateString('pt-PT')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      
        {activeTab === 'history' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '20px', color: '#94a3b8' }}>Timeline de Eventos</div>
                {auditLogs.length === 0 ? (
                  <div style={{ color: '#475569', textAlign: 'center', padding: '40px' }}>Sem eventos registados ainda.</div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '19px', top: 0, bottom: 0, width: '2px', background: '#1e293b' }} />
                    {auditLogs.map((log: any) => {
                      const actionColors: Record<string,string> = {
                        LEAD_CREATED: '#4ade80', STATUS_CHANGED: '#f59e0b', SIGNAL_RECEIVED: '#7c3aed',
                        COMPANY_EDITED: '#60a5fa', CONTACT_ADDED: '#34d399', ACTIVITY_CREATED: '#a78bfa',
                        OPPORTUNITY_CREATED: '#fb923c', OPPORTUNITY_UPDATED: '#f97316',
                        LEAD_ASSIGNED: '#38bdf8', LEAD_QUALIFIED: '#4ade80',
                        LEAD_TAGGED: '#e879f9', NOTE_ADDED: '#94a3b8', SCORE_UPDATED: '#7c3aed',
                      };
                      const actionLabels: Record<string,string> = {
                        LEAD_CREATED: 'Lead criada', STATUS_CHANGED: 'Estado alterado',
                        SIGNAL_RECEIVED: 'Sinal recebido', COMPANY_EDITED: 'Empresa editada',
                        CONTACT_ADDED: 'Contacto adicionado', ACTIVITY_CREATED: 'Atividade criada',
                        OPPORTUNITY_CREATED: 'Oportunidade criada', OPPORTUNITY_UPDATED: 'Oportunidade atualizada',
                        LEAD_ASSIGNED: 'Lead atribuida', LEAD_QUALIFIED: 'Lead qualificada',
                        LEAD_TAGGED: 'Tags atualizadas', NOTE_ADDED: 'Nota adicionada',
                        SCORE_UPDATED: 'Score atualizado',
                      };
                      const color = actionColors[log.action] || '#475569';
                      return (
                        <div key={log.id} style={{ display: 'flex', gap: '16px', marginBottom: '20px', position: 'relative' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: color + '22', border: '2px solid ' + color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }} />
                          </div>
                          <div style={{ background: '#1e293b', borderRadius: '10px', padding: '14px 16px', flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                              <span style={{ fontWeight: 700, fontSize: '13px', color }}>{actionLabels[log.action] || log.action}</span>
                              <span style={{ color: '#475569', fontSize: '11px' }}>{new Date(log.createdAt).toLocaleString('pt-PT')}</span>
                            </div>
                            <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '6px' }}>por {log.userName}</div>
                            {log.action === 'STATUS_CHANGED' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                                <span style={{ background: '#334155', padding: '2px 8px', borderRadius: '4px' }}>{log.details?.from}</span>
                                <span style={{ color: '#475569' }}>-&gt;</span>
                                <span style={{ background: '#7c3aed', color: 'white', padding: '2px 8px', borderRadius: '4px' }}>{log.details?.to}</span>
                                {log.details?.lostReason && <span style={{ color: '#ef4444', fontSize: '11px' }}>Motivo: {log.details.lostReason}</span>}
                              </div>
                            )}
                            {log.action === 'SIGNAL_RECEIVED' && (
                              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                                {log.details?.triggerType} - Score: <span style={{ color: '#4ade80', fontWeight: 700 }}>{log.details?.score}</span>
                              </div>
                            )}
                            {log.action === 'ACTIVITY_CREATED' && (
                              <div style={{ fontSize: '12px', color: '#94a3b8' }}>{log.details?.type}: {log.details?.title}</div>
                            )}
                            {log.action === 'COMPANY_EDITED' && (
                              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Campos: {(log.details?.fields || []).join(', ')}</div>
                            )}
                            {log.action === 'LEAD_ASSIGNED' && (
                              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Atribuido a: {log.details?.assignedTo}</div>
                            )}
                            {log.action === 'NOTE_ADDED' && (
                              <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>{log.details?.notes}</div>
                            )}
                            {log.action === 'LEAD_TAGGED' && (
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {(log.details?.tags || []).map((tag: string) => (
                                  <span key={tag} style={{ background: '#7c3aed33', color: '#a78bfa', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '20px', color: '#94a3b8' }}>Evolucao do Score</div>
                {scoreHistory.length === 0 ? (
                  <div style={{ ...card, color: '#475569', textAlign: 'center', padding: '30px', fontSize: '13px' }}>Sem historico de score</div>
                ) : (
                  <div style={card}>
                    {scoreHistory.map((s: any, i: number) => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <div style={{ color: '#475569', fontSize: '10px', width: '70px' }}>{new Date(s.createdAt).toLocaleDateString('pt-PT')}</div>
                        <div style={{ flex: 1, height: '6px', background: '#0f172a', borderRadius: '3px' }}>
                          <div style={{ width: Math.min(s.score, 150) / 150 * 100 + '%', height: '100%', background: s.score >= 100 ? '#4ade80' : s.score >= 70 ? '#60a5fa' : '#475569', borderRadius: '3px' }} />
                        </div>
                        <div style={{ color: s.score >= 100 ? '#4ade80' : s.score >= 70 ? '#60a5fa' : '#94a3b8', fontWeight: 700, fontSize: '13px', width: '35px', textAlign: 'right' }}>{Math.round(s.score)}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ fontSize: '14px', fontWeight: 700, margin: '20px 0 12px', color: '#94a3b8' }}>Adicionar Nota</div>
                <div style={card}>
                  <textarea placeholder="Nota rapida sobre esta lead..." style={{ ...inputStyle, height: '80px', resize: 'vertical', marginBottom: '10px' }}
                    id="quick-note" />
                  <button onClick={async () => {
                    const el = document.getElementById('quick-note') as HTMLTextAreaElement;
                    if (!el?.value) return;
                    await fetch(API + '/api/leads/' + leadId, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json', 'x-user-name': 'Miguel' },
                      body: JSON.stringify({ notes: el.value }),
                    });
                    el.value = '';
                    loadLead();
                  }} style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, width: '100%' }}>
                    Guardar Nota
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
