# 💰 Sistema Financeiro (React + Vite + Express + MySQL)

## Requisitos
- Node.js 18+
- MySQL 8+

## 1. Criar o banco de dados
```bash
npm run db        # aplica server/src/schema.sql (usuário root, sem senha, localhost)
```
Ou manualmente:
```bash
mysql -u root -p < server/src/schema.sql
```

## 2. Configurar variáveis de ambiente
```bash
cp server/.env.example server/.env
# edite server/.env com suas credenciais do MySQL
```

## 3. Instalar dependências e rodar
```bash
npm install               # instala concurrently na raiz
npm run install:all       # instala server e client
npm run dev               # sobe API em :3001 e front em :5173
```

Acesse http://localhost:5173 — crie seu usuário na tela de login.

## Estrutura
- `client/` — React + Vite (porta 5173, proxy /api → :3001)
- `server/` — Express + MySQL (porta 3001)
- `server/src/schema.sql` — banco e tabelas

## Funcionalidades
- Dashboard: saldo, receitas, despesas, resultado, a pagar/receber, gráficos
- Receitas/despesas com parcelamento, recorrência, comprovante (upload), status
- Contas e carteiras + transferências (não contabiliza como receita/despesa)
- Cartões de crédito: limite, fatura atual, fechamento/vencimento, próximas faturas
- Agenda a pagar/receber com filtros (hoje, 7 dias, mês, próximo mês, atrasadas)
- Metas financeiras com progresso
- Auth: JWT + bcrypt, papéis admin/usuário, logs de acesso
