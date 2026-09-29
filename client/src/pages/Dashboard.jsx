import { useEffect, useState } from 'react';
import { api, BRL, dataBR } from '../api.js';

function Kpi({ lbl, val, cls, sub }) {
  return <div className="kpi"><div className="lbl">{lbl}</div><div className={'val num ' + (cls || '')}>{val}</div>{sub && <div className="muted num">{sub}</div>}</div>;
}

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => { api('/dashboard').then(setD).catch((e) => setErro(e.message)); }, []);

  if (erro) return <div className="erro">{erro}</div>;
  if (!d) return <p className="muted">Carregando…</p>;

  const max = Math.max(...d.evolucao.flatMap((m) => [m.receitas, m.despesas]), 1);
  const catMax = d.categorias[0]?.total || 1;

  return (
    <>
      <h1>Dashboard</h1>
      <div className="kpis">
        <Kpi lbl="Saldo atual" val={BRL(d.saldo)} />
        <Kpi lbl="Receitas do mês" val={BRL(d.receitas)} cls="pos" />
        <Kpi lbl="Despesas do mês" val={BRL(d.despesas)} cls="neg" />
        <Kpi lbl="Resultado do mês" val={(d.resultado >= 0 ? '+' : '') + BRL(d.resultado)} cls={d.resultado >= 0 ? 'pos' : 'neg'} />
        <Kpi lbl="Contas a pagar" val={BRL(d.contas_a_pagar)} cls="neg" />
        <Kpi lbl="Contas a receber" val={BRL(d.contas_a_receber)} cls="pos" />
      </div>

      <div className="grid2">
        <div className="panel">
          <h2>Receitas x despesas · 6 meses</h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, height: 180, paddingTop: 12 }}>
            {d.evolucao.map((m) => (
              <div key={m.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 140 }}>
                  <div title={`Receitas ${BRL(m.receitas)}`} style={{ width: 16, height: `${(m.receitas / max) * 100}%`, background: 'var(--accent)', borderRadius: 3 }} />
                  <div title={`Despesas ${BRL(m.despesas)}`} style={{ width: 16, height: `${(m.despesas / max) * 100}%`, background: 'var(--red)', borderRadius: 3 }} />
                </div>
                <span className="muted" style={{ fontSize: 12 }}>{m.mes.slice(5)}/{m.mes.slice(2, 4)}</span>
              </div>
            ))}
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            <span style={{ color: 'var(--accent)' }}>■</span> Receitas&nbsp;&nbsp;<span style={{ color: 'var(--red)' }}>■</span> Despesas
          </div>
        </div>

        <div className="panel">
          <h2>Despesas por categoria · mês atual</h2>
          {d.categorias.length === 0 && <p className="muted">Sem despesas neste mês.</p>}
          {d.categorias.map((c, i) => (
            <div key={c.nome} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 110, fontSize: 13 }}>{c.nome}</span>
              <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${(c.total / catMax) * 100}%`, height: '100%', background: `color-mix(in srgb, var(--accent) ${100 - i * 10}%, transparent)`, borderRadius: 999 }} />
              </div>
              <span className="num muted" style={{ width: 90, textAlign: 'right' }}>{BRL(c.total)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Próximos vencimentos</h2>
        {d.vencimentos.length === 0 && <p className="muted">Nenhum vencimento pendente. 🎉</p>}
        {d.vencimentos.map((v) => (
          <div key={v.id} className="row">
            <div className="grow"><div>{v.descricao}</div><div className="muted num">{dataBR(v.vencimento)} · {v.categoria}</div></div>
            <span className="num">{BRL(v.valor)}</span>
            <span className={'pill ' + (v.tipo === 'receita' ? 'ok' : '')}>{v.tipo === 'receita' ? 'a receber' : 'a pagar'}</span>
          </div>
        ))}
      </div>
    </>
  );
}
