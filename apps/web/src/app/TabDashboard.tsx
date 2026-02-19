'use client';
import { useState } from 'react';

const tabStyle = (active: boolean) => ({
  padding: '8px 20px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
  borderRadius: '8px 8px 0 0', border: 'none', background: active ? '#1e293b' : 'transparent',
  color: active ? '#f8fafc' : '#64748b', borderBottom: active ? '2px solid #7c3aed' : '2px solid transparent',
  transition: 'all 0.15s',
});

export function TabDashboard({ pipeline, clevels, rfps, expansions, scoring }: {
  pipeline: any[], clevels: any[], rfps: any[], expansions: any[], scoring: any[]
}) {
  const [tab, setTab] = useState('pipeline');

  return (
    <div>
      <div style={{display:'flex', gap:'4px', borderBottom:'1px solid #1e293b', marginBottom:'24px'}}>
        {[
          {id:'pipeline', label:'Pipeline'},
          {id:'clevel', label:'C-Level Changes'},
          {id:'rfp', label:'RFP / Concursos'},
          {id:'expansion', label:'Expansão'},
          {id:'scoring', label:'Lead Scoring'},
        ].map(t => (
          <button key={t.id} style={tabStyle(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'pipeline' && <PipelineTab leads={pipeline} />}
      {tab === 'clevel' && <CLevelTab items={clevels} />}
      {tab === 'rfp' && <RFPTab items={rfps} />}
      {tab === 'expansion' && <ExpansionTab items={expansions} />}
      {tab === 'scoring' && <ScoringTab items={scoring} />}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <div style={{textAlign:'center', color:'#475569', padding:'48px'}}>{msg}</div>;
}

function PipelineTab({ leads }: { leads: any[] }) {
  return (
    <>
      <div className="section-title">Pipeline de Leads</div>
      <table>
        <thead><tr>
          <th>Empresa</th><th>Setor</th><th>Score</th><th>Status</th>
          <th>Último Trigger</th><th>Agente</th><th>Última Atividade</th>
        </tr></thead>
        <tbody>
          {leads.length === 0 ? (
            <tr><td colSpan={7}><EmptyState msg="Nenhum lead ainda." /></td></tr>
          ) : leads.map((lead: any) => (
            <tr key={lead.id}>
              <td style={{fontWeight:600}}>{lead.company?.name || '-'}</td>
              <td style={{color:'#94a3b8'}}>{lead.company?.sector || '-'}</td>
              <td>
                <span style={{fontWeight:700, color: lead.totalScore >= 100 ? '#4ade80' : lead.totalScore >= 70 ? '#60a5fa' : '#94a3b8'}}>
                  {Math.round(lead.totalScore)}
                </span>
                <div className="score-bar"><div className="score-fill" style={{width: Math.min(100, lead.totalScore) + '%'}}></div></div>
              </td>
              <td><span className={'badge-status badge-' + lead.status}>{lead.status}</span></td>
              <td style={{color:'#94a3b8', fontSize:'12px'}}>{lead.company?.signals?.[0]?.triggerType || '-'}</td>
              <td style={{color:'#7c3aed', fontSize:'12px'}}>{lead.company?.signals?.[0]?.agentName?.replace('SAP_S4HANA_','').replace('_Daily','') || '-'}</td>
              <td style={{color:'#64748b', fontSize:'12px'}}>{new Date(lead.lastActivityDate).toLocaleDateString('pt-PT')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function CLevelTab({ items }: { items: any[] }) {
  return (
    <>
      <div className="section-title">C-Level Changes</div>
      <table>
        <thead><tr>
          <th>Empresa</th><th>País</th><th>Setor</th><th>Pessoa</th><th>Cargo</th>
          <th>Impacto ERP</th><th>Fonte</th><th>Data</th>
        </tr></thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={8}><EmptyState msg="Nenhuma alteração C-Level registada." /></td></tr>
          ) : items.map((s: any) => {
            const r = s.rawData || {};
            return (
              <tr key={s.id}>
                <td style={{fontWeight:600}}>{s.company?.name || '-'}</td>
                <td style={{color:'#94a3b8'}}>{r.pais || s.company?.country || '-'}</td>
                <td style={{color:'#94a3b8'}}>{r.setor || s.company?.sector || '-'}</td>
                <td style={{color:'#e2e8f0'}}>{r.nome_pessoa || '-'}</td>
                <td style={{color:'#60a5fa', fontSize:'12px'}}>{r.cargo_alterado || '-'}</td>
                <td style={{color:'#94a3b8', fontSize:'12px', maxWidth:'200px'}}>{r.impacto_ERP || s.summary || '-'}</td>
                <td style={{fontSize:'11px'}}>{s.sourceUrl ? <a href={s.sourceUrl} target="_blank" style={{color:'#7c3aed'}}>🔗</a> : '-'}</td>
                <td style={{color:'#64748b', fontSize:'12px'}}>{new Date(s.createdAt).toLocaleDateString('pt-PT')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function RFPTab({ items }: { items: any[] }) {
  return (
    <>
      <div className="section-title">RFP / Concursos Públicos</div>
      <table>
        <thead><tr>
          <th>Entidade</th><th>País</th><th>Descrição</th><th>Valor Estimado</th>
          <th>Pertinência ERP</th><th>Fonte</th><th>Data</th>
        </tr></thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={7}><EmptyState msg="Nenhum RFP registado." /></td></tr>
          ) : items.map((s: any) => {
            const r = s.rawData || {};
            return (
              <tr key={s.id}>
                <td style={{fontWeight:600}}>{s.company?.name || '-'}</td>
                <td style={{color:'#94a3b8'}}>{r.pais || '-'}</td>
                <td style={{color:'#94a3b8', fontSize:'12px', maxWidth:'250px'}}>{r.descricao || s.summary || '-'}</td>
                <td style={{color:'#4ade80', fontWeight:600}}>{r.valor_estimado || '-'}</td>
                <td><span style={{
                  background: r.pertinencia_ERP === 'Alto' ? '#166534' : '#1e293b',
                  color: r.pertinencia_ERP === 'Alto' ? '#4ade80' : '#94a3b8',
                  padding:'2px 8px', borderRadius:'8px', fontSize:'11px'
                }}>{r.pertinencia_ERP || '-'}</span></td>
                <td style={{fontSize:'11px'}}>{s.sourceUrl ? <a href={s.sourceUrl} target="_blank" style={{color:'#7c3aed'}}>🔗</a> : '-'}</td>
                <td style={{color:'#64748b', fontSize:'12px'}}>{new Date(s.createdAt).toLocaleDateString('pt-PT')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function ExpansionTab({ items }: { items: any[] }) {
  return (
    <>
      <div className="section-title">Expansão de Empresas</div>
      <table>
        <thead><tr>
          <th>Empresa</th><th>País</th><th>Setor</th><th>Tipo Expansão</th>
          <th>Impacto ERP</th><th>Probabilidade</th><th>Data</th>
        </tr></thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={7}><EmptyState msg="Nenhuma expansão registada." /></td></tr>
          ) : items.map((s: any) => {
            const r = s.rawData || {};
            return (
              <tr key={s.id}>
                <td style={{fontWeight:600}}>{s.company?.name || '-'}</td>
                <td style={{color:'#94a3b8'}}>{r.pais || s.company?.country || '-'}</td>
                <td style={{color:'#94a3b8'}}>{r.setor || s.company?.sector || '-'}</td>
                <td style={{color:'#60a5fa', fontSize:'12px'}}>{r.tipo_expansao || '-'}</td>
                <td style={{color:'#94a3b8', fontSize:'12px', maxWidth:'200px'}}>{r.impacto_ERP || s.summary || '-'}</td>
                <td><span style={{
                  background: r.probabilidade === 'Alta' ? '#166534' : '#1e293b',
                  color: r.probabilidade === 'Alta' ? '#4ade80' : '#94a3b8',
                  padding:'2px 8px', borderRadius:'8px', fontSize:'11px'
                }}>{r.probabilidade || '-'}</span></td>
                <td style={{color:'#64748b', fontSize:'12px'}}>{new Date(s.createdAt).toLocaleDateString('pt-PT')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function ScoringTab({ items }: { items: any[] }) {
  return (
    <>
      <div className="section-title">Lead Scoring</div>
      <table>
        <thead><tr>
          <th>Empresa</th><th>País</th><th>Setor</th><th>Score Final</th>
          <th>Trigger</th><th>Probabilidade</th><th>Resumo</th><th>Data</th>
        </tr></thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={8}><EmptyState msg="Nenhum lead scoring registado." /></td></tr>
          ) : items.map((s: any) => {
            const r = s.rawData || {};
            return (
              <tr key={s.id}>
                <td style={{fontWeight:600}}>{s.company?.name || '-'}</td>
                <td style={{color:'#94a3b8'}}>{r.pais || s.company?.country || '-'}</td>
                <td style={{color:'#94a3b8'}}>{r.setor || s.company?.sector || '-'}</td>
                <td>
                  <span style={{fontWeight:700, color: s.score_final >= 80 ? '#4ade80' : s.score_final >= 50 ? '#60a5fa' : '#94a3b8'}}>
                    {Math.round(s.score_final)}
                  </span>
                </td>
                <td style={{color:'#94a3b8', fontSize:'12px'}}>{r.trigger || '-'}</td>
                <td style={{color:'#94a3b8', fontSize:'12px'}}>{r.probabilidade || '-'}</td>
                <td style={{color:'#94a3b8', fontSize:'12px', maxWidth:'200px'}}>{r.resumo || s.summary || '-'}</td>
                <td style={{color:'#64748b', fontSize:'12px'}}>{new Date(s.createdAt).toLocaleDateString('pt-PT')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
