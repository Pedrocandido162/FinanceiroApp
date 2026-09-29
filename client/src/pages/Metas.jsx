import { useEffect, useState } from 'react';
import { api, BRL } from '../api.js';

export default function Metas() {
  const [metas, setMetas] = useState([]);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({ nome: '', valor_alvo: '' });
  const [valores, setValores] = useState({});

  const load = () => api('/metas').then(setMetas).catch((e) => setErro(e.message));
  useEffect(() => { load(); }, []);

  async function criar(e) {
    e.preventDefault();
    setErro('');
    try {
      await api('/metas', { method: 'POST', body: { ...form, valor_alvo: Number(form.valor_alvo) } });
      setForm({ nome: '', valor_alvo: '' });
      await load();
    } catch (err) { setErro(err.message); }
  }

  async function guardar(m) {
    const v = Number(valores[m.id]);
    if (!v || v <= 0) return;
    await api(`/metas/${m.id}/guardar`, { method: 'POST', body: { valor: v } });
    setValores((x) => ({ ...x, [m.id]: '' }));
    await load();
  }

  async function excluir(m) {
    if (!confirm(`Excluir a meta "${m.nome}"?`)) return;
    await api(`/metas/${m.id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <>
      <h1>Metas financeiras</h1>
      {erro && <div className="erro">{erro}</div>}
      <div className="panel">
        <h2>Nova meta</h2>
        <form className="inline" onSubmit={criar}>
          <input placeholder="Nome da meta (ex.: Comprar notebook)" required style={{ flex: 1, minWidth: 200 }}
            value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input type="number" step="0.01" min="1" placeholder="Valor alvo (R$)" style={{ width: 160 }} required
            value={form.valor_alvo} onChange={(e) => setForm({ ...form, valor_alvo: e.target.value })} />
          <button className="solid" type="submit">Criar meta</button>
        </form>
      </div>

      <div className="panel">
        {metas.length === 0 && <p className="muted">Nenhuma meta criada ainda.</p>}
        {metas.map((m) => {
          const pct = Math.min((m.valor_guardado / m.valor_alvo) * 100, 100);
          return (
            <div key={m.id} className="row" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <strong>{m.nome}</strong>
                  <span className="num">{pct.toFixed(0)}%</span>
                </div>
                <div className="prog" style={{ margin: '8px 0 4px' }}><i style={{ width: `${pct}%` }} /></div>
                <div className="muted num">{BRL(m.valor_guardado)} de {BRL(m.valor_alvo)}{pct >= 100 ? ' · meta atingida 🎉' : ''}</div>
                <div className="inline" style={{ marginTop: 8 }}>
                  <input type="number" step="0.01" min="0.01" placeholder="Guardar R$" style={{ width: 130 }}
                    value={valores[m.id] || ''} onChange={(e) => setValores({ ...valores, [m.id]: e.target.value })} />
                  <button onClick={() => guardar(m)}>Adicionar</button>
                </div>
              </div>
              <button onClick={() => excluir(m)}>Excluir</button>
            </div>
          );
        })}
      </div>
    </>
  );
}
