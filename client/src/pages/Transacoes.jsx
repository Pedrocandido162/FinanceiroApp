import { useEffect, useState } from 'react';
import { api, BRL, dataBR, hojeISO } from '../api.js';

const FORMAS = ['pix', 'dinheiro', 'debito', 'credito', 'boleto', 'transferencia'];

export default function Transacoes() {
  const [lista, setLista] = useState([]);
  const [contas, setContas] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({
    tipo: 'despesa', valor: '', data_vencimento: hojeISO(), categoria: '', descricao: '',
    forma_pagamento: 'pix', conta_id: '', cartao_id: '', status: 'pago', parcelas: 1,
    recorrencia: 'unica', comprovante: null,
  });

  const load = () => Promise.all([
    api('/transacoes').then(setLista),
    api('/contas').then(setContas),
    api('/cartoes').then(setCartoes),
  ]).catch((e) => setErro(e.message));
  useEffect(() => { load(); }, []);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setErro('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v !== '' && v !== null) fd.append(k, v); });
      await api('/transacoes', { method: 'POST', formData: fd });
      setForm({ ...form, valor: '', descricao: '', categoria: '', parcelas: 1, recorrencia: 'unica', comprovante: null });
      e.target.reset();
      await load();
    } catch (err) { setErro(err.message); }
  }

  async function pagar(t) {
    await api(`/transacoes/${t.id}/pagar`, { method: 'PATCH', body: {} });
    await load();
  }
  async function excluir(t) {
    if (!confirm(`Excluir "${t.descricao}"?`)) return;
    await api(`/transacoes/${t.id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <>
      <h1>Receitas e despesas</h1>
      <div className="panel">
        <h2>Nova movimentação</h2>
        {erro && <div className="erro">{erro}</div>}
        <form className="inline" onSubmit={submit}>
          <select value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>
            <option value="despesa">Despesa</option><option value="receita">Receita</option>
          </select>
          <input type="number" step="0.01" min="0.01" placeholder="Valor (R$)" required style={{ width: 130 }}
            value={form.valor} onChange={(e) => set('valor', e.target.value)} />
          <input type="date" required value={form.data_vencimento} onChange={(e) => set('data_vencimento', e.target.value)} />
          <input placeholder="Descrição" required style={{ flex: 1, minWidth: 150 }}
            value={form.descricao} onChange={(e) => set('descricao', e.target.value)} />
          <input placeholder="Categoria" style={{ width: 130 }} value={form.categoria} onChange={(e) => set('categoria', e.target.value)} />
          <select value={form.forma_pagamento} onChange={(e) => set('forma_pagamento', e.target.value)}>
            {FORMAS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={form.conta_id} onChange={(e) => set('conta_id', e.target.value)}>
            <option value="">Sem conta</option>
            {contas.map((c) => <option key={c.id} value={c.id}>Conta: {c.nome}</option>)}
          </select>
          <select value={form.cartao_id} onChange={(e) => set('cartao_id', e.target.value)}>
            <option value="">Sem cartão</option>
            {cartoes.map((c) => <option key={c.id} value={c.id}>Cartão: {c.nome}</option>)}
          </select>
          <select value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option value="pago">Pago</option><option value="pendente">Pendente</option>
          </select>
          <input type="number" min="1" max="60" title="Parcelas (financiamento, parcela de banco)" style={{ width: 90 }}
            value={form.parcelas} onChange={(e) => set('parcelas', e.target.value)} />
          <select title="Recorrência" value={form.recorrencia} onChange={(e) => set('recorrencia', e.target.value)}>
            <option value="unica">Única</option>
            <option value="mensal">Mensal (fixa)</option>
          </select>
          <input type="file" accept="image/jpeg,image/png,application/pdf" title="Comprovante"
            onChange={(e) => set('comprovante', e.target.files[0])} />
          <button className="solid" type="submit">Adicionar</button>
        </form>
      </div>

      <div className="panel">
        <h2>Histórico</h2>
        <table>
          <thead><tr><th>Descrição</th><th>Categoria</th><th>Conta / cartão</th><th>Vencimento</th><th>Parcela</th><th>Status</th><th style={{ textAlign: 'right' }}>Valor</th><th /></tr></thead>
          <tbody>
            {lista.map((t) => (
              <tr key={t.id}>
                <td>{t.descricao}</td>
                <td className="muted">{t.categoria}</td>
                <td className="muted">{t.conta_nome || t.cartao_nome || '—'}</td>
                <td className="num muted">{dataBR(t.data_vencimento)}</td>
                <td className="muted">{t.parcela_total > 1 ? `${t.parcela_atual || t.parcela_total}/${t.parcela_total}` : t.recorrencia === 'mensal' ? '↻ mensal' : '—'}</td>
                <td>{t.data_pagamento ? <span className="pill ok">pago</span> : <span className="pill">pendente</span>}</td>
                <td className="num" style={{ textAlign: 'right' }}>
                  <span className={t.tipo === 'receita' ? 'pos' : 'neg'}>{t.tipo === 'receita' ? '+ ' : '− '}{BRL(t.valor)}</span>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {!t.data_pagamento && <button onClick={() => pagar(t)}>Pagar</button>} {' '}
                  <button onClick={() => excluir(t)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
