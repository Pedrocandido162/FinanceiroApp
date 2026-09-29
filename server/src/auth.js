import jwt from 'jsonwebtoken';
import { q } from './db.js';

export function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, email: usuario.email, papel: usuario.papel },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ erro: 'Token não informado.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const [user] = await q('SELECT id, nome, email, papel FROM usuarios WHERE id = ?', [payload.id]);
    if (!user) return res.status(401).json({ erro: 'Usuário inválido.' });
    req.usuario = user;
    next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

export function apenasAdmin(req, res, next) {
  if (req.usuario?.papel !== 'admin') return res.status(403).json({ erro: 'Acesso restrito ao administrador.' });
  next();
}

export async function logAcesso(usuarioId, email, acao, req) {
  await q(
    'INSERT INTO logs_acesso (usuario_id, email, acao, ip, user_agent) VALUES (?,?,?,?,?)',
    [usuarioId, email, acao, req.ip, (req.headers['user-agent'] || '').slice(0, 255)]
  ).catch(() => {});
}
