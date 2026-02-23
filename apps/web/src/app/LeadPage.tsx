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
  const [newOpp, setNewOpp] = useState({ stage: 'DISCOVERY', estimatedValue: '', owner: '', contactId: '' });
  const [newNote, setNewNote] = useState('');
  const [newTask, setNewTask] = useState({ title: '', description: '', dueAt: '', assignedTo: '' });
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', role: '', email: '', phone: '', linkedin: '' });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [scoreHistory, setScoreHistory] = useState<any[]>([]);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [extraRecipients, setExtraRecipients] = useState('');
  const [defaultRecipients, setDefaultRecipients] = useState<string[]>([]);
  const [enriching, setEnriching] = useState(false);

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

  useEffect(() => {
    fetch(API + '/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data?.emailRecipients) {
          setDefaultRecipients(
            data.emailRecipients.split(',').map((e: string) => e.trim()).filter(Boolean)
          );
        }
      })
      .catch(() => {});
  }, []);

  function buildEmailContent() {
    if (!lead) return { subject: '', body: '' };
    const c = lead.company;
    const subject = `[Gobii CRM] Lead: ${c?.name || 'N/A'} — ${lead.status}`;
    const signals = (c?.signals || []).slice(0, 5).map((s: any) =>
      `• [${s.type}] ${s.title || s.type} (score: ${s.score || 0})`
    ).join('\n');
    const body = [
      `Lead: ${c?.name || 'N/A'}`,
      `Status: ${lead.status}`,
      `Score Total: ${lead.totalScore || 0}`,
      `Sector: ${c?.sector || 'N/D'} | País: ${c?.country || 'N/D'} | Tamanho: ${c?.size || 'N/D'}`,
      `Website: ${c?.website || c?.domain || 'N/D'}`,
      '',
      `Sinais recentes (${c?.signals?.length || 0} total):`,
      signals || '(sem sinais)',
      '',
      `Ver detalhe: https://ai-crm-web-4blo.onrender.com/leads/${leadId}`,
    ].join('\n');
    return { subject, body };
  }

  function sendEmail() {
    const extra = extraRecipients.split(',').map((e: string) => e.trim()).filter(Boolean);

    const [sending, setSendingLocal] = [false, () => {}]; // placeholder
    setShowEmailModal(false);

    setSaving(true);
    fetch(API + '/api/leads/' + leadId + '/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extraRecipients: extra }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          alert('Erro ao enviar email: ' + data.error);
        } else {
          alert('✅ Email enviado com sucesso para: ' + data.recipients.join(', '));
        }
      })
      .catch(() => alert('Erro de rede ao enviar email.'))
      .finally(() => {
        setSaving(false);
        setExtraRecipients('');
      });
  }

  async function enrichLead() {
    setEnriching(true);
    try {
      const res = await fetch(API + '/api/leads/' + leadId + '/enrich', { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        alert('Erro no enriquecimento: ' + data.error);
      } else {
        const msg = [
          '✅ Enriquecimento concluído!',
          data.enriched ? '• Dados da empresa atualizados' : '',
          data.newContacts > 0 ? `• ${data.newContacts} novo(s) contacto(s) adicionado(s)` : '',
          data.technologies > 0 ? `• ${data.technologies} tecnologias identificadas` : '',
        ].filter(Boolean).join('\n');
        alert(msg);
        loadLead();
      }
    } catch {
      alert('Erro de rede no enriquecimento.');
    } finally {
      setEnriching(false);
    }
  }

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
      body: JSON.stringify({ ...newOpp, contactId: newOpp.contactId || null }),
    });
    setNewOpp({ stage: 'DISCOVERY', estimatedValue: '', owner: '', contactId: '' });
    setSaving(false);
    loadLead();
  }

  async function updateOppContact(oppId: string, contactId: string) {
    await fetch(API + '/api/opportunities/' + oppId, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: contactId || null }),
    });
    loadLead();
  }

  async function saveNote() {
    if (!newNote.trim()) return;
    setSaving(true);
    await fetch(API + '/api/leads/' + leadId + '/notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newNote, createdBy: 'Utilizador' }),
    });
    setNewNote('');
    setSaving(false);
    loadLead();
  }

  async function deleteNote(noteId: string) {
    if (!confirm('Apagar nota?')) return;
    await fetch(API + '/api/notes/' + noteId, { method: 'DELETE' });
    loadLead();
  }

  async function saveTask() {
    if (!newTask.title.trim()) return;
    setSaving(true);
    await fetch(API + '/api/leads/' + leadId + '/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask),
    });
    setNewTask({ title: '', description: '', dueAt: '', assignedTo: '' });
    setSaving(false);
    loadLead();
  }

  async function toggleTask(taskId: string, done: boolean) {
    await fetch(API + '/api/tasks/' + taskId, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done }),
    });
    loadLead();
  }

  async function deleteTask(taskId: string) {
    if (!confirm('Apagar tarefa?')) return;
    await fetch(API + '/api/tasks/' + taskId, { method: 'DELETE' });
    loadLead();
  }

  async function saveContact() {
    if (!newContact.name.trim()) return;
    setSaving(true);
    await fetch(API + '/api/companies/' + c.id + '/contacts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newContact, sourceAgent: 'Manual' }),
    });
    setNewContact({ name: '', role: '', email: '', phone: '', linkedin: '' });
    setShowAddContact(false);
    setSaving(false);
    loadLead();
  }

  async function deleteContact(contactId: string) {
    if (!confirm('Apagar contacto?')) return;
    await fetch(API + '/api/contacts/' + contactId, { method: 'DELETE' });
    loadLead();
  }

  const card = { background: '#1e293b', borderRadius: '10px', padding: '20px' } as const;
  const inputStyle = { width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' as const };

  if (loading) return <div style={{ color: '#94a3b8', padding: '60px', textAlign: 'center', fontSize: '16px' }}>A carregar lead...</div>;
  if (!lead || !lead.company) return <div style={{ color: '#ef4444', padding: '60px', textAlign: 'center' }}>Lead nao encontrado.</div>;

  const c = lead.company;
  const rawFields = (signal: any) => Object.entries(signal.rawData || {}).filter(([k]: [string, unknown]) => !['raw', 'dedupeKey', 'processed_at'].includes(k));
  const openTasks = (lead.tasks || []).filter((t: any) => !t.done).length;

  const tabs = [
    { id: 'company', label: 'Empresa' },
    { id: 'signals', label: 'Sinais (' + (c.signals?.length || 0) + ')' },
    { id: 'activities', label: 'Atividades (' + (lead.activities?.length || 0) + ')' },
    { id: 'opportunities', label: 'Oportunidades (' + (lead.opportunities?.length || 0) + ')' },
    { id: 'notes', label: 'Notas' + ((lead.notes?.length || 0) > 0 ? ' (' + lead.notes.length + ')' : '') },
    { id: 'tasks', label: 'Tarefas' + (openTasks > 0 ? ' 🔴' + openTasks : '') },
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
            <button onClick={() => setShowEmailModal(true)}
            style={{ background: '#0f172a', color: '#7c3aed', border: '1px solid #7c3aed', padding: '6px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
            ✉ Enviar por Email
          </button>
          <button onClick={enrichLead} disabled={enriching}
            style={{ background: enriching ? '#1e293b' : '#0f172a', color: '#f59e0b', border: '1px solid #f59e0b', padding: '6px 16px', borderRadius: '8px', cursor: enriching ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 700, opacity: enriching ? 0.7 : 1 }}>
            {enriching ? '⏳ A enriquecer...' : '✦ Enriquecer com Apollo'}
          </button>
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
                  <Field label="Colaboradores" value={c.employeeCount ? c.employeeCount.toLocaleString('pt-PT') : null} />
                  <Field label="Revenue" value={c.revenue} />
                  <Field label="LinkedIn" value={c.linkedinUrl} />
                  <Field label="Descricao" value={c.description} />
                  {c.technologies && c.technologies.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ color: '#475569', fontSize: '10px', textTransform: 'uppercase', marginBottom: '8px' }}>Tecnologias</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {c.technologies.map((t: string) => (
                          <span key={t} style={{ background: '#1e3a5f', color: '#60a5fa', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {c.enrichedAt && (
                    <div style={{ color: '#475569', fontSize: '11px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #334155' }}>
                      ✦ Enriquecido via Apollo em {new Date(c.enrichedAt).toLocaleDateString('pt-PT')}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Contactos ({c.contacts?.length || 0})</div>
                <button onClick={() => setShowAddContact(v => !v)}
                  style={{ background: showAddContact ? '#334155' : '#0f172a', color: '#7c3aed', border: '1px solid #7c3aed', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                  {showAddContact ? '✕ Cancelar' : '+ Adicionar'}
                </button>
              </div>

              {showAddContact && (
                <div style={{ background: '#0f172a', borderRadius: '8px', padding: '14px', marginBottom: '14px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', marginBottom: '10px' }}>Novo Contacto</div>
                  <input placeholder="Nome *" value={newContact.name} onChange={e => setNewContact(c => ({ ...c, name: e.target.value }))}
                    style={{ ...inputStyle, marginBottom: '6px' }} />
                  <input placeholder="Cargo (ex: CEO, CFO...)" value={newContact.role} onChange={e => setNewContact(c => ({ ...c, role: e.target.value }))}
                    style={{ ...inputStyle, marginBottom: '6px' }} />
                  <input placeholder="Email" value={newContact.email} onChange={e => setNewContact(c => ({ ...c, email: e.target.value }))}
                    style={{ ...inputStyle, marginBottom: '6px' }} />
                  <input placeholder="Telefone" value={newContact.phone} onChange={e => setNewContact(c => ({ ...c, phone: e.target.value }))}
                    style={{ ...inputStyle, marginBottom: '6px' }} />
                  <input placeholder="LinkedIn URL" value={newContact.linkedin} onChange={e => setNewContact(c => ({ ...c, linkedin: e.target.value }))}
                    style={{ ...inputStyle, marginBottom: '10px' }} />
                  <button onClick={saveContact} disabled={saving || !newContact.name.trim()}
                    style={{ background: saving || !newContact.name.trim() ? '#334155' : '#7c3aed', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
                    {saving ? 'A guardar...' : 'Guardar Contacto'}
                  </button>
                </div>
              )}

              {(!c.contacts || c.contacts.length === 0) ? (
                <div style={{ color: '#475569', textAlign: 'center', padding: '20px' }}>Sem contactos — adiciona manualmente ou usa o Apollo.</div>
              ) : c.contacts.map((ct: any) => (
                <div key={ct.id} style={{ background: '#0f172a', borderRadius: '8px', padding: '12px', marginBottom: '10px', position: 'relative' }}>
                  <button onClick={() => deleteContact(ct.id)}
                    style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#334155')}>×</button>
                  <div style={{ fontWeight: 600, fontSize: '14px', paddingRight: '20px' }}>{ct.name}</div>
                  {ct.role && <div style={{ color: '#60a5fa', fontSize: '12px' }}>{ct.role}{ct.seniority ? ` · ${ct.seniority}` : ''}</div>}
                  {ct.email && <div><a href={'mailto:' + ct.email} style={{ color: '#7c3aed', fontSize: '12px' }}>{ct.email}</a></div>}
                  {ct.phone && <div style={{ color: '#94a3b8', fontSize: '12px' }}>{ct.phone}</div>}
                  {ct.linkedin && <div><a href={ct.linkedin} target="_blank" style={{ color: '#64748b', fontSize: '11px' }}>LinkedIn →</a></div>}
                  <div style={{ marginTop: '6px' }}>
                    {ct.sourceAgent === 'Apollo' && <span style={{ color: '#f59e0b', fontSize: '10px' }}>✦ Apollo</span>}
                    {ct.sourceAgent === 'Manual' && <span style={{ color: '#475569', fontSize: '10px' }}>✎ Manual</span>}
                  </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <input placeholder="Valor estimado (EUR)" value={newOpp.estimatedValue} onChange={e => setNewOpp(o => ({ ...o, estimatedValue: e.target.value }))} style={inputStyle} />
                <input placeholder="Responsavel" value={newOpp.owner} onChange={e => setNewOpp(o => ({ ...o, owner: e.target.value }))} style={inputStyle} />
              </div>
              <select value={newOpp.contactId} onChange={e => setNewOpp(o => ({ ...o, contactId: e.target.value }))}
                style={{ ...inputStyle, marginBottom: '12px', cursor: 'pointer' }}>
                <option value="">Sem contacto associado</option>
                {(c.contacts || []).map((ct: any) => (
                  <option key={ct.id} value={ct.id}>{ct.name}{ct.role ? ' — ' + ct.role : ''}</option>
                ))}
              </select>
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
                    {o.estimatedValue && <div style={{ color: '#4ade80', fontWeight: 700, fontSize: '18px', marginTop: '10px' }}>€{Number(o.estimatedValue).toLocaleString('pt-PT')}</div>}
                    {o.owner && <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>{o.owner}</div>}
                    {/* Contacto associado */}
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #334155' }}>
                      <div style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>Contacto</div>
                      {o.contact ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '13px' }}>{o.contact.name}</div>
                            {o.contact.role && <div style={{ color: '#60a5fa', fontSize: '11px' }}>{o.contact.role}</div>}
                          </div>
                          <button onClick={() => updateOppContact(o.id, '')}
                            style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '16px' }} title="Remover contacto">×</button>
                        </div>
                      ) : (
                        <select onChange={e => updateOppContact(o.id, e.target.value)} defaultValue=""
                          style={{ ...inputStyle, fontSize: '12px', cursor: 'pointer' }}>
                          <option value="">Associar contacto...</option>
                          {(c.contacts || []).map((ct: any) => (
                            <option key={ct.id} value={ct.id}>{ct.name}{ct.role ? ' — ' + ct.role : ''}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '11px', marginTop: '8px' }}>{new Date(o.createdAt).toLocaleDateString('pt-PT')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      
        {activeTab === 'notes' && (
          <div>
            {/* Nova nota */}
            <div style={{ ...card, marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>Nova Nota</div>
              <div style={{ position: 'relative', marginBottom: '8px' }}>
                <textarea
                  placeholder="Escreve uma nota... usa @nome para mencionar alguém"
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) saveNote(); }}
                  style={{ ...inputStyle, height: '100px', resize: 'vertical', fontFamily: 'inherit' }}
                />
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>Usa @menção para mencionar · Cmd+Enter para guardar</div>
              </div>
              <button onClick={saveNote} disabled={saving || !newNote.trim()}
                style={{ background: saving || !newNote.trim() ? '#334155' : '#7c3aed', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
                {saving ? 'A guardar...' : 'Guardar Nota'}
              </button>
            </div>

            {/* Lista de notas */}
            {(!lead.notes || lead.notes.length === 0)
              ? <div style={{ color: '#475569', textAlign: 'center', padding: '40px' }}>Sem notas ainda.</div>
              : lead.notes.map((n: any) => {
                // Highlight @mentions
                const parts = n.content.split(/(@\w+)/g);
                return (
                  <div key={n.id} style={{ ...card, marginBottom: '12px', position: 'relative' }}>
                    <div style={{ fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {parts.map((part: string, i: number) =>
                        part.startsWith('@')
                          ? <span key={i} style={{ color: '#f59e0b', fontWeight: 700 }}>{part}</span>
                          : <span key={i}>{part}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #334155' }}>
                      <div style={{ fontSize: '11px', color: '#475569' }}>
                        {n.createdBy && <span>{n.createdBy} · </span>}
                        {new Date(n.createdAt).toLocaleDateString('pt-PT')} {new Date(n.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                        {n.mentions?.length > 0 && <span style={{ marginLeft: '10px', color: '#f59e0b' }}>@{n.mentions.join(' @')}</span>}
                      </div>
                      <button onClick={() => deleteNote(n.id)}
                        style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '13px', padding: '4px 8px', borderRadius: '4px' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#475569')}>
                        Apagar
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div>
            {/* Nova tarefa */}
            <div style={{ ...card, marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Nova Tarefa</div>
              <input placeholder="Titulo da tarefa *" value={newTask.title} onChange={e => setNewTask(t => ({ ...t, title: e.target.value }))}
                style={{ ...inputStyle, marginBottom: '8px' }} />
              <input placeholder="Descrição (opcional)" value={newTask.description} onChange={e => setNewTask(t => ({ ...t, description: e.target.value }))}
                style={{ ...inputStyle, marginBottom: '8px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#475569', marginBottom: '4px' }}>Prazo</div>
                  <input type="datetime-local" value={newTask.dueAt} onChange={e => setNewTask(t => ({ ...t, dueAt: e.target.value }))}
                    style={{ ...inputStyle, colorScheme: 'dark' }} />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#475569', marginBottom: '4px' }}>Atribuir a</div>
                  <input placeholder="Nome ou email" value={newTask.assignedTo} onChange={e => setNewTask(t => ({ ...t, assignedTo: e.target.value }))}
                    style={inputStyle} />
                </div>
              </div>
              <button onClick={saveTask} disabled={saving || !newTask.title.trim()}
                style={{ background: saving || !newTask.title.trim() ? '#334155' : '#7c3aed', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
                {saving ? 'A guardar...' : 'Criar Tarefa'}
              </button>
            </div>

            {/* Lista de tarefas */}
            {(!lead.tasks || lead.tasks.length === 0)
              ? <div style={{ color: '#475569', textAlign: 'center', padding: '40px' }}>Sem tarefas ainda.</div>
              : lead.tasks.map((t: any) => {
                const overdue = !t.done && t.dueAt && new Date(t.dueAt) < new Date();
                return (
                  <div key={t.id} style={{ ...card, marginBottom: '10px', display: 'flex', gap: '14px', alignItems: 'flex-start', opacity: t.done ? 0.55 : 1 }}>
                    {/* Checkbox */}
                    <div onClick={() => toggleTask(t.id, !t.done)}
                      style={{ width: '20px', height: '20px', borderRadius: '5px', border: '2px solid', borderColor: t.done ? '#4ade80' : '#334155', background: t.done ? '#15803d' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px' }}>
                      {t.done && <span style={{ color: 'white', fontSize: '12px' }}>✓</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', textDecoration: t.done ? 'line-through' : 'none', color: t.done ? '#475569' : '#f8fafc' }}>{t.title}</div>
                      {t.description && <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '2px' }}>{t.description}</div>}
                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '11px', flexWrap: 'wrap' }}>
                        {t.dueAt && (
                          <span style={{ color: overdue ? '#ef4444' : '#94a3b8' }}>
                            {overdue ? '⚠ Atrasada · ' : ''}
                            Prazo: {new Date(t.dueAt).toLocaleDateString('pt-PT')} {new Date(t.dueAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {t.assignedTo && <span style={{ color: '#7c3aed' }}>@ {t.assignedTo}</span>}
                        {t.done && t.doneAt && <span style={{ color: '#4ade80' }}>✓ Concluída em {new Date(t.doneAt).toLocaleDateString('pt-PT')}</span>}
                      </div>
                    </div>
                    <button onClick={() => deleteTask(t.id)}
                      style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: '16px', padding: '2px' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#334155')}>
                      ×
                    </button>
                  </div>
                );
              })}
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

    {showEmailModal && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '32px', width: '480px', maxWidth: '90vw' }}>
          <h3 style={{ color: 'white', margin: '0 0 8px 0', fontSize: '18px' }}>✉ Enviar Lead por Email</h3>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 24px 0' }}>Lead: <strong style={{ color: 'white' }}>{lead.company?.name}</strong></p>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Destinatários automáticos</div>
            {defaultRecipients.length === 0
              ? <div style={{ color: '#475569', fontSize: '12px', fontStyle: 'italic' }}>Nenhum configurado — adiciona em ⚙️ Configurações</div>
              : <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {defaultRecipients.map((rec: string) => (
                    <span key={rec} style={{ background: '#1e3a5f', color: '#60a5fa', padding: '3px 10px', borderRadius: '12px', fontSize: '12px' }}>{rec}</span>
                  ))}
                </div>
            }
          </div>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Destinatários adicionais (separados por vírgula)</div>
            <input type="text" value={extraRecipients} onChange={e => setExtraRecipients(e.target.value)}
              placeholder="email1@exemplo.com, email2@exemplo.com"
              style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: 'white', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowEmailModal(false); setExtraRecipients(''); }}
              style={{ background: 'transparent', color: '#64748b', border: '1px solid #334155', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
              Cancelar
            </button>
            <button onClick={sendEmail} disabled={saving}
              style={{ background: saving ? '#4c1d95' : '#7c3aed', color: 'white', border: 'none', padding: '8px 24px', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
              {saving ? '⏳ A enviar...' : '✉ Enviar Email'}
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
