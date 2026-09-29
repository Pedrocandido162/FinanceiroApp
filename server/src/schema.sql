CREATE DATABASE IF NOT EXISTS financas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE financas;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  papel ENUM('admin','usuario') NOT NULL DEFAULT 'usuario',
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS contas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  nome VARCHAR(120) NOT NULL,
  tipo ENUM('corrente','dinheiro','digital','poupanca','investimento') NOT NULL DEFAULT 'corrente',
  saldo_inicial DECIMAL(12,2) NOT NULL DEFAULT 0,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cartoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  nome VARCHAR(120) NOT NULL,
  limite DECIMAL(12,2) NOT NULL DEFAULT 0,
  fechamento_dia TINYINT NOT NULL DEFAULT 25,
  vencimento_dia TINYINT NOT NULL DEFAULT 5,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  conta_id INT NULL,
  cartao_id INT NULL,
  tipo ENUM('receita','despesa') NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE NULL,
  categoria VARCHAR(80) NOT NULL DEFAULT 'Outros',
  descricao VARCHAR(255) NOT NULL,
  forma_pagamento VARCHAR(40) DEFAULT 'pix',
  comprovante_path VARCHAR(255) NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (conta_id) REFERENCES contas(id) ON DELETE SET NULL,
  FOREIGN KEY (cartao_id) REFERENCES cartoes(id) ON DELETE SET NULL,
  INDEX idx_venc (usuario_id, data_vencimento),
  INDEX idx_status (usuario_id, data_pagamento)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS parcelas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transacao_id INT NOT NULL,
  numero INT NOT NULL,
  total INT NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  vencimento DATE NOT NULL,
  status ENUM('pago','pendente') NOT NULL DEFAULT 'pendente',
  FOREIGN KEY (transacao_id) REFERENCES transacoes(id) ON DELETE CASCADE,
  INDEX idx_par_venc (vencimento, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS metas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  nome VARCHAR(120) NOT NULL,
  valor_alvo DECIMAL(12,2) NOT NULL,
  valor_guardado DECIMAL(12,2) NOT NULL DEFAULT 0,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transferencias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  conta_origem_id INT NOT NULL,
  conta_destino_id INT NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  data DATE NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (conta_origem_id) REFERENCES contas(id) ON DELETE CASCADE,
  FOREIGN KEY (conta_destino_id) REFERENCES contas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS logs_acesso (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NULL,
  email VARCHAR(160) NULL,
  acao VARCHAR(40) NOT NULL,
  ip VARCHAR(60) NULL,
  user_agent VARCHAR(255) NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;
