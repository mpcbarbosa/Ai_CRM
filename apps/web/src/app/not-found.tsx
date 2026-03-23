'use client';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>404</div>
        <div style={{ fontSize: '16px', marginBottom: '24px' }}>Página não encontrada</div>
        <a href="/" style={{ color: '#7c3aed', textDecoration: 'none', fontSize: '14px' }}>← Voltar ao Dashboard</a>
      </div>
    </div>
  );
}
