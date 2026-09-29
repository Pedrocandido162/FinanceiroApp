import { useEffect, useState } from 'react';
import { api, BRL } from '../api.js';

export default function Cartoes() {
  const [cartoes, setCartoes] = useState([]);
  const [compras, setCompras] = useState({});
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({ nome: '', limite: '', fechamento_dia: 25, vencimento_dia: 5 });

  const load = () => api('/cartoes').then(setCartoes).catch((e) => setErro(e.message));
  useEffect(() => { load(); }, []);

  async function criar(e) {
    e.preventDefault();
    setErro('');
    try {
      await api('/cartoes', { method: 'POST', body: { ...form, limite: Number(form.limite) || 0 } });
      setForm({ nome: '', limite: '', fechamento_dia: 25, vencimento_dia: 5 });
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
        <h2>Novo cartão</h2>
        <form className="inline" onSubmit={criar}>
          <input placeholder="Nome do cartão" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input type="number" step="0.01" min="0" placeholder="Limite" style={{ width: 130 }} required value={form.limite} onChange={(e) => setForm({ ...form, limite: e.target.value })} />
          <label className="muted">Fecha dia <input type="number" min="1" max="31" style={{ width: 70 }} value={form.fechamento_dia} onChange={(e) => setForm({ ...form, fechamento_dia: e.target.value })} /></label>
          <label className="muted">Vence dia <input type="number" min="1" max="31" style={{ width: 70 }} value={form.vencimento_dia} onChange={(e) => setForm({ ...form, vencimento_dia: e.target.value })} /></label>
          <button className="solid" type="submit">Adicionar</button>
        </form>
      </div>

      {cartoes.map((c) => {
        const pct = c.limite ? (c.usado / c.limite) * 100 : 0;
        return (
          <div key={c.id} className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <h2 style={{ margin: 0 }}>{c.nome}</h2>
              <span className="muted num">Fecha dia {c.fechamento_dia} · vence dia {String(c.vencimento_dia).padStart(2, '0')}</span>
            </div>
            <div className="kpis" style={{ marginTop: 12 }}>
              <div className="kpi"><div className="lbl">Limite total</div><div className="val num">{BRL(c.limite)}</div></div>
              <div className="kpi"><div className="lbl">Limite disponível</div><div className="val num">{BRL(c.disponivel)}</div><div className="muted">{pct.toFixed(0)}% utilizado</div></div>
              <div className="kpi"><div className="lbl">Fatura atual</div><div className="val num neg">{BRL(c.fatura_atual)}</div></div>
              <div className="kpi"><div className="lbl">Próximas faturas</div><div className="val num">{BRL(c.proximas_faturas.reduce((s, f) => s + f.valor, 0))}</div></div>
            </div>
            <div className="prog"><i style={{ width: `${Math.min(pct, 100)}%`, background: pct > 80 ? 'var(--red)' : 'var(--accent)' }} /></div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
              {c.proximas_faturas.map((f) => (
                <span key={f.mes} className="muted num">Fatura {f.mes}: {BRL(f.valor)} ({f.parcelas}x)</span>
              ))}
              <button onClick={() => verCompras(c)}>{compras[c.id] ? 'Ocultar compras' : 'Ver compras'}</button>
            </div>
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
      {cartoes.length === 0 && <p className="muted">Nenhum cartão cadastrado.</p>}
    </>
  );
}
