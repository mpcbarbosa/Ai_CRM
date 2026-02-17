import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ai CRM',
  description: 'Intelligent CRM for Gobii agents',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; }
          .container { max-width: 1400px; margin: 0 auto; padding: 24px; }
          .header { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid #1e293b; }
          .header h1 { font-size: 24px; font-weight: 700; color: #f8fafc; }
          .header .badge { background: #7c3aed; color: white; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
          .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
          .kpi-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; }
          .kpi-card .label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
          .kpi-card .value { font-size: 32px; font-weight: 700; color: #f8fafc; }
          .kpi-card .sub { font-size: 12px; color: #64748b; margin-top: 4px; }
          .kpi-card.green .value { color: #4ade80; }
          .kpi-card.blue .value { color: #60a5fa; }
          .kpi-card.purple .value { color: #a78bfa; }
          .kpi-card.orange .value { color: #fb923c; }
          .section-title { font-size: 18px; font-weight: 600; color: #f1f5f9; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 12px; overflow: hidden; }
          th { background: #0f172a; padding: 12px 16px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600; }
          td { padding: 14px 16px; border-top: 1px solid #1e293b; font-size: 14px; }
          tr:hover td { background: #1a2744; }
          .badge-status { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; display: inline-block; }
          .badge-NEW { background: #1e293b; color: #94a3b8; border: 1px solid #334155; }
          .badge-MQL { background: #1e3a5f; color: #60a5fa; }
          .badge-SQL { background: #14532d; color: #4ade80; }
          .badge-LOST { background: #3b0f0f; color: #f87171; }
          .score-bar { background: #0f172a; border-radius: 4px; height: 6px; overflow: hidden; margin-top: 4px; }
          .score-fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg, #7c3aed, #60a5fa); }
          a { color: #60a5fa; text-decoration: none; }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="header">
            <h1>Ai CRM</h1>
            <span className="badge">Gobii Intelligence</span>
          </div>
          {children}
        </div>
      </body>
    </html>
  )
}
