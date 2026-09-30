import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import { q } from './db.js';
import { gerarToken, auth, apenasAdmin, logAcesso } from './auth.js';

const router = Router();
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'application/pdf'].includes(file.mimetype);
    cb(ok ? null : new Error('Tipo de arquivo não permitido (jpg, png, pdf).'), ok);
  },
});

const moeda = (v) => Number(v || 0);

// formata Date local como YYYY-MM-DD (sem problemas de fuso)
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// garante que transações mensais tenham parcelas geradas até 3 meses além do corrente
async function garantirRecorrencias(uid) {
  const recs = await q("SELECT * FROM transacoes WHERE usuario_id=? AND recorrencia='mensal'", [uid]);
  for (const t of recs) {
    const [base] = await q(
      'SELECT MAX(vencimento) mx, MAX(numero) mn, COUNT(*) n FROM parcelas WHERE transacao_id=?', [t.id]);
    const dia = Math.min(Number(t.data_vencimento.slice(8, 10)) || 1, 28);
    if (!base.n) {
      // primeira geração: 12 parcelas mensais a partir do vencimento base (total=0 => recorrente)
      const [ano, mes] = t.data_vencimento.slice(0, 7).split('-').map(Number);
      for (let i = 0; i < 12; i++) {
        await q('INSERT INTO parcelas (transacao_id, numero, total, valor, vencimento, status) VALUES (?,?,?,?,?,?)',
          [t.id, i + 1, 0, t.valor, iso(new Date(ano, mes - 1 + i, dia)), 'pendente']);
      }
      continue;
    }
    // estende até o 3º mês seguinte ao corrente
    const [ay, am] = base.mx.slice(0, 7).split('-').map(Number);
    const cursor = new Date(ay, am, dia); // 1º mês após o último gerado
    const agora = new Date();
    const limite = new Date(agora.getFullYear(), agora.getMonth() + 4, 1);
    let numero = base.mn || 0;
    while (cursor <= limite) {
      const venc = iso(cursor);
      const existe = await q('SELECT 1 x FROM parcelas WHERE transacao_id=? AND vencimento=?', [t.id, venc]);
      if (!existe.length) {
        numero++;
        await q('INSERT INTO parcelas (transacao_id, numero, total, valor, vencimento, status) VALUES (?,?,?,?,?,?)',
          [t.id, numero, 0, t.valor, venc, 'pendente']);
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
}

/* ================= AUTH ================= */
router.post('/auth/registro', async (req, res) => {
  const { nome, email, senha } = req.body || {};
  if (!nome || !email || !senha || senha.length < 6)
    return res.status(400).json({ erro: 'Nome, e-mail e senha (mín. 6 caracteres) são obrigatórios.' });
  const existe = await q('SELECT id FROM usuarios WHERE email = ?', [email]);
  if (existe.length) return res.status(409).json({ erro: 'E-mail já cadastrado.' });
  const hash = await bcrypt.hash(senha, 10);
  const total = (await q('SELECT COUNT(*) n FROM usuarios'))[0].n;
  const papel = total === 0 ? 'admin' : 'usuario'; // primeiro usuário vira admin
  const r = await q('INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?,?,?,?)', [nome, email, hash, papel]);
  const usuario = { id: r.insertId, nome, email, papel };
  await logAcesso(usuario.id, email, 'registro', req);
  res.status(201).json({ token: gerarToken(usuario), usuario });
});

router.post('/auth/login', async (req, res) => {
  const { email, senha } = req.body || {};
  const [user] = await q('SELECT * FROM usuarios WHERE email = ?', [email]);
  if (!user || !(await bcrypt.compare(senha || '', user.senha_hash))) {
    await logAcesso(null, email, 'login_falhou', req);
    return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
  }
  await logAcesso(user.id, email, 'login', req);
  const usuario = { id: user.id, nome: user.nome, email: user.email, papel: user.papel };
  res.json({ token: gerarToken(usuario), usuario });
});

router.get('/auth/me', auth, (req, res) => res.json({ usuario: req.usuario }));

/* ================= CONTAS ================= */
router.get('/contas', auth, async (req, res) => {
  const contas = await q('SELECT * FROM contas WHERE usuario_id = ? AND ativo = 1 ORDER BY nome', [req.usuario.id]);
  const ids = contas.map((c) => c.id);
  let saldos = {};
  if (ids.length) {
    const rows = await q(
      `SELECT conta_id id, SUM(total) total FROM (
         SELECT conta_id, SUM(CASE WHEN tipo='receita' THEN valor ELSE -valor END) total
           FROM transacoes WHERE conta_id IN (?) AND data_pagamento IS NOT NULL GROUP BY conta_id
         UNION ALL
         SELECT conta_origem_id, -SUM(valor) FROM transferencias WHERE conta_origem_id IN (?) GROUP BY conta_origem_id
         UNION ALL
         SELECT conta_destino_id, SUM(valor) FROM transferencias WHERE conta_destino_id IN (?) GROUP BY conta_destino_id
       ) x GROUP BY conta_id`,
      [ids, ids, ids]
    );
    saldos = Object.fromEntries(rows.map((r) => [r.id, moeda(r.total)]));
  }
  res.json(contas.map((c) => ({ ...c, saldo: moeda(c.saldo_inicial) + (saldos[c.id] || 0) })));
});

router.post('/contas', auth, async (req, res) => {
  const { nome, tipo = 'corrente', saldo_inicial = 0 } = req.body || {};
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatório.' });
  const r = await q('INSERT INTO contas (usuario_id, nome, tipo, saldo_inicial) VALUES (?,?,?,?)',
    [req.usuario.id, nome, tipo, saldo_inicial]);
  res.status(201).json({ id: r.insertId });
});

router.put('/contas/:id', auth, async (req, res) => {
  const { nome, tipo, saldo_inicial, ativo } = req.body || {};
  await q('UPDATE contas SET nome=COALESCE(?,nome), tipo=COALESCE(?,tipo), saldo_inicial=COALESCE(?,saldo_inicial), ativo=COALESCE(?,ativo) WHERE id=? AND usuario_id=?',
    [nome, tipo, saldo_inicial, ativo, req.params.id, req.usuario.id]);
  res.json({ ok: true });
});

/* ================= TRANSAÇÕES ================= */
router.get('/transacoes', auth, async (req, res) => {
  const rows = await q(
    `SELECT t.*, c.nome conta_nome, ca.nome cartao_nome,
       (SELECT COUNT(*) FROM parcelas p WHERE p.transacao_id = t.id) parcela_total,
       (SELECT MIN(p.numero) FROM parcelas p WHERE p.transacao_id = t.id AND p.status='pendente') parcela_atual
     FROM transacoes t
     LEFT JOIN contas c ON c.id = t.conta_id
     LEFT JOIN cartoes ca ON ca.id = t.cartao_id
     WHERE t.usuario_id = ?
     ORDER BY t.data_vencimento DESC, t.id DESC LIMIT 500`, [req.usuario.id]);
  res.json(rows);
});

router.post('/transacoes', auth, upload.single('comprovante'), async (req, res) => {
  const b = req.body || {};
  const valor = moeda(b.valor);
  if (!valor || valor <= 0) return res.status(400).json({ erro: 'Valor inválido.' });
  if (!b.descricao) return res.status(400).json({ erro: 'Descrição obrigatória.' });
  if (!b.data_vencimento) return res.status(400).json({ erro: 'Data de vencimento obrigatória.' });
  const contaId = b.conta_id || null;
  const cartaoId = b.cartao_id || null;
  if (b.status === 'pago' && !contaId && !cartaoId)
    return res.status(400).json({ erro: 'Informe a conta ou o cartão para lançamento pago.' });

  const parcelas = Math.max(1, parseInt(b.parcelas) || 1);
  const valorParcela = Math.round((valor / parcelas) * 100) / 100;
  const pago = b.status === 'pago';

  const mensal = b.recorrencia === 'mensal';
  const conn = await (await import('./db.js')).pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      `INSERT INTO transacoes (usuario_id, conta_id, cartao_id, tipo, valor, data_vencimento, data_pagamento,
        categoria, descricao, forma_pagamento, comprovante_path, recorrencia)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.usuario.id, contaId, cartaoId, b.tipo === 'receita' ? 'receita' : 'despesa', valor,
       b.data_vencimento, pago ? b.data_pagamento || b.data_vencimento : null,
       b.categoria || 'Outros', b.descricao, b.forma_pagamento || 'pix',
       req.file ? req.file.path : null, mensal ? 'mensal' : 'unica']
    );
    const transacaoId = r.insertId;
    const [ano, mes, dia0] = b.data_vencimento.split('-').map(Number);
    const dia = Math.min(dia0, 28);
    const gerar = mensal ? 12 : parcelas;
    for (let i = 1; i <= gerar; i++) {
      const venc = iso(new Date(ano, mes - 1 + (i - 1), dia));
      await conn.query(
        'INSERT INTO parcelas (transacao_id, numero, total, valor, vencimento, status) VALUES (?,?,?,?,?,?)',
        [transacaoId, i, mensal ? 0 : parcelas, mensal ? valor : valorParcela, venc, pago ? 'pago' : 'pendente']);
    }
    await conn.commit();
    res.status(201).json({ id: transacaoId });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});

router.patch('/transacoes/:id/pagar', auth, async (req, res) => {
  const { data_pagamento } = req.body || {};
  await q('UPDATE transacoes SET data_pagamento = ? WHERE id = ? AND usuario_id = ?',
    [data_pagamento || new Date().toISOString().slice(0, 10), req.params.id, req.usuario.id]);
  await q(`UPDATE parcelas SET status='pago' WHERE transacao_id = ?`, [req.params.id]);
  res.json({ ok: true });
});

router.delete('/transacoes/:id', auth, async (req, res) => {
  await q('DELETE FROM transacoes WHERE id = ? AND usuario_id = ?', [req.params.id, req.usuario.id]);
  res.json({ ok: true });
});

/* ================= DASHBOARD ================= */
router.get('/dashboard', auth, async (req, res) => {
  const uid = req.usuario.id;
  await garantirRecorrencias(uid);
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [[contas]] = await q('SELECT COUNT(*) n, COALESCE(SUM(saldo_inicial),0) s FROM contas WHERE usuario_id=? AND ativo=1', [uid]).then(r => [r]);
  const mov = await q(
    `SELECT conta_id, tipo, SUM(valor) v FROM transacoes WHERE usuario_id=? AND conta_id IS NOT NULL AND data_pagamento IS NOT NULL GROUP BY conta_id, tipo`, [uid]);
  const transf = await q(
    `SELECT conta_origem_id o, conta_destino_id d, SUM(valor) v FROM transferencias WHERE usuario_id=? GROUP BY conta_origem_id, conta_destino_id`, [uid]);
  let saldo = moeda(contas.s);
  const porConta = {};
  mov.forEach((m) => { const s = (m.tipo === 'receita' ? 1 : -1) * moeda(m.v); saldo += s; if (m.conta_id) porConta[m.conta_id] = (porConta[m.conta_id] || 0) + s; });
  transf.forEach((t) => { porConta[t.o] = (porConta[t.o] || 0) - moeda(t.v); porConta[t.d] = (porConta[t.d] || 0) + moeda(t.v); });

  const mes = await q(
    `SELECT tipo, SUM(valor) v FROM transacoes WHERE usuario_id=? AND data_pagamento BETWEEN ? AND ? GROUP BY tipo`, [uid, inicioMes, fimMes]);
  const rec = moeda(mes.find((m) => m.tipo === 'receita')?.v);
  const des = moeda(mes.find((m) => m.tipo === 'despesa')?.v);

  const pend = await q(
    `SELECT tipo, SUM(p.valor) v FROM parcelas p JOIN transacoes t ON t.id = p.transacao_id
     WHERE t.usuario_id=? AND p.status='pendente' AND p.vencimento <= LAST_DAY(CURDATE()) GROUP BY t.tipo`, [uid]);
  const pagar = moeda(pend.find((p) => p.tipo === 'despesa')?.v);
  const receber = moeda(pend.find((p) => p.tipo === 'receita')?.v);

  const evolucao = await q(
    `SELECT DATE_FORMAT(data_pagamento, '%Y-%m') mes,
            SUM(CASE WHEN tipo='receita' THEN valor ELSE 0 END) receitas,
            SUM(CASE WHEN tipo='despesa' THEN valor ELSE 0 END) despesas
     FROM transacoes WHERE usuario_id=? AND data_pagamento IS NOT NULL
       AND data_pagamento >= DATE_SUB(?, INTERVAL 5 MONTH)
     GROUP BY mes ORDER BY mes`, [uid, inicioMes]);

  const categorias = await q(
    `SELECT categoria nome, SUM(valor) total FROM transacoes
     WHERE usuario_id=? AND tipo='despesa' AND data_pagamento BETWEEN ? AND ?
     GROUP BY categoria ORDER BY total DESC LIMIT 8`, [uid, inicioMes, fimMes]);

  const vencimentos = await q(
    `SELECT t.id, t.descricao, t.tipo, t.categoria, p.valor, p.vencimento
     FROM parcelas p JOIN transacoes t ON t.id = p.transacao_id
     WHERE t.usuario_id=? AND p.status='pendente' AND p.vencimento >= ?
     ORDER BY p.vencimento LIMIT 10`, [uid, inicioMes]);

  res.json({
    saldo, receitas: rec, despesas: des, resultado: rec - des,
    contas_a_pagar: pagar, contas_a_receber: receber,
    evolucao, categorias, vencimentos, por_conta: porConta,
  });
});

/* ================= AGENDA ================= */
router.get('/agenda', auth, async (req, res) => {
  const uid = req.usuario.id;
  await garantirRecorrencias(uid);
  const f = req.query.filtro || '7';
  const hoje = new Date().toISOString().slice(0, 10);
  let cond = 'p.vencimento = CURDATE()';
  if (f === '7') cond = "p.vencimento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)";
  if (f === 'mes') cond = "p.vencimento BETWEEN CURDATE() AND LAST_DAY(CURDATE())";
  if (f === 'prox') cond = "p.vencimento BETWEEN DATE_ADD(LAST_DAY(CURDATE()), INTERVAL 1 DAY) AND LAST_DAY(DATE_ADD(CURDATE(), INTERVAL 1 MONTH))";
  if (f === 'atras') cond = "p.vencimento < CURDATE()";
  const rows = await q(
    `SELECT p.id parcela_id, p.vencimento, p.valor, p.status, t.id transacao_id, t.descricao, t.tipo, t.categoria
     FROM parcelas p JOIN transacoes t ON t.id = p.transacao_id
     WHERE t.usuario_id=? AND p.status='pendente' AND ${cond} ORDER BY p.vencimento`, [uid]);
  res.json({ pagar: rows.filter((r) => r.tipo === 'despesa'), receber: rows.filter((r) => r.tipo === 'receita') });
});

router.patch('/parcelas/:id/pagar', auth, async (req, res) => {
  await q(
    `UPDATE parcelas p JOIN transacoes t ON t.id = p.transacao_id
     SET p.status='pago', t.data_pagamento = COALESCE(t.data_pagamento, CURDATE())
     WHERE p.id = ? AND t.usuario_id = ?`, [req.params.id, req.usuario.id]);
  res.json({ ok: true });
});

/* ================= CARTÕES ================= */
router.get('/cartoes', auth, async (req, res) => {
  const uid = req.usuario.id;
  const cartoes = await q('SELECT * FROM cartoes WHERE usuario_id=? AND ativo=1 ORDER BY nome', [uid]);
  const hoje = new Date();
  const iniFatura = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const fimFatura = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);
  for (const c of cartoes) {
    const [usado] = await q(
      `SELECT COALESCE(SUM(valor),0) v FROM transacoes WHERE cartao_id=? AND data_pagamento IS NULL`, [c.id]);
    const [fatura] = await q(
      `SELECT COALESCE(SUM(valor),0) v FROM transacoes WHERE cartao_id=? AND data_pagamento BETWEEN ? AND ?`,
      [c.id, iniFatura, fimFatura]);
    const proximas = await q(
      `SELECT DATE_FORMAT(p.vencimento,'%m/%Y') mes, SUM(p.valor) v, COUNT(*) n
       FROM parcelas p JOIN transacoes t ON t.id=p.transacao_id
       WHERE t.cartao_id=? AND p.status='pendente' AND p.vencimento > LAST_DAY(CURDATE())
       GROUP BY mes ORDER BY mes LIMIT 6`, [c.id]);
    c.usado = moeda(usado.v); c.fatura_atual = moeda(fatura.v);
    c.disponivel = moeda(c.limite) - c.usado;
    c.proximas_faturas = proximas.map((p) => ({ mes: p.mes, valor: moeda(p.v), parcelas: p.n }));
  }
  res.json(cartoes);
});

router.post('/cartoes', auth, async (req, res) => {
  const { nome, banco = null, limite = 0, fechamento_dia = 25, vencimento_dia = 5 } = req.body || {};
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatório.' });
  const r = await q('INSERT INTO cartoes (usuario_id, banco, nome, limite, fechamento_dia, vencimento_dia) VALUES (?,?,?,?,?,?)',
    [req.usuario.id, banco || null, nome, limite, fechamento_dia, vencimento_dia]);
  res.status(201).json({ id: r.insertId });
});

// cartões agrupados por banco (virtuais do mesmo banco ficam juntos)
router.get('/cartoes/bancos', auth, async (req, res) => {
  const uid = req.usuario.id;
  const cartoes = await q('SELECT * FROM cartoes WHERE usuario_id=? AND ativo=1 ORDER BY banco, nome', [uid]);
  const mapa = {};
  for (const c of cartoes) {
    const chave = c.banco || 'Outros';
    if (!mapa[chave]) mapa[chave] = { banco: chave, cartoes: [], limite: 0, usado: 0 };
    mapa[chave].cartoes.push(c);
    mapa[chave].limite += moeda(c.limite);
  }
  const hoje = new Date();
  const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);
  for (const g of Object.values(mapa)) {
    for (const c of g.cartoes) {
      const [u] = await q('SELECT COALESCE(SUM(valor),0) v FROM transacoes WHERE cartao_id=? AND data_pagamento IS NULL', [c.id]);
      const [f] = await q('SELECT COALESCE(SUM(valor),0) v FROM transacoes WHERE cartao_id=? AND data_pagamento BETWEEN ? AND ?', [c.id, ini, fim]);
      c.usado = moeda(u.v); c.fatura_atual = moeda(f.v);
      c.disponivel = moeda(c.limite) - c.usado;
      c.proximas_faturas = [];
      g.usado += c.usado;
    }
    g.disponivel = g.limite - g.usado;
  }
  res.json(Object.values(mapa));
});

router.get('/cartoes/:id/compras', auth, async (req, res) => {
  const rows = await q(
    `SELECT t.* FROM transacoes t WHERE t.cartao_id=? AND t.usuario_id=? ORDER BY t.data_vencimento DESC LIMIT 100`,
    [req.params.id, req.usuario.id]);
  res.json(rows);
});

/* ================= METAS ================= */
router.get('/metas', auth, async (req, res) => {
  res.json(await q('SELECT * FROM metas WHERE usuario_id=? ORDER BY criado_em DESC', [req.usuario.id]));
});

router.post('/metas', auth, async (req, res) => {
  const { nome, valor_alvo } = req.body || {};
  if (!nome || !moeda(valor_alvo)) return res.status(400).json({ erro: 'Nome e valor alvo obrigatórios.' });
  const r = await q('INSERT INTO metas (usuario_id, nome, valor_alvo) VALUES (?,?,?)', [req.usuario.id, nome, valor_alvo]);
  res.status(201).json({ id: r.insertId });
});

router.post('/metas/:id/guardar', auth, async (req, res) => {
  const valor = moeda(req.body?.valor);
  if (valor <= 0) return res.status(400).json({ erro: 'Valor inválido.' });
  await q('UPDATE metas SET valor_guardado = valor_guardado + ? WHERE id=? AND usuario_id=?', [valor, req.params.id, req.usuario.id]);
  res.json({ ok: true });
});

router.delete('/metas/:id', auth, async (req, res) => {
  await q('DELETE FROM metas WHERE id=? AND usuario_id=?', [req.params.id, req.usuario.id]);
  res.json({ ok: true });
});

/* ================= TRANSFERÊNCIAS ================= */
router.get('/transferencias', auth, async (req, res) => {
  res.json(await q(
    `SELECT tr.*, co.nome origem, cd.nome destino FROM transferencias tr
     JOIN contas co ON co.id = tr.conta_origem_id
     JOIN contas cd ON cd.id = tr.conta_destino_id
     WHERE tr.usuario_id=? ORDER BY tr.data DESC, tr.id DESC LIMIT 50`, [req.usuario.id]));
});

router.post('/transferencias', auth, async (req, res) => {
  const { conta_origem_id, conta_destino_id, valor, data } = req.body || {};
  if (!conta_origem_id || !conta_destino_id || conta_origem_id === conta_destino_id)
    return res.status(400).json({ erro: 'Contas de origem e destino devem ser diferentes.' });
  if (moeda(valor) <= 0) return res.status(400).json({ erro: 'Valor inválido.' });
  await q('INSERT INTO transferencias (usuario_id, conta_origem_id, conta_destino_id, valor, data) VALUES (?,?,?,?,?)',
    [req.usuario.id, conta_origem_id, conta_destino_id, valor, data || new Date().toISOString().slice(0, 10)]);
  res.status(201).json({ ok: true });
});

/* ================= ADMIN ================= */
router.get('/admin/logs', auth, apenasAdmin, async (req, res) => {
  res.json(await q('SELECT * FROM logs_acesso ORDER BY criado_em DESC LIMIT 200'));
});


// envolve handlers async: erros vao para o middleware de erro do Express
// em vez de derrubarem o processo com uncaughtException
for (const layer of router.stack) {
  layer.route?.stack.forEach((s) => {
    if (s.handle.constructor.name === 'AsyncFunction') {
      const fn = s.handle;
      s.handle = (req, res, next) => fn(req, res, next).catch(next);
    }
  });
}

export default router;
