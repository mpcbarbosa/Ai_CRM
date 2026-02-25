'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push('/');
    } else {
      setError('Password incorreta.');
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
          disabled={loading || !password}
          style={{ width: '100%', background: '#7c3aed', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: loading || !password ? 'not-allowed' : 'pointer', opacity: loading || !password ? 0.7 : 1 }}>
          {loading ? 'A entrar...' : 'Entrar'}
        </button>
      </div>
    </div>
  );
}
