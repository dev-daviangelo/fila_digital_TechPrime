DROP DATABASE IF EXISTS fila_digital;
CREATE DATABASE fila_digital
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE fila_digital;

CREATE TABLE cliente (
  idCliente INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  telefone VARCHAR(20) NULL,
  status ENUM('ATIVO','INATIVO') NOT NULL DEFAULT 'ATIVO',

  latitude_atual DECIMAL(10,8) NULL,
  longitude_atual DECIMAL(11,8) NULL,
  ultima_atualizacao DATETIME NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE estabelecimento (
  idEstabelecimento INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  cnpj VARCHAR(18) NULL,

  categoria ENUM(
    'CLINICA',
    'BARBEARIA',
    'SALAO',
    'ESTETICA',
    'RESTAURANTE',
    'ACOUGUE',
    'SUPERMERCADO',
    'OUTROS'
  ) NULL,

  cidade VARCHAR(80) NULL,
  estado VARCHAR(45) NULL,
  telefone VARCHAR(20) NULL,

  cep VARCHAR(10) NULL,
  numero VARCHAR(10) NULL,
  complemento VARCHAR(60) NULL,
  logradouro VARCHAR(120) NULL,
  bairro VARCHAR(80) NULL,
  cidade_end VARCHAR(80) NULL,
  uf CHAR(2) NULL,

  latitude DECIMAL(10,8) NULL,
  longitude DECIMAL(11,8) NULL,
  raio_alerta INT NULL,

  email VARCHAR(120) NOT NULL,
  senha VARCHAR(255) NOT NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_estabelecimento_email (email),
  UNIQUE KEY uk_estabelecimento_cnpj (cnpj)
) ENGINE=InnoDB;

CREATE TABLE fila (
  idFila INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(60) NULL,

  status ENUM('ABERTA','FECHADA','EXCLUIDA') NOT NULL DEFAULT 'ABERTA',
  data_criacao DATETIME NULL,
  data_fechamento DATETIME NULL,

  endereco VARCHAR(255) NULL,
  latitude DECIMAL(10,8) NULL,
  longitude DECIMAL(11,8) NULL,
  raio_km DECIMAL(5,2) NOT NULL DEFAULT 0.20,

  cliente_idCliente INT NULL,
  estabelecimento_idEstabelecimento INT NULL,

  CONSTRAINT fk_fila_cliente
    FOREIGN KEY (cliente_idCliente) REFERENCES cliente(idCliente)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_fila_estab
    FOREIGN KEY (estabelecimento_idEstabelecimento) REFERENCES estabelecimento(idEstabelecimento)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE posicao_gps (
  idPosicaoGPS INT AUTO_INCREMENT PRIMARY KEY,
  latitude DECIMAL(10,8) NULL,
  longitude DECIMAL(11,8) NULL,
  data_ultima_atualizacao DATETIME NULL,

  cliente_idCliente INT NULL,

  CONSTRAINT fk_posicao_cliente
    FOREIGN KEY (cliente_idCliente) REFERENCES cliente(idCliente)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE alertas (
  idAlertas INT AUTO_INCREMENT PRIMARY KEY,
  tipo ENUM('ENTRADA_RAIO','SAIDA_RAIO','OUTRO') NULL,
  mensagem VARCHAR(255) NULL,
  data_emissao DATETIME NULL,

  cliente_idCliente INT NULL,

  CONSTRAINT fk_alerta_cliente
    FOREIGN KEY (cliente_idCliente) REFERENCES cliente(idCliente)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE caixa (
  idCaixa INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(45) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE atendimento (
  idAtendimento INT AUTO_INCREMENT PRIMARY KEY,
  data_inicio DATETIME NOT NULL,
  data_fim DATETIME NULL,
  status ENUM('AGUARDANDO','EM_ATENDIMENTO','FINALIZADO') NOT NULL DEFAULT 'AGUARDANDO',
  servico VARCHAR(45) NULL,

  cliente_idCliente INT NULL,
  estabelecimento_idEstabelecimento INT NULL,
  caixa_idCaixa INT NULL,

  CONSTRAINT fk_atend_cliente
    FOREIGN KEY (cliente_idCliente) REFERENCES cliente(idCliente)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_atend_estab
    FOREIGN KEY (estabelecimento_idEstabelecimento) REFERENCES estabelecimento(idEstabelecimento)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_atend_caixa
    FOREIGN KEY (caixa_idCaixa) REFERENCES caixa(idCaixa)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE qr_code (
  idQRCode INT AUTO_INCREMENT PRIMARY KEY,
  data_criacao DATETIME NULL,

  fila_idFila INT NULL,
  cliente_idCliente INT NULL,
  estabelecimento_idEstabelecimento INT NULL,

  CONSTRAINT fk_qr_fila
    FOREIGN KEY (fila_idFila) REFERENCES fila(idFila)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_qr_cliente
    FOREIGN KEY (cliente_idCliente) REFERENCES cliente(idCliente)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_qr_estab
    FOREIGN KEY (estabelecimento_idEstabelecimento) REFERENCES estabelecimento(idEstabelecimento)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE fila_cliente (
  idFilaCliente INT AUTO_INCREMENT PRIMARY KEY,
  fila_idFila INT NOT NULL,
  cliente_idCliente INT NOT NULL,

  status ENUM('AGUARDANDO','CHAMADO','EM_ATENDIMENTO','FINALIZADO','CANCELADO','SAIU')
    NOT NULL DEFAULT 'AGUARDANDO',

  senha_codigo VARCHAR(10) NULL,
  status_localizacao ENUM('dentro_raio','fora_raio') NOT NULL DEFAULT 'fora_raio',

  data_entrada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_inicio_atendimento DATETIME NULL,
  data_fim_atendimento DATETIME NULL,
  data_saida DATETIME NULL,

  /* mantido porque existe um update antigo no seu código usando data_fim */
  data_fim DATETIME NULL,

  CONSTRAINT fk_fc_fila
    FOREIGN KEY (fila_idFila) REFERENCES fila(idFila)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_fc_cliente
    FOREIGN KEY (cliente_idCliente) REFERENCES cliente(idCliente)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE password_reset (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(120) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

/* =========================
   ÍNDICES
========================= */

CREATE INDEX idx_cliente_status
  ON cliente (status);

CREATE INDEX idx_cliente_ultima_atualizacao
  ON cliente (ultima_atualizacao);

CREATE INDEX idx_estabelecimento_nome
  ON estabelecimento (nome);

CREATE INDEX idx_fila_estab_status
  ON fila (estabelecimento_idEstabelecimento, status);

CREATE INDEX idx_fila_estab_criacao
  ON fila (estabelecimento_idEstabelecimento, data_criacao);

CREATE INDEX idx_posicao_cliente
  ON posicao_gps (cliente_idCliente);

CREATE INDEX idx_posicao_cliente_data
  ON posicao_gps (cliente_idCliente, data_ultima_atualizacao);

CREATE INDEX idx_alerta_cliente_data
  ON alertas (cliente_idCliente, data_emissao);

CREATE INDEX idx_qr_fila
  ON qr_code (fila_idFila);

CREATE INDEX idx_qr_cliente
  ON qr_code (cliente_idCliente);

CREATE INDEX idx_qr_estab
  ON qr_code (estabelecimento_idEstabelecimento);

CREATE INDEX idx_fc_fila_status_data
  ON fila_cliente (fila_idFila, status, data_entrada);

CREATE INDEX idx_fc_fila_status_fim
  ON fila_cliente (fila_idFila, status, data_fim_atendimento);

CREATE INDEX idx_fc_fila_cliente_status
  ON fila_cliente (fila_idFila, cliente_idCliente, status);

CREATE INDEX idx_fc_cliente_status
  ON fila_cliente (cliente_idCliente, status);

CREATE INDEX idx_fc_status_localizacao
  ON fila_cliente (status_localizacao);

CREATE INDEX idx_password_reset_email_used
  ON password_reset (email, used);

CREATE INDEX idx_password_reset_email_id
  ON password_reset (email, id);

CREATE INDEX idx_password_reset_expires
  ON password_reset (expires_at);
