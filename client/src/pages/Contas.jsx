import { useEffect, useState } from 'react';
import { api, BRL, hojeISO } from '../api.js';

const TIPOS = [['corrente', 'Conta corrente'], ['dinheiro', 'Dinheiro'], ['digital', 'Carteira digital'], ['poupanca', 'Poupança'], ['investimento', 'Investimentos']];

export default function Contas() {
  const [contas, setContas] = useState([]);
  const [transf, setTransf] = useState([]);
  const [erro, setErro] = useState('');
  const [nova, setNova] = useState({ nome: '', tipo: 'corrente', saldo_inicial: '' });
  const [t, setT] = useState({ conta_origem_id: '', conta_destino_id: '', valor: '' });

  const load = () => Promise.all([api('/contas').then(setContas), api('/transferencias').then(setTransf)]).catch((e) => setErro(e.message));
  useEffect(() => { load(); }, []);

  async function criarConta(e) {
    e.preventDefault();
    setErro('');
    try {
      await api('/contas', { method: 'POST', body: { ...nova, saldo_inicial: Number(nova.saldo_inicial) || 0 } });
      setNova({ nome: '', tipo: 'corrente', saldo_inicial: '' });
      await load();
    } catch (err) { setErro(err.message); }
  }

  async function transferir(e) {
    e.preventDefault();
    setErro('');
    try {
      await api('/transferencias', { method: 'POST', body: { ...t, valor: Number(t.valor), data: hojeISO() } });
      setT({ conta_origem_id: '', conta_destino_id: '', valor: '' });
      await load();
    } catch (err) { setErro(err.message); }
  }

  const total = contas.reduce((s, c) => s + Number(c.saldo), 0);

  return (
    <>
      <h1>Contas e carteiras</h1>
      {erro && <div className="erro">{erro}</div>}
      <div className="grid2">
        <div className="panel">
          <h2>Minhas contas · total {BRL(total)}</h2>
          {contas.map((c) => (
            <div key={c.id} className="row">
              <div className="grow"><div>{c.nome}</div><div className="muted">{TIPOS.find(([k]) => k === c.tipo)?.[1]}</div></div>
              <span className="num" style={{ fontWeight: 600, color: c.saldo < 0 ? 'var(--red)' : 'inherit' }}>{BRL(c.saldo)}</span>
            </div>
          ))}
          <form className="inline" onSubmit={criarConta} style={{ marginTop: 14 }}>
            <input placeholder="Nome da conta" required value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} />
            <select value={nova.tipo} onChange={(e) => setNova({ ...nova, tipo: e.target.value })}>
              {TIPOS.map(([k, lbl]) => <option key={k} value={k}>{lbl}</option>)}
            </select>
            <input type="number" step="0.01" placeholder="Saldo inicial" style={{ width: 130 }}
              value={nova.saldo_inicial} onChange={(e) => setNova({ ...nova, saldo_inicial: e.target.value })} />
            <button className="solid" type="submit">Adicionar</button>
          </form>
        </div>

        <div>
          <div className="panel">
            <h2>Transferência entre contas</h2>
            <form className="inline" onSubmit={transferir}>
              <select required value={t.conta_origem_id} onChange={(e) => setT({ ...t, conta_origem_id: e.target.value })}>
                <option value="">Origem…</option>
                {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <span className="muted">→</span>
              <select required value={t.conta_destino_id} onChange={(e) => setT({ ...t, conta_destino_id: e.target.value })}>
                <option value="">Destino…</option>
                {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <input type="number" step="0.01" min="0.01" placeholder="Valor" style={{ width: 110 }} required
                value={t.valor} onChange={(e) => setT({ ...t, valor: e.target.value })} />
              <button className="solid" type="submit">Transferir</button>
            </form>
            <p className="muted">A transferência sai de uma conta e entra na outra — sem contabilizar como receita ou despesa.</p>
          </div>
          <div className="panel">
            <h2>Últimas transferências</h2>
            {transf.length === 0 && <p className="muted">Nenhuma transferência ainda.</p>}
            {transf.map((tr) => (
              <div key={tr.id} className="row">
                <div className="grow"><div>{tr.origem} → {tr.destino}</div><div className="muted num">{tr.data.split('-').reverse().join('/')}</div></div>
                <span className="num">{BRL(tr.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
