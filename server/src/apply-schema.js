import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
});
await conn.query(sql);

// migração: adiciona colunas novas em bancos já existentes
async function garantirColuna(tabela, coluna, ddl) {
  const [cols] = await conn.query(
    'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=?',
    [process.env.DB_NAME || 'financas', tabela]);
  if (!cols.some((c) => c.COLUMN_NAME === coluna)) {
    await conn.query(ddl);
    console.log(`+ coluna ${tabela}.${coluna} adicionada`);
  }
}
await garantirColuna('transacoes', 'recorrencia',
  "ALTER TABLE transacoes ADD COLUMN recorrencia ENUM('unica','mensal') NOT NULL DEFAULT 'unica'");
await garantirColuna('cartoes', 'banco',
  'ALTER TABLE cartoes ADD COLUMN banco VARCHAR(120) NULL');

console.log('✅ Banco de dados criado/atualizado com sucesso.');
await conn.end();
