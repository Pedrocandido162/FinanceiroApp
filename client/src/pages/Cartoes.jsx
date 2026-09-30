
import { useEffect, useState } from 'react';
import { api, BRL } from '../api.js';

export default function Cartoes() {
  const [grupos, setGrupos] = useState([]);
  const [compras, setCompras] = useState({});
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({ banco: '', nome: '', limite: '', fechamento_dia: 25, vencimento_dia: 5 });

  const load = () => api('/cartoes/bancos').then(setGrupos).catch((e) => setErro(e.message));
  useEffect(() => { load(); }, []);

  async function criar(e) {
    e.preventDefault();
    setErro('');
    try {
      await api('/cartoes', { method: 'POST', body: { ...form, limite: Number(form.limite) || 0 } });
      setForm({ banco: '', nome: '', limite: '', fechamento_dia: 25, vencimento_dia: 5 });
      await load();
    } catch (err) { setErro(err.message); }
  }

  async function verCompras(c) {
    const data = await api(`/cartoes/${c.id}/compras`);
    setCompras((m) => ({ ...m, [c.id]: m[c.id] ? undefined : data }));
  }

  return (
    <>
      <h1>Cartões de crédito</h1>
      {erro && <div className="erro">{erro}</div>}
      <div className="panel">
        <h2>Novo cartão (inclusive virtual — use o mesmo banco para agrupar)</h2>
        <form className="inline" onSubmit={criar}>
          <input list="bancos" placeholder="Banco (ex.: NuBank)" style={{ width: 160 }}
            value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} />
          <datalist id="bancos">
            {[...new Set(grupos.map((g) => g.banco).filter((b) => b !== 'Outros'))].map((b) => <option key={b} value={b} />)}
          </datalist>
          <input placeholder="Nome (ex.: Virtual 1)" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input type="number" step="0.01" min="0" placeholder="Limite" style={{ width: 120 }} required value={form.limite} onChange={(e) => setForm({ ...form, limite: e.target.value })} />
          <label className="muted">Fecha dia <input type="number" min="1" max="31" style={{ width: 64 }} value={form.fechamento_dia} onChange={(e) => setForm({ ...form, fechamento_dia: e.target.value })} /></label>
          <label className="muted">Vence dia <input type="number" min="1" max="31" style={{ width: 64 }} value={form.vencimento_dia} onChange={(e) => setForm({ ...form, vencimento_dia: e.target.value })} /></label>
          <button className="solid" type="submit">Adicionar</button>
        </form>
      </div>

      {grupos.map((g) => (
        <div key={g.banco} className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, alignItems: 'baseline' }}>
            <h2 style={{ margin: 0 }}>🏦 {g.banco}</h2>
            <span className="muted num">Limite total {BRL(g.limite)} · utilizado {BRL(g.usado)} · disponível {BRL(g.disponivel)} ({g.limite ? (g.usado / g.limite * 100).toFixed(0) : 0}%)</span>
          </div>
          <div className="prog" style={{ margin: '10px 0 16px' }}>
            <i style={{ width: `${g.limite ? Math.min(g.usado / g.limite * 100, 100) : 0}%`, background: g.limite && g.usado / g.limite > 0.8 ? 'var(--red)' : 'var(--accent)' }} />
          </div>

          {g.cartoes.map((c) => {
            const pct = c.limite ? (c.usado / c.limite) * 100 : 0;
            return (
              <div key={c.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <strong>{c.nome}</strong>
                  <span className="muted num">Fecha dia {c.fechamento_dia} · vence dia {String(c.vencimento_dia).padStart(2, '0')}</span>
                </div>
                <div className="kpis" style={{ marginTop: 12, marginBottom: 0 }}>
                  <div className="kpi"><div className="lbl">Limite</div><div className="val num">{BRL(c.limite)}</div></div>
                  <div className="kpi"><div className="lbl">Disponível</div><div className="val num">{BRL(c.disponivel)}</div><div className="muted">{pct.toFixed(0)}% usado</div></div>
                  <div className="kpi"><div className="lbl">Fatura atual</div><div className="val num neg">{BRL(c.fatura_atual)}</div></div>
                </div>
                <button style={{ marginTop: 12 }} onClick={() => verCompras(c)}>{compras[c.id] ? 'Ocultar compras' : 'Ver compras'}</button>
                {compras[c.id] && (
                  <table style={{ marginTop: 12 }}>
                    <thead><tr><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
                    <tbody>
                      {compras[c.id].map((x) => (
                        <tr key={x.id}>
                          <td>{x.descricao}</td><td className="muted">{x.categoria}</td>
                          <td className="num muted">{x.data_vencimento.split('-').reverse().join('/')}</td>
                          <td className="num" style={{ textAlign: 'right' }}>{BRL(x.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {grupos.length === 0 && <p className="muted">Nenhum cartão cadastrado.</p>}
    </>
  );
}
