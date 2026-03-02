

# 📘 RELATÓRIO COMPLETO — Configuração e Execução do Projeto (Windows)

Este **README** descreve **PASSO A PASSO** de como **configurar e rodar o projeto do zero em outra máquina Windows**.


## 0️⃣ Pré-requisitos

Antes de começar, instale na máquina:

* **Python 3.13.12+** (recomendado)
  ✅ Durante a instalação, marque **“Add Python to PATH”**
* **MySQL Server 8.0+**
* **VS Code**
* **Git** (opcional, se for clonar o repositório)

---

## 1️⃣ Baixar o projeto (Git Clone)

Abra o terminal na pasta onde deseja salvar o projeto:

```powershell
# Clonar o repositório
cd Downloads;
git clone https://github.com/Gabriel-Oliveira-Duarte/fila_digital_TechPrime-gabriel

# Entrar na pasta do projeto (onde está o main.py)
cd fila_digital_TechPrime-gabriel


```

### Caso tenha baixado em ZIP

Apenas extraia o arquivo e entre na pasta do projeto:

```powershell
cd fila_digital_TechPrime-gabriel
```

---

## 2️⃣ Banco de dados (MySQL)

### 2.1️⃣ Iniciar o MySQL (Windows)

Abra o **cmd  como Administrador** e execute:

```powershell
net start mysql80
```

⚠️ Caso não funcione, o nome do serviço pode ser `MySQL80` ou similar.

---


### 2.2️⃣ Criar banco de dados e tabelas

⚠️ **Cole EXATAMENTE o script abaixo, sem alterar nada**:

```sql
CREATE DATABASE fila_digital;
USE fila_digital;

CREATE TABLE cliente (
    idCliente INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(45) NOT NULL,
    telefone VARCHAR(45),
    status ENUM('ATIVO','INATIVO') DEFAULT 'ATIVO',

    latitude_atual DECIMAL(10,8) NULL,
    longitude_atual DECIMAL(11,8) NULL,
    ultima_atualizacao DATETIME NULL
);


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
);


CREATE TABLE alertas (
    idAlertas INT AUTO_INCREMENT PRIMARY KEY,
    tipo ENUM('ENTRADA_RAIO','SAIDA_RAIO','OUTRO'),
    mensagem VARCHAR(255),
    data_emissao DATETIME NULL,

    cliente_idCliente INT NULL,
    CONSTRAINT fk_alerta_cliente
      FOREIGN KEY (cliente_idCliente) REFERENCES cliente(idCliente)
      ON DELETE SET NULL
      ON UPDATE CASCADE
);

CREATE TABLE estabelecimento (
    idEstabelecimento INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(45) NOT NULL,
    cnpj VARCHAR(18),
    categoria ENUM('CLINICA','BARBEARIA','SALAO','ESTETICA','RESTAURANTE','ACOUGUE','SUPERMERCADO'),
    cidade VARCHAR(45),
    estado VARCHAR(45),
    telefone VARCHAR(15),

    -- (no seu projeto você deixou NULL)
    latitude DECIMAL(10,8) NULL,
    longitude DECIMAL(11,8) NULL,

    raio_alerta INT NULL,

    email VARCHAR(120) NOT NULL UNIQUE,
    senha VARCHAR(120) NOT NULL
);

CREATE TABLE caixa (
    idCaixa INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(45)
);


CREATE TABLE atendimento (
    idAtendimento INT AUTO_INCREMENT PRIMARY KEY,
    data_inicio DATETIME NOT NULL,
    data_fim DATETIME NOT NULL,
    status ENUM('AGUARDANDO','EM_ATENDIMENTO','FINALIZADO'),
    servico VARCHAR(45),

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
);


CREATE TABLE fila (
    idFila INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(60) NULL,

    status ENUM('ABERTA','FECHADA'),
    data_criacao DATETIME NULL,
    data_fechamento DATETIME NULL,

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
);

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
);
```
---

📌 Observação importante (MySQL)

* Observação: no main.py o acesso ao MySQL está como user=root e password=root.
Se no seu PC for diferente, altere no get_conn().

