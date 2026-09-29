import { useEffect, useState } from 'react';
import { api, BRL, dataBR, hojeISO } from '../api.js';

const FILTROS = [['hoje', 'Hoje'], ['7', '7 dias'], ['mes', 'Este mês'], ['prox', 'Próximo mês'], ['atras', 'Atrasadas']];

export default function Agenda() {
  const [filtro, setFiltro] = useState('7');
  const [dados, setDados] = useState({ pagar: [], receber: [] });
  const [erro, setErro] = useState('');

  const load = () => api(`/agenda?filtro=${filtro}`).then(setDados).catch((e) => setErro(e.message));
  useEffect(() => { load(); }, [filtro]);

  async function pagar(p) {
    await api(`/parcelas/${p.parcela_id}/pagar`, { method: 'PATCH', body: {} });
    await load();
  }

  function Lista({ titulo, itens, tipo }) {
    const total = itens.reduce((s, i) => s + Number(i.valor), 0);
    return (
      <div className="panel">
        <h2>{titulo}{itens.length > 0 && <span className="muted num"> · {BRL(total)}</span>}</h2>
        {itens.length === 0 && <p className="muted">Nada neste filtro.</p>}
        {itens.map((p) => {
          const atrasada = p.vencimento < hojeISO() && p.status === 'pendente';
          return (
            <div key={p.parcela_id} className="row">
              <div className="grow">
                <div>{p.descricao}</div>
                <div className="muted num">{dataBR(p.vencimento)} · {p.categoria}</div>
              </div>
              <span className="num">{BRL(p.valor)}</span>
              <span className={'pill ' + (atrasada ? 'late' : tipo === 'receber' ? 'ok' : '')}>{atrasada ? 'atrasada' : tipo === 'receber' ? 'a receber' : 'pendente'}</span>
              <button onClick={() => pagar(p)}>Marcar pago</button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <h1>Contas a pagar e receber</h1>
      {erro && <div className="erro">{erro}</div>}
      <div className="panel">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FILTROS.map(([k, lbl]) => (
            <button key={k} className={filtro === k ? 'solid' : ''} onClick={() => setFiltro(k)}>{lbl}</button>
          ))}
        </div>
      </div>
      <div className="grid2">
        <Lista titulo="A pagar" itens={dados.pagar} tipo="pagar" />
        <Lista titulo="A receber" itens={dados.receber} tipo="receber" />
      </div>
    </>
  );
}
