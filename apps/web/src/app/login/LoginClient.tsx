'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const LAST_NAME_KEY = 'crm_last_username';

export default function LoginPage() {
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Remember the last name used on this device so the user doesn't have to
  // retype it after the 30-day session expires. Not for security — just UX.
  useEffect(() => {
    try {
      const last = localStorage.getItem(LAST_NAME_KEY) || '';
      if (last) setUserName(last);
    } catch {}
  }, []);

  const handleSubmit = async () => {
    if (!userName.trim() || !password) return;
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: userName.trim(), password }),
    });
    if (res.ok) {
      try { localStorage.setItem(LAST_NAME_KEY, userName.trim()); } catch {}
      router.push('/');
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || 'Credenciais incorrectas.');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#1e293b', borderRadius: '16px', padding: '40px', width: '360px', boxShadow: '0 8px 32px #00000044' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc' }}>Ai CRM</div>
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Gobii Intelligence</div>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Nome</label>
          <input
            type="text"
            value={userName}
            onChange={e => setUserName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Ex: Miguel"
            maxLength={50}
            style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', padding: '10px 14px', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
          />
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
            Aparece nos registos de actividade — usa o teu nome real.
          </div>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="••••••••"
            style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', padding: '10px 14px', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
          />
        </div>
        {error && <div style={{ color: '#f87171', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
        <button
          onClick={handleSubmit}
          disabled={loading || !password || !userName.trim()}
          style={{ width: '100%', background: '#7c3aed', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: loading || !password || !userName.trim() ? 'not-allowed' : 'pointer', opacity: loading || !password || !userName.trim() ? 0.7 : 1 }}>
          {loading ? 'A entrar...' : 'Entrar'}
        </button>
      </div>
    </div>
  );
}
