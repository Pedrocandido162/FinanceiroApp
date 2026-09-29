import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import routes from './routes.js';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const uploads = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploads)) fs.mkdirSync(uploads, { recursive: true });
app.use('/uploads', express.static(uploads));

// rate limiting simples
const hits = new Map();
app.use('/api', (req, res, next) => {
  const key = req.ip + req.path;
  const now = Date.now();
  const janela = hits.get(key) || [];
  const recentes = janela.filter((t) => now - t < 60_000);
  if (recentes.length > 120) return res.status(429).json({ erro: 'Muitas requisições. Aguarde um minuto.' });
  recentes.push(now);
  hits.set(key, recentes);
  next();
});

app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 API rodando em http://localhost:${PORT}`));
