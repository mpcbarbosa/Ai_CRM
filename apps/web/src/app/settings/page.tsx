'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://ai-crm-api-pcdn.onrender.com';

export default function SettingsPage() {
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [mqlThreshold, setMqlThreshold] = useState(70);
  const [sqlThreshold, setSqlThreshold] = useState(100);
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(API + '/api/settings')
      .then(r => r.json())
      .then(d => {
        setRecipients(d.email_recipients || []);
        setMqlThreshold(Number(d.mql_threshold) || 70);
        setSqlThreshold(Number(d.sql_threshold) || 100);
        setLoading(false);
      });
  }, []);

  async function saveSetting(key: string, value: any) {
    await fetch(API + '/api/settings/' + key, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
  }

  function addRecipient() {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes('@') || recipients.includes(email)) return;
    const updated = [...recipients, email];
    setRecipients(updated);
    setNewEmail('');
    saveSetting('email_recipients', updated);
  }

  function removeRecipient(email: string) {
    const updated = recipients.filter(r => r !== email);
    setRecipients(updated);
    saveSetting('email_recipients', updated);
  }

  const card = (title: string, children: React.ReactNode) => (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
      <h3 style={{ color: 'white', margin: '0 0 20px 0', fontSize: '16px', fontWeight: 700 }}>{title}</h3>
      {children}
    </div>
  );

  const label = (text: string) => (
    <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '8px' }}>{text}</div>
  );

  const savedBadge = (key: string) => saved === key ? (
    <span style={{ color: '#4ade80', fontSize: '12px', marginLeft: '8px' }}>✓ Guardado</span>
  ) : null;

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#64748b' }}>A carregar configurações...</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', padding: '32px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <a href="/" style={{ color: '#64748b', textDecoration: 'none', fontSize: '13px' }}>← Voltar ao Dashboard</a>
        </div>
        <h1 style={{ color: 'white', fontSize: '24px', fontWeight: 700, margin: '0 0 8px 0' }}>⚙️ Configurações</h1>
        <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 32px 0' }}>Administração do Gobii AI CRM</p>

        {/* Email Recipients */}
        {card('✉️ Destinatários de Email', (
          <div>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 16px 0' }}>
              Estes emails recebem automaticamente os resumos de leads enviados pelo botão "Enviar por Email".
            </p>
            
            {/* Current recipients */}
            <div style={{ marginBottom: '16px' }}>
              {recipients.length === 0 && (
                <div style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic' }}>Nenhum destinatário configurado.</div>
              )}
              {recipients.map(email => (
                <div key={email} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0f172a', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px' }}>
                  <span style={{ color: '#60a5fa', fontSize: '13px' }}>{email}</span>
                  <button onClick={() => removeRecipient(email)}
                    style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '2px 8px' }}>
                    Remover
                  </button>
                </div>
              ))}
            </div>

            {/* Add new */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addRecipient()}
                placeholder="novo@email.com"
                style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', color: 'white', padding: '10px 12px', borderRadius: '8px', fontSize: '13px' }}
              />
              <button onClick={addRecipient}
                style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
                + Adicionar
              </button>
            </div>
            {savedBadge('email_recipients')}
          </div>
        ))}

        {/* Scoring Thresholds */}
        {card('📊 Thresholds de Scoring', (
          <div>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 20px 0' }}>
              Define os limites de score para qualificação automática de leads.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                {label('MQL — Marketing Qualified')}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="number" value={mqlThreshold} onChange={e => setMqlThreshold(Number(e.target.value))}
                    style={{ width: '80px', background: '#0f172a', border: '1px solid #334155', color: '#1d4ed8', padding: '8px 12px', borderRadius: '8px', fontSize: '16px', fontWeight: 700 }} />
                  <span style={{ color: '#64748b', fontSize: '12px' }}>pontos</span>
                  <button onClick={() => saveSetting('mql_threshold', mqlThreshold)}
                    style={{ background: '#1e3a5f', color: '#60a5fa', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>
                    Guardar
                  </button>
                  {savedBadge('mql_threshold')}
                </div>
              </div>

              <div>
                {label('SQL — Sales Qualified')}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="number" value={sqlThreshold} onChange={e => setSqlThreshold(Number(e.target.value))}
                    style={{ width: '80px', background: '#0f172a', border: '1px solid #334155', color: '#15803d', padding: '8px 12px', borderRadius: '8px', fontSize: '16px', fontWeight: 700 }} />
                  <span style={{ color: '#64748b', fontSize: '12px' }}>pontos</span>
                  <button onClick={() => saveSetting('sql_threshold', sqlThreshold)}
                    style={{ background: '#052e16', color: '#4ade80', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>
                    Guardar
                  </button>
                  {savedBadge('sql_threshold')}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* System Info */}
        {card('🖥️ Sistema', (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {[
              { label: 'API', value: 'ai-crm-api-pcdn.onrender.com', color: '#4ade80' },
              { label: 'Dashboard', value: 'ai-crm-web-4blo.onrender.com', color: '#4ade80' },
              { label: 'Base de Dados', value: 'PostgreSQL — Frankfurt', color: '#60a5fa' },
              { label: 'Versão', value: 'Gobii CRM v1.0', color: '#94a3b8' },
            ].map(item => (
              <div key={item.label} style={{ background: '#0f172a', borderRadius: '8px', padding: '12px 16px' }}>
                <div style={{ color: '#475569', fontSize: '11px', textTransform: 'uppercase' as const, marginBottom: '4px' }}>{item.label}</div>
                <div style={{ color: item.color, fontSize: '12px', fontFamily: 'monospace' }}>{item.value}</div>
              </div>
            ))}
          </div>
        ))}

      </div>
    </div>
  );
}