---

## 3️⃣ Criar e ativar venv

No CMD, dentro da pasta do projeto:

**CMD**

```cmd
python -m venv .venv
.\.venv\Scripts\activate.bat
```

✅ Se aparecer (.venv) no terminal, deu certo.

---

### 3.1️⃣ Instalar dependências

No mesmo terminal onde a venv está ativa:

```cmd
pip install fastapi uvicorn mysql-connector-python pydantic python-dotenv
```

```cmd
pip install "pydantic[email]"
```

---

## 4️⃣ Rodar a API (FastAPI)

Ainda dentro do mesmo cmd rode:

```cmd
uvicorn main:app --reload --host 0.0.0.0 --port 8010
```

### Testes (somente conferir se abriu)

* Swagger / Docs
  👉 [[http://127.0.0.1:8010/docs](http://127.0.0.1:8010/docs)]

* Index
  👉 [http://127.0.0.1:8010/templates/index.html](http://127.0.0.1:8010/templates/index.html)


⚠️ **NÃO usar Live Server**

O sistema **precisa rodar pelo FastAPI**, pois `/api`, `/static`, `/assets` e `/templates` estão no mesmo servidor.

---

## 5️⃣ Configurar NGROK (instalação + token + link público)

### 5.1️⃣ Instalar o ngrok

Baixe e instale o ngrok.

Verificar instalação:

```powershell
ngrok version
```

Caso não reconheça:

```powershell
where.exe ngrok
```

---

### 5.2️⃣ Criar conta e pegar o Authtoken

* Criar conta no site do ngrok
* Copiar **Your Authtoken**

---

### 5.3️⃣ Configurar token no Windows

```cmd
ngrok config add-authtoken SEU_TOKEN_AQUI
```

Conferir:

```cmd
ngrok config check
```

---

### 5.4️⃣ Subir o Ngrok (URL pública)

Abra OUTRO terminal (pode ser no cmd) e rode:

```cmd
ngrok http 8010
```

Copie a URL https://xxxx.ngrok-free.dev


---



## 6️⃣ Salvar a URL pública no backend (para o QR ficar público)


1. Abra: 👉 [http://127.0.0.1:8010/docs](http://127.0.0.1:8010/docs)

2. Encontre POST /api/public-url
3. Envie:

### 6.1️⃣ POST
Vá em Try it out, cole o link e execute.

```json
{
  "public_url": "https://SEU-LINK.ngrok-free.dev"
}
```

Para conferir:

### 6.2️⃣ GET

1. Encontre GET /api/public-url
2. Execute.

Confirme se retorna o mesmo link.

---


## 7️⃣ IMPORTANTE (para dar certo como no seu PC)

✅ Use SEMPRE o painel pelo NGROK para gerar QR público:

Acesse:

https://SEU-LINK.ngrok-free.dev/templates/index.html

Se você abrir o painel pelo localhost, o QR tende a gerar link local.

---

## 8️⃣ Fluxo de uso (como “estabelecimento”)

1. Entrar no painel:

https://SEU-LINK.ngrok-free.dev/templates/index.html

2. Criar conta de estabelecimento (cadastro):

*Preencher dados e criar

3. Fazer login

4. Criar uma fila (na página “Criar Fila”)

*A fila é salva no MySQL (tabela fila)

5. Ir em “QR Code”

*Ele lista as filas do estabelecimento e gera o QR com link público

---
## 9️⃣ Teste final no celular (cliente)

1. Abra a página de QR Code no painel e copie o link exibido

2. Cole no celular (ou escaneie o QR)

3. O link deve abrir no formato:
   https://SEU-LINK.ngrok-free.dev/templates/login.html?next=/templates/Fila_cliente.html&filaId=123
   



## 1️⃣0️⃣ Checklist ngrok (o link MUDA toda vez que você reinicia)

1. `ngrok http 8010`
2. Copiar novo link
3. Swagger → POST /api/public-url
4. Reabrir index.html
5. Criar fila e gerar o QR novamente

---

