# main.py (COMPLETA E ATUALIZADA) — CORRIGIDA SEM MUDAR O QUE NÃO PRECISA
# ✅ Correção principal: Atendimento agora considera CHAMADO + AGUARDANDO (compatível com Dashboard)
# ✅ Mantém tudo que você já implementou

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
import mysql.connector
import hashlib
from pathlib import Path
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Optional, Dict, Set, Union
from datetime import datetime
import unicodedata
import asyncio
import json
import random
import string
import math
import requests
import os
import smtplib
from email.message import EmailMessage
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(dotenv_path="arquivo.env", override=True)

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env", override=True)

smtp_host = (os.getenv("SMTP_HOST") or "").strip()
smtp_port = int((os.getenv("SMTP_PORT") or "587").strip())
smtp_user = (os.getenv("SMTP_USER") or "").strip()
smtp_pass = (os.getenv("SMTP_PASS") or "").replace(" ", "").strip()
smtp_from = (os.getenv("SMTP_FROM") or "").strip() or smtp_user or "no-reply@local"

app = FastAPI(title="Fila Digital API")
print("API INICIANDO...")



# =====================================================
# ✅ CORS
# =====================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================
# ✅ NGROK: remover página "Visite o site"
# =====================================================


class NgrokSkipBrowserWarningMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["ngrok-skip-browser-warning"] = "1"
        return response


app.add_middleware(NgrokSkipBrowserWarningMiddleware)

# =====================================================
# ✅ WEBSOCKET MANAGER
# =====================================================


class ConnectionManager:
    def __init__(self):
        self.rooms: Dict[str, Set[WebSocket]] = {}
        self.lock = asyncio.Lock()

    async def connect(self, room: str, websocket: WebSocket):
        await websocket.accept()
        async with self.lock:
            self.rooms.setdefault(room, set()).add(websocket)

    async def disconnect(self, room: str, websocket: WebSocket):
        async with self.lock:
            if room in self.rooms:
                self.rooms[room].discard(websocket)
                if not self.rooms[room]:
                    del self.rooms[room]

    async def broadcast(self, room: str, message: dict):
        data = json.dumps(message, ensure_ascii=False)
        async with self.lock:
            sockets = list(self.rooms.get(room, set()))

        dead = []
        for ws in sockets:
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)

        if dead:
            async with self.lock:
                for ws in dead:
                    self.rooms.get(room, set()).discard(ws)


manager = ConnectionManager()


async def notify_fila_update(fila_id: int, action: str, payload: Optional[dict] = None):
    await manager.broadcast(f"fila:{fila_id}", {
        "type": "fila_update",
        "action": action,
        "fila_id": fila_id,
        "payload": payload or {}
    })


@app.websocket("/ws/fila/{fila_id}")
async def ws_fila(websocket: WebSocket, fila_id: int):
    room = f"fila:{fila_id}"
    await manager.connect(room, websocket)
    try:
        while True:
            # ping do front (mantém vivo)
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(room, websocket)

# =====================================================
# PATHS / STATIC
# =====================================================
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"
ASSETS_DIR = BASE_DIR / "assets"

# ✅ use paths absolutos (evita bug de diretório ao rodar)
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
if TEMPLATES_DIR.exists():
    app.mount("/templates", StaticFiles(directory=str(TEMPLATES_DIR)),
              name="templates")
if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")


@app.get("/")
def home():
    file_path = TEMPLATES_DIR / "index.html"
    if not file_path.exists():
        raise HTTPException(
            status_code=404, detail="index.html não encontrado em /templates")
    return FileResponse(str(file_path), media_type="text/html", headers={"ngrok-skip-browser-warning": "1"})

# ✅✅ rota estável pro seu login cnpj.html


@app.get("/cnpj")
def cnpj_page():
    file_path = TEMPLATES_DIR / "cnpj.html"
    if not file_path.exists():
        raise HTTPException(
            status_code=404, detail="cnpj.html não encontrado em /templates")
    return FileResponse(str(file_path), media_type="text/html", headers={"ngrok-skip-browser-warning": "1"})

# ✅✅ rota estável pro dashboard (mantém /dashboard e também mantém /templates funcionando via mount)


@app.get("/dashboard")
def dashboard_page():
    # ⚠️ seu arquivo é templates/dashboard.html (minúsculo)
    file_path = TEMPLATES_DIR / "dashboard.html"
    if not file_path.exists():
        raise HTTPException(
            status_code=404, detail="dashboard.html não encontrado em /templates")
    return FileResponse(str(file_path), media_type="text/html", headers={"ngrok-skip-browser-warning": "1"})

# =====================================================
# MYSQL
# =====================================================


def get_conn():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="root",
        database="fila_digital",
        charset="utf8mb4",
        collation="utf8mb4_general_ci",
    )


SECRET_KEY = "andalogo_super_secret"


def hash_pass(p: str) -> str:
    return hashlib.sha256((p + SECRET_KEY).encode()).hexdigest()

def hash_code(code: str) -> str:
    # reusa seu SECRET_KEY/ hash_pass pra manter padrão
    return hashlib.sha256((code.strip() + SECRET_KEY).encode()).hexdigest()

def send_reset_email(to_email: str, code: str) -> bool:
    import os, smtplib
    from email.message import EmailMessage

    smtp_host = (os.getenv("SMTP_HOST") or "").strip()
    smtp_port = int((os.getenv("SMTP_PORT") or "587").strip())
    smtp_user = (os.getenv("SMTP_USER") or "").strip()
    smtp_pass = (os.getenv("SMTP_PASS") or "").strip().strip('"').strip("'").replace(" ", "")
    smtp_from = (os.getenv("SMTP_FROM") or "").strip() or smtp_user or "no-reply@local"

    if not (smtp_host and smtp_user and smtp_pass):
        print(f"[RESET-SENHA] SMTP não configurado. Código para {to_email}: {code}")
        return False

    msg = EmailMessage()
    msg["Subject"] = "Recuperação de senha - Fila Digital"
    msg["From"] = smtp_from
    msg["To"] = to_email
    msg.set_content(f"Seu código de recuperação é: {code}\n\nEle expira em 15 minutos.")

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)

        print("[SMTP] ✅ Email enviado para:", to_email)
        return True

    except smtplib.SMTPAuthenticationError as e:
        print("[SMTP] ❌ 535 (login recusado). Confirme senha de app e SMTP_USER. Detalhe:", repr(e))
        return False

    except Exception as e:
        print("[SMTP] ❌ Falha geral SMTP:", repr(e))
        return False

# =====================================================
# HELPERS
# =====================================================


def normalize_text_upper_no_accents(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    s = s.strip()
    if not s:
        return None
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return s.upper()


def only_digits(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    d = "".join(ch for ch in str(s) if ch.isdigit())
    return d or None


VALID_CATEGORIAS = {
    "CLINICA", "BARBEARIA", "SALAO", "ESTETICA", "RESTAURANTE", "ACOUGUE", "SUPERMERCADO", "OUTROS"
}


def normalize_categoria(raw: Optional[str]) -> Optional[str]:
    c = normalize_text_upper_no_accents(raw)
    if c is None:
        return None
    if c.startswith("SUPERMERC"):
        c = "SUPERMERCADO"
    if c not in VALID_CATEGORIAS:
        raise HTTPException(
            status_code=400, detail=f"Categoria inválida. Use: {sorted(VALID_CATEGORIAS)}")
    return c


def gerar_senha_codigo():
    letras = ''.join(random.choices(string.ascii_uppercase, k=3))
    nums = ''.join(random.choices(string.digits, k=3))
    return letras + nums


def status_to_front(s: Optional[str]) -> str:
    return (s or "AGUARDANDO").lower()


def calcular_tempo_medio_fila_min(conn, fila_id: int, limite: int = 50, padrao: int = 12) -> int:
    """
    Calcula tempo médio (min) com base nos últimos atendimentos FINALIZADOS da fila.
    Usa data_inicio_atendimento e data_fim_atendimento (persistidos).
    """
    cur = conn.cursor(dictionary=True)
    cur.execute(
        """
        SELECT AVG(dur_seg) AS avg_seg
        FROM (
            SELECT TIMESTAMPDIFF(SECOND, data_inicio_atendimento, data_fim_atendimento) AS dur_seg
            FROM fila_cliente
            WHERE fila_idFila = %s
              AND status = 'FINALIZADO'
              AND data_inicio_atendimento IS NOT NULL
              AND data_fim_atendimento IS NOT NULL
              AND TIMESTAMPDIFF(SECOND, data_inicio_atendimento, data_fim_atendimento) > 0
            ORDER BY data_fim_atendimento DESC
            LIMIT %s
        ) t
        """,
        (fila_id, limite),
    )
    row = cur.fetchone() or {}
    cur.close()

    avg_seg = row.get("avg_seg")
    if not avg_seg:
        return int(padrao)

    minutos = int(round(float(avg_seg) / 60.0))
    return max(1, minutos)


STATUS_PARA_POSICAO = ("AGUARDANDO", "CHAMADO")


def calcular_posicao(conn, fila_id: int, fila_cliente_id: int) -> tuple[int, int]:
    """
    ✅ Cálculo correto e estável:
    - posição/a_frente contam APENAS AGUARDANDO/CHAMADO
    - EM_ATENDIMENTO não conta como "à frente"
    - se o cliente estiver EM_ATENDIMENTO -> (1, 0)
    """
    cur = conn.cursor(dictionary=True)

    cur.execute("""
        SELECT idFilaCliente, status, data_entrada
        FROM fila_cliente
        WHERE idFilaCliente=%s AND fila_idFila=%s
        LIMIT 1
    """, (fila_cliente_id, fila_id))
    meu = cur.fetchone()

    if not meu:
        cur.close()
        return (1, 0)

    meu_status = (meu.get("status") or "").upper()
    minha_data = meu.get("data_entrada")
    meu_id = int(meu.get("idFilaCliente"))

    if meu_status == "EM_ATENDIMENTO":
        cur.close()
        return (1, 0)

    if meu_status not in STATUS_PARA_POSICAO or not minha_data:
        cur.close()
        return (1, 0)

    cur.execute(f"""
        SELECT COUNT(*) AS a_frente
        FROM fila_cliente
        WHERE fila_idFila = %s
          AND status IN ({",".join(["%s"] * len(STATUS_PARA_POSICAO))})
          AND (
                data_entrada < %s
                OR (data_entrada = %s AND idFilaCliente < %s)
              )
    """, (fila_id, *STATUS_PARA_POSICAO, minha_data, minha_data, meu_id))

    a_frente = int((cur.fetchone() or {}).get("a_frente", 0))
    cur.close()
    return (a_frente + 1, a_frente)


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distância em metros entre duas coordenadas."""
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = (math.sin(dphi/2)**2) + math.cos(phi1) * \
        math.cos(phi2)*(math.sin(dl/2)**2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

# 👇 COLE AQUI (logo abaixo)
def coord_invalida(lat, lon):
    try:
        if lat is None or lon is None:
            return True

        lat = float(lat)
        lon = float(lon)

        # inválido se for NaN
        if math.isnan(lat) or math.isnan(lon):
            return True

        # inválido se for 0,0
        if lat == 0.0 and lon == 0.0:
            return True

        return False

    except:
        return True

import requests
import unicodedata

def obter_coordenadas(endereco: str):
    def normalizar(txt: str) -> str:
        txt = (txt or "").strip()
        txt = txt.replace("R.", "Rua ")
        txt = txt.replace("Av.", "Avenida ")
        txt = txt.replace("N°", "")
        txt = txt.replace("n°", "")
        txt = txt.replace("nº", "")
        txt = txt.replace("Nº", "")
        txt = txt.replace("Bairro ", "")
        txt = " ".join(txt.split())
        return txt

    def sem_acentos(txt: str) -> str:
        return "".join(
            c for c in unicodedata.normalize("NFD", txt)
            if unicodedata.category(c) != "Mn"
        )

    def consulta(q: str):
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": q,
            "format": "json",
            "limit": 1,
            "countrycodes": "br"
        }
        headers = {"User-Agent": "fila-digital-app/1.0"}

        print("CONSULTANDO NOMINATIM:", q)
        r = requests.get(url, params=params, headers=headers, timeout=10)

        if r.status_code != 200:
            print("NOMINATIM status:", r.status_code, "resp:", r.text[:200])
            return None, None

        data = r.json()
        if not data:
            print("NOMINATIM vazio para:", q)
            return None, None

        print("NOMINATIM retorno:", data[0].get("display_name"))
        return float(data[0]["lat"]), float(data[0]["lon"])

    endereco = normalizar(endereco)
    if not endereco:
        return None, None

    # 1) completo
    lat, lon = consulta(endereco)
    if lat is not None:
        return lat, lon

    # 2) sem acentos
    q2 = sem_acentos(endereco)
    if q2 != endereco:
        lat, lon = consulta(q2)
        if lat is not None:
            return lat, lon

    # 3) remove complemento entre parênteses
    q3 = endereco.replace("(", "").replace(")", "")
    if q3 != endereco:
        lat, lon = consulta(q3)
        if lat is not None:
            return lat, lon

    # 4) tenta sem bairro
    partes = [p.strip() for p in endereco.split(",")]
    if len(partes) >= 5:
        q4 = f"{partes[0]}, {partes[1]}, {partes[-3]}, {partes[-2]}, Brasil"
        lat, lon = consulta(q4)
        if lat is not None:
            return lat, lon

    return None, None

    # ✅ Tentativa 1: completo
    lat, lon = consulta(endereco)
    if lat is not None:
        return lat, lon

    # ✅ Tentativa 2: remove bairro (parte depois do "-")
    try:
        if " - " in endereco:
            partes = endereco.split(" - ")
            if len(partes) >= 3:
                q2 = f"{partes[0].strip()}, {partes[-2].strip()} - {partes[-1].strip()}"
                lat, lon = consulta(q2)
                if lat is not None:
                    return lat, lon
    except:
        pass

    # ✅ Tentativa 3: só "Cidade - UF, Brasil"
    try:
        if "," in endereco:
            tail = endereco.split(",")[-2].strip()
            q3 = f"{tail}, Brasil"
            lat, lon = consulta(q3)
            if lat is not None:
                return lat, lon
    except:
        pass

    return None, None

# =====================================================
# MODELS
# =====================================================


class EstabelecimentoCreate(BaseModel):
    nome: str
    cidade: Optional[str] = None
    cnpj: Optional[str] = None
    categoria: Optional[str] = None
    estado: Optional[str] = None
    telefone: Optional[str] = None
    email: EmailStr
    senha: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    raio_alerta: Optional[float] = None


class LoginEstabelecimento(BaseModel):
    email: EmailStr
    senha: str


class FilaCreate(BaseModel):
    estabelecimento_id: int
    status: str
    nome: str
    endereco: Optional[str] = None
    raio_metros: int
    tempo_medio_min: int
    capacidade_max: Optional[int] = None
    mensagem_boas_vindas: Optional[str] = None
    horario_funcionamento: Optional[str] = None
    observacoes: Optional[str] = None


class PublicUrlBody(BaseModel):
    public_url: str


class EntrarFilaBody(BaseModel):
    nome: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    telefone: Optional[str] = None

class ClienteLocalizacaoBody(BaseModel):
    cliente_id: int
    latitude: float
    longitude: float

class ChamarProximoBody(BaseModel):
    estabelecimento_id: int


class EstabelecimentoUpdate(BaseModel):
    nome: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    telefone: Optional[str] = None
    cnpj: Optional[str] = None
    categoria: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    raio_alerta: Optional[float] = None


class GeoUpdateBody(BaseModel):
    lat: float
    lng: float
    accuracy_m: Optional[float] = None


class EnderecoBody(BaseModel):
    cep: str
    numero: str
    complemento: Optional[str] = None
    logradouro: str
    bairro: str
    cidade_end: str
    uf: str

class ForgotPasswordBody(BaseModel):
    email: EmailStr

class ResetPasswordBody(BaseModel):
    email: EmailStr
    code: str
    new_password: str
# =====================================================
# ESTABELECIMENTO
# =====================================================


@app.post("/api/estabelecimentos")
def criar_estabelecimento(body: EstabelecimentoCreate):
    try:
        categoria = normalize_categoria(
            body.categoria) if body.categoria else None
        conn = get_conn()
        cur = conn.cursor()

        cnpj = only_digits(body.cnpj)
        telefone = only_digits(body.telefone)

        lat = body.latitude if body.latitude is not None else None
        lon = body.longitude if body.longitude is not None else None

        # (mantido igual ao seu)
        raio_alerta_db = 0

        cur.execute("""
            INSERT INTO estabelecimento
            (nome, cnpj, categoria, cidade, estado, telefone, latitude, longitude, raio_alerta, email, senha)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            body.nome.strip(),
            cnpj,
            categoria,
            (body.cidade or None),
            (body.estado or None),
            telefone,
            lat,
            lon,
            raio_alerta_db,
            body.email.lower().strip(),
            hash_pass(body.senha),
        ))

        conn.commit()
        new_id = cur.lastrowid
        cur.close()
        conn.close()
        return {"ok": True, "idEstabelecimento": new_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/estabelecimentos/{estab_id}/endereco")
def salvar_endereco_estabelecimento(estab_id: int, body: EnderecoBody):
    """
    Salva o endereço do estabelecimento, geocodifica e atualiza:
    - estabelecimento.latitude / longitude
    - filas já existentes desse estabelecimento
    """
    conn = None
    cur = None

    try:
        cep = only_digits(body.cep)
        if not cep or len(cep) != 8:
            raise HTTPException(status_code=400, detail="CEP inválido.")

        numero = (body.numero or "").strip()
        if not numero:
            raise HTTPException(status_code=400, detail="Número é obrigatório.")

        uf = (body.uf or "").strip().upper()
        if len(uf) != 2:
            raise HTTPException(status_code=400, detail="UF inválida (2 letras).")

        logradouro = (body.logradouro or "").strip()
        bairro = (body.bairro or "").strip()
        cidade_end = (body.cidade_end or "").strip()
        complemento = (body.complemento or "").strip() or None

        if not logradouro or not bairro or not cidade_end:
            raise HTTPException(
                status_code=400,
                detail="Logradouro, bairro e cidade são obrigatórios."
            )

        if estab_id <= 0:
            raise HTTPException(status_code=400, detail="ID do estabelecimento inválido.")

        # Endereço completo para geocodificação
        logradouro_limpo = (logradouro or "").strip()
        logradouro_limpo = logradouro_limpo.replace("R.", "Rua ").replace("Av.", "Avenida ").replace("N°", "").strip()

        bairro_limpo = (bairro or "").strip()
        bairro_limpo = bairro_limpo.replace("Bairro ", "").strip()

        numero_limpo = str(numero).replace("N°", "").replace("º", "").strip()
        cidade_limpa = (cidade_end or "").strip()
        uf_limpa = (uf or "").strip().upper()
        complemento_limpo = (complemento or "").strip()

        if complemento_limpo:
            endereco_full = f"{logradouro_limpo}, {numero_limpo}, {complemento_limpo}, {bairro_limpo}, {cidade_limpa}, {uf_limpa}, Brasil"
        else:
            endereco_full = f"{logradouro_limpo}, {numero_limpo}, {bairro_limpo}, {cidade_limpa}, {uf_limpa}, Brasil"

        lat, lon = obter_coordenadas(endereco_full)

        if lat is None or lon is None:
            raise HTTPException(
                status_code=400,
                detail=f"Não consegui localizar o endereço: {endereco_full}"
            )

        lat = float(lat)
        lon = float(lon)

        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        # Confirma se o estabelecimento existe
        cur.execute("""
            SELECT idEstabelecimento
            FROM estabelecimento
            WHERE idEstabelecimento = %s
            LIMIT 1
        """, (estab_id,))
        estab = cur.fetchone()

        if not estab:
            raise HTTPException(status_code=404, detail="Estabelecimento não encontrado.")

        cur.close()

        # Atualiza o estabelecimento
        cur_estab = conn.cursor()
        cur_estab.execute("""
            UPDATE estabelecimento
            SET
                cep=%s,
                numero=%s,
                complemento=%s,
                logradouro=%s,
                bairro=%s,
                cidade_end=%s,
                uf=%s,
                cidade=%s,
                estado=%s,
                latitude=%s,
                longitude=%s
            WHERE idEstabelecimento=%s
        """, (
            cep,
            numero,
            complemento,
            logradouro,
            bairro,
            cidade_end,
            uf,
            cidade_end,   # compatibilidade com campo antigo
            uf,           # compatibilidade com campo antigo
            lat,
            lon,
            estab_id
        ))
        conn.commit()
        cur_estab.close()

        # Sincroniza todas as filas já existentes desse estabelecimento
        cur_filas = conn.cursor()
        cur_filas.execute("""
            UPDATE fila
            SET latitude=%s,
                longitude=%s
            WHERE estabelecimento_idEstabelecimento=%s
        """, (lat, lon, estab_id))
        conn.commit()
        filas_afetadas = cur_filas.rowcount
        cur_filas.close()

        conn.close()

        return {
            "ok": True,
            "estabelecimento_id": estab_id,
            "lat": lat,
            "lon": lon,
            "endereco_full": endereco_full,
            "filas_sincronizadas": filas_afetadas
        }

    except HTTPException:
        if conn:
            try:
                conn.rollback()
            except:
                pass
            try:
                conn.close()
            except:
                pass
        raise

    except Exception as e:
        if conn:
            try:
                conn.rollback()
            except:
                pass
            try:
                conn.close()
            except:
                pass
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/api/login-estabelecimento")
def login_estabelecimento(body: LoginEstabelecimento):
    try:
        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT idEstabelecimento, nome, email, latitude, longitude
            FROM estabelecimento
            WHERE email = %s AND senha = %s
            LIMIT 1
        """, (body.email.lower().strip(), hash_pass(body.senha)))

        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            raise HTTPException(
                status_code=401, detail="Email ou senha inválidos")

        lat = row.get("latitude")
        lon = row.get("longitude")
        needs_address = (
            lat is None or lon is None or float(
                lat) == 0.0 or float(lon) == 0.0
        )

        return {
            "ok": True,
            "estabelecimento_id": row["idEstabelecimento"],
            "nome": row["nome"],
            "email": row["email"],
            "needs_address": needs_address
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/estabelecimentos/{estab_id}")
def get_estabelecimento(estab_id: int):
    try:
        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
    SELECT
        idEstabelecimento AS id,
        nome,
        email,
        telefone,
        cidade,
        estado,
        cnpj,
        categoria,

        cep,
        numero,
        complemento,
        logradouro,
        bairro,
        cidade_end,
        uf,

        latitude,
        longitude,
        raio_alerta
    FROM estabelecimento
    WHERE idEstabelecimento = %s
    LIMIT 1
""", (estab_id,))

        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            raise HTTPException(
                status_code=404, detail="Estabelecimento não encontrado")

        if row.get("categoria"):
            row["categoria"] = str(row["categoria"]).upper()

        return row
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/estabelecimentos/{estab_id}")
def update_estabelecimento(estab_id: int, body: EstabelecimentoUpdate):
    try:
        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT idEstabelecimento
            FROM estabelecimento
            WHERE idEstabelecimento = %s
            LIMIT 1
        """, (estab_id,))
        if not cur.fetchone():
            cur.close()
            conn.close()
            raise HTTPException(
                status_code=404, detail="Estabelecimento não encontrado")

        nome = (body.nome.strip() if body.nome is not None else None)
        cidade = (body.cidade.strip() if body.cidade is not None else None)
        estado = (body.estado.strip() if body.estado is not None else None)
        telefone = (body.telefone.strip()
                    if body.telefone is not None else None)
        cnpj = (body.cnpj.strip() if body.cnpj is not None else None)

        categoria = None
        if body.categoria is not None:
            categoria = normalize_categoria(body.categoria)

        fields = []
        values = []

        def add(col, val):
            fields.append(f"{col}=%s")
            values.append(val)

        if body.nome is not None:
            add("nome", nome if nome else None)
        if body.cidade is not None:
            add("cidade", cidade if cidade else None)
        if body.estado is not None:
            add("estado", estado if estado else None)
        if body.telefone is not None:
            add("telefone", only_digits(telefone))
        if body.cnpj is not None:
            add("cnpj", only_digits(cnpj))
        if body.categoria is not None:
            add("categoria", categoria)
        if body.latitude is not None:
            add("latitude", body.latitude)
        if body.longitude is not None:
            add("longitude", body.longitude)

        if not fields:
            cur.close()
            conn.close()
            return {"ok": True, "detail": "Nada para atualizar."}

        values.append(estab_id)

        cur2 = conn.cursor()
        cur2.execute(f"""
            UPDATE estabelecimento
            SET {", ".join(fields)}
            WHERE idEstabelecimento = %s
        """, tuple(values))
        conn.commit()
        cur2.close()
        cur.close()
        conn.close()

        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/forgot-password")
def forgot_password(body: ForgotPasswordBody):
    email = body.email.lower().strip()
    conn = get_conn()
    cur = conn.cursor(dictionary=True)
    
    # não vazar se existe ou não: retorna ok de qualquer jeito
    cur.execute("SELECT idEstabelecimento FROM estabelecimento WHERE email=%s LIMIT 1", (email,))
    row = cur.fetchone()
    if not row:
        cur.close(); conn.close()
        return {"ok": True}
    
    code = "".join(random.choice(string.digits) for _ in range(6))
    code_hash = hash_code(code)
    expires_at = (datetime.now() + timedelta(minutes=15)).strftime("%Y-%m-%d %H:%M:%S")

    # invalida resets antigos não usados
    cur.execute("""
        UPDATE password_reset SET used=1
        WHERE email=%s AND used=0
    """, (email,))

    cur.execute("""
        INSERT INTO password_reset (email, code_hash, expires_at, used)
        VALUES (%s, %s, %s, 0)
    """, (email, code_hash, expires_at))

    conn.commit()
    cur.close(); conn.close()

    # ✅ AQUI é o que estava faltando:
    # envia email de recuperação
    try:
        ok = send_reset_email(email, code)

        if not ok:
            print("[SMTP] Aviso: não foi possível enviar o e-mail agora (credenciais/bloqueio).")

    except Exception as e:
        print("[SMTP] Erro inesperado ao enviar e-mail:", repr(e))

    # por segurança sempre retorna ok
    return {"ok": True}
      

@app.post("/api/reset-password")
def reset_password(body: ResetPasswordBody):
    email = body.email.lower().strip()
    code = (body.code or "").strip()
    new_password = (body.new_password or "").strip()

    if len(code) != 6 or not code.isdigit():
        raise HTTPException(status_code=400, detail="Código inválido.")
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Senha deve ter no mínimo 8 caracteres.")

    conn = get_conn()
    cur = conn.cursor(dictionary=True)

    cur.execute("""
        SELECT id, code_hash, expires_at, used
        FROM password_reset
        WHERE email=%s
        ORDER BY id DESC
        LIMIT 1
    """, (email,))
    pr = cur.fetchone()

    if not pr or int(pr["used"]) == 1:
        cur.close(); conn.close()
        raise HTTPException(status_code=400, detail="Código expirado ou inválido.")

    expires_at = pr["expires_at"]
    if isinstance(expires_at, str):
        expires_dt = datetime.strptime(expires_at, "%Y-%m-%d %H:%M:%S")
    else:
        expires_dt = expires_at

    if datetime.now() > expires_dt:
        cur.execute("UPDATE password_reset SET used=1 WHERE id=%s", (pr["id"],))
        conn.commit()
        cur.close(); conn.close()
        raise HTTPException(status_code=400, detail="Código expirou. Gere outro.")

    if pr["code_hash"] != hash_code(code):
        cur.close(); conn.close()
        raise HTTPException(status_code=400, detail="Código incorreto.")

    # atualiza senha
    cur.execute("""
        UPDATE estabelecimento
        SET senha=%s
        WHERE email=%s
    """, (hash_pass(new_password), email))

    # marca reset como usado
    cur.execute("UPDATE password_reset SET used=1 WHERE id=%s", (pr["id"],))
    conn.commit()
    cur.close(); conn.close()

    return {"ok": True}
    
# =====================================================
# FILAS
# =====================================================


@app.get("/api/filas")
def listar_filas(
    estabelecimento_id: Optional[int] = Query(default=None),
    # ABERTA | FECHADA | EXCLUIDA | None (todas)
    status: Optional[str] = Query(default=None),
):
    try:
        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        where = []
        params = []

        if estabelecimento_id:
            where.append("estabelecimento_idEstabelecimento = %s")
            params.append(estabelecimento_id)

        if status:
            st = status.strip().upper()
            if st not in ("ABERTA", "FECHADA", "EXCLUIDA"):
                raise HTTPException(
                    status_code=400, detail="status inválido (use ABERTA, FECHADA, EXCLUIDA)")
            where.append("status = %s")
            params.append(st)

        sql = """
            SELECT idFila, nome, status, data_criacao, data_fechamento, estabelecimento_idEstabelecimento
            FROM fila
        """
        if where:
            sql += " WHERE " + " AND ".join(where)

        sql += " ORDER BY idFila DESC"

        cur.execute(sql, tuple(params))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        resp = []
        for r in rows:
            st = (r.get("status") or "").upper()
            resp.append({
                "idFila": r["idFila"],
                "id": r["idFila"],
                "nome": (r.get("nome") or f"Fila #{r['idFila']}"),
                "status": st,
                "ativa": st == "ABERTA",
                "data_criacao": r.get("data_criacao").isoformat() if r.get("data_criacao") else None,
                "data_fechamento": r.get("data_fechamento").isoformat() if r.get("data_fechamento") else None,
                "estabelecimento_id": r.get("estabelecimento_idEstabelecimento"),
            })

        return resp
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/filas")
async def criar_fila(body: FilaCreate):
    try:
        status = (body.status or "").upper().strip()
        if status not in ("ABERTA", "FECHADA"):
            raise HTTPException(status_code=400, detail="status deve ser ABERTA ou FECHADA")

        if not body.estabelecimento_id or body.estabelecimento_id <= 0:
            raise HTTPException(status_code=400, detail="estabelecimento_id inválido")

        nome = (body.nome or "").strip()
        if not nome:
            raise HTTPException(status_code=400, detail="Nome é obrigatório")

        raio_m = int(body.raio_metros or 500)
        if raio_m < 50 or raio_m > 5000:
            raise HTTPException(status_code=400, detail="raio_metros deve estar entre 50 e 5000")
        raio_km = raio_m / 1000.0

        tempo = int(body.tempo_medio_min or 0)
        if tempo <= 0:
            raise HTTPException(status_code=400, detail="tempo_medio_min inválido")

        # ✅ pega geo do estabelecimento (vem do login/endereço)
        conn = get_conn()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT latitude, longitude
            FROM estabelecimento
            WHERE idEstabelecimento=%s
            LIMIT 1
        """, (body.estabelecimento_id,))
        est = cur.fetchone()
        cur.close()
        conn.close()

        if not est:
            raise HTTPException(status_code=404, detail="Estabelecimento não encontrado")

        lat = est.get("latitude")
        lon = est.get("longitude")

        # ✅ valida coordenadas do estabelecimento (AGORA INDENTADO CERTO)
        if coord_invalida(lat, lon):
            raise HTTPException(
                status_code=400,
                detail="Estabelecimento sem localização válida. Complete o endereço no login para gerar latitude/longitude."
            )

        # ✅ insere fila (endereco pode ser NULL)
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO fila
            (nome, status, data_criacao, estabelecimento_idEstabelecimento, endereco, latitude, longitude, raio_km)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            nome,
            status,
            datetime.now(),
            body.estabelecimento_id,
            body.endereco,  # pode ser None
            float(lat),
            float(lon),
            float(raio_km),
        ))
        conn.commit()

        new_id = cur.lastrowid
        cur.close()
        conn.close()

        return {"ok": True, "idFila": new_id, "status": status}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/filas/{fila_id}/abrir")
async def abrir_fila(fila_id: int):
    try:
        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        cur.execute(
            "SELECT idFila, status FROM fila WHERE idFila=%s LIMIT 1", (fila_id,))
        fila = cur.fetchone()
        if not fila:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Fila não encontrada")

        cur2 = conn.cursor()
        cur2.execute("""
            UPDATE fila
            SET status='ABERTA', data_fechamento=NULL
            WHERE idFila=%s
        """, (fila_id,))
        conn.commit()

        cur2.close()
        cur.close()
        conn.close()

        await notify_fila_update(fila_id, "FILA_ABERTA", {"fila_id": fila_id})
        return {"ok": True, "status": "ABERTA"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/filas/{fila_id}/fechar")
async def fechar_fila(fila_id: int):
    try:
        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        cur.execute(
            "SELECT idFila, status FROM fila WHERE idFila=%s LIMIT 1", (fila_id,))
        fila = cur.fetchone()
        if not fila:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Fila não encontrada")

        cur2 = conn.cursor()

        # fecha a fila
        cur2.execute("""
            UPDATE fila
            SET status='FECHADA', data_fechamento=%s
            WHERE idFila=%s
        """, (datetime.now(), fila_id))

        # remove todos os clientes ainda ativos nela
        try:
            cur2.execute("""
                UPDATE fila_cliente
                SET status='SAIU',
                    data_fim=NOW()
                WHERE fila_idFila=%s
                  AND status IN ('AGUARDANDO','CHAMADO','EM_ATENDIMENTO')
            """, (fila_id,))
        except Exception:
            cur2.execute("""
                UPDATE fila_cliente
                SET status='SAIU'
                WHERE fila_idFila=%s
                  AND status IN ('AGUARDANDO','CHAMADO','EM_ATENDIMENTO')
            """, (fila_id,))

        conn.commit()

        cur2.close()
        cur.close()
        conn.close()

        await notify_fila_update(fila_id, "FILA_FECHADA", {
            "fila_id": fila_id,
            "motivo": "fila_fechada"
        })

        return {"ok": True, "status": "FECHADA"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/filas/{fila_id}/excluir")
async def excluir_fila(fila_id: int):
    """
    Soft delete: marca como EXCLUIDA (não apaga do banco).
    """
    try:
        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        cur.execute(
            "SELECT idFila FROM fila WHERE idFila=%s LIMIT 1", (fila_id,))
        if not cur.fetchone():
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Fila não encontrada")

        cur2 = conn.cursor()

        # exclui logicamente a fila
        cur2.execute("""
            UPDATE fila
            SET status='EXCLUIDA', data_fechamento=%s
            WHERE idFila=%s
        """, (datetime.now(), fila_id))

        # remove todos os clientes ainda ativos nela
        try:
            cur2.execute("""
                UPDATE fila_cliente
                SET status='SAIU',
                    data_fim=NOW()
                WHERE fila_idFila=%s
                  AND status IN ('AGUARDANDO','CHAMADO','EM_ATENDIMENTO')
            """, (fila_id,))
        except Exception:
            cur2.execute("""
                UPDATE fila_cliente
                SET status='SAIU'
                WHERE fila_idFila=%s
                  AND status IN ('AGUARDANDO','CHAMADO','EM_ATENDIMENTO')
            """, (fila_id,))

        conn.commit()

        cur2.close()
        cur.close()
        conn.close()

        await notify_fila_update(fila_id, "FILA_EXCLUIDA", {
            "fila_id": fila_id,
            "motivo": "fila_excluida"
        })

        return {"ok": True, "status": "EXCLUIDA"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/filas/{fila_id}/clientes")
def listar_clientes_fila_ao_vivo(fila_id: int):
    """
    Retorna lista pro painel 'Fila ao Vivo':
    - somente clientes ATIVOS na fila (AGUARDANDO/CHAMADO/EM_ATENDIMENTO)
    - já ordenados
    - formato compatível com o front (num, nome, hora, tempo, estimativa, status)
    """
    try:
        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        # tempo médio da fila (min)
        tempo_medio = calcular_tempo_medio_fila_min(conn, fila_id, padrao=12)

        cur.execute("""
            SELECT
                fc.idFilaCliente,
                fc.status AS fc_status,
                fc.data_entrada,
                c.nome AS cliente_nome,
                c.latitude_atual,
                c.longitude_atual,
                f.latitude AS fila_lat,
                f.longitude AS fila_lng,
                f.raio_km
            FROM fila_cliente fc
            JOIN cliente c ON c.idCliente = fc.cliente_idCliente
            JOIN fila f ON f.idFila = fc.fila_idFila
            WHERE fc.fila_idFila = %s
              AND fc.status IN ('AGUARDANDO','CHAMADO','EM_ATENDIMENTO')
            ORDER BY
              CASE fc.status
                WHEN 'EM_ATENDIMENTO' THEN 0
                WHEN 'CHAMADO' THEN 1
                WHEN 'AGUARDANDO' THEN 2
                ELSE 9
              END,
              fc.data_entrada ASC,
              fc.idFilaCliente ASC
        """, (fila_id,))

        rows = cur.fetchall()
        cur.close()
        conn.close()

        out = []
        now = datetime.now()

        for idx, r in enumerate(rows, start=1):
            dt = r.get("data_entrada")
            if dt:
                mins = int((now - dt).total_seconds() // 60)
                tempo_txt = f"{mins} min"
                hora_txt = dt.strftime("%H:%M")
            else:
                tempo_txt = ""
                hora_txt = "--:--"

            est = 0 if (r.get("fc_status") == "EM_ATENDIMENTO") else (
                max(0, idx - 1) * tempo_medio)
            estimativa_txt = f"~{est} min" if est > 0 else "—"

            status_cliente = r.get("status_localizacao") or "fora_raio"

            lat_cli = r.get("latitude_atual")
            lng_cli = r.get("longitude_atual")

            lat_fila = r.get("fila_lat")
            lng_fila = r.get("fila_lng")

            raio_km = r.get("raio_km") or 0.2
            raio_m = raio_km * 1000

            status_local = "fora_raio"

            if lat_cli and lng_cli and lat_fila and lng_fila:
                dist = haversine_m(lat_cli, lng_cli, lat_fila, lng_fila)

                if dist <= raio_m:
                    status_local = "no_raio"

            out.append({
                "num": idx,
                "nome": r.get("cliente_nome") or "—",
                "hora": hora_txt,
                "tempo": tempo_txt,
                "estimativa": estimativa_txt,
                "status": status_local
            })

        return out
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# PUBLIC URL (NGROK)
# =====================================================
PUBLIC_BASE_URL = ""


@app.get("/api/public-url")
def get_public_url():
    return {"public_url": PUBLIC_BASE_URL}


@app.post("/api/public-url")
def set_public_url(body: PublicUrlBody):
    global PUBLIC_BASE_URL
    url = (body.public_url or "").strip().rstrip("/")
    if not (url.startswith("https://") or url.startswith("http://")):
        raise HTTPException(
            status_code=400, detail="URL inválida. Use http:// ou https://")
    PUBLIC_BASE_URL = url
    return {"ok": True, "public_url": PUBLIC_BASE_URL}

# =====================================================
# CLIENTE ENTRAR NA FILA (SEM TELEFONE)
# =====================================================

@app.post("/api/fila/{fila_id}/entrar")
@app.post("/api/filas/{fila_id}/entrar")
async def entrar_na_fila(fila_id: int, body: EntrarFilaBody):
    conn = None

    try:
        nome = (body.nome or "").strip()
        latitude = body.latitude
        longitude = body.longitude
        telefone = (body.telefone or "").strip() or None

        print("LATITUDE RECEBIDA:", latitude)
        print("LONGITUDE RECEBIDA:", longitude)

        if not nome or len(nome) < 3:
            raise HTTPException(
                status_code=400,
                detail="Nome inválido (mínimo 3 caracteres)."
            )

        if latitude is None or longitude is None:
            raise HTTPException(
                status_code=400,
                detail="Localização não informada."
            )

        try:
            latitude = float(latitude)
            longitude = float(longitude)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=400,
                detail="Latitude/longitude inválidas."
            )

        if not (-90 <= latitude <= 90):
            raise HTTPException(status_code=400, detail="Latitude fora do intervalo válido.")

        if not (-180 <= longitude <= 180):
            raise HTTPException(status_code=400, detail="Longitude fora do intervalo válido.")

        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        # busca fila + estabelecimento para validar situação e raio
        cur.execute("""
            SELECT
                f.idFila,
                f.nome,
                f.status,
                f.latitude,
                f.longitude,
                f.raio_km,
                f.estabelecimento_idEstabelecimento,
                e.nome AS estabelecimento_nome,
                e.latitude AS estabelecimento_latitude,
                e.longitude AS estabelecimento_longitude,
                e.raio_alerta AS estabelecimento_raio_alerta
            FROM fila f
            LEFT JOIN estabelecimento e
                ON e.idEstabelecimento = f.estabelecimento_idEstabelecimento
            WHERE f.idFila = %s
            LIMIT 1
        """, (fila_id,))

        fila = cur.fetchone()

        if not fila:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Fila não encontrada.")

        if (fila.get("status") or "").upper() != "ABERTA":
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail="Fila está FECHADA.")

        # usa localização da fila; se não tiver, usa a do estabelecimento
        ref_lat = fila["latitude"] if fila["latitude"] is not None else fila["estabelecimento_latitude"]
        ref_lng = fila["longitude"] if fila["longitude"] is not None else fila["estabelecimento_longitude"]

        # usa raio_km da fila; se não tiver, usa raio_alerta do estabelecimento
        if fila["raio_km"] is not None:
            raio_m = float(fila["raio_km"]) * 1000.0
        elif fila["estabelecimento_raio_alerta"] is not None:
            raio_m = float(fila["estabelecimento_raio_alerta"])
        else:
            raio_m = None

        status_localizacao = "fora_raio"

        if ref_lat is not None and ref_lng is not None and raio_m is not None:
            dist_m = haversine_m(latitude, longitude, float(ref_lat), float(ref_lng))
            status_localizacao = "dentro_raio" if dist_m <= raio_m else "fora_raio"

            print("DISTÂNCIA (m):", dist_m)
            print("RAIO (m):", raio_m)
            print("STATUS_LOCALIZACAO:", status_localizacao)

        cur.close()

        # 1) cria cliente com localização atual
        cur_cliente = conn.cursor()
        cur_cliente.execute("""
            INSERT INTO cliente
                (nome, telefone, status, latitude_atual, longitude_atual, ultima_atualizacao)
            VALUES
                (%s, %s, 'ATIVO', %s, %s, NOW())
        """, (nome, telefone, latitude, longitude))
        conn.commit()
        cliente_id = int(cur_cliente.lastrowid)
        cur_cliente.close()

        # 2) salva histórico em posicao_gps
        cur_gps = conn.cursor()
        cur_gps.execute("""
            INSERT INTO posicao_gps
                (latitude, longitude, data_ultima_atualizacao, cliente_idCliente)
            VALUES
                (%s, %s, NOW(), %s)
        """, (latitude, longitude, cliente_id))
        conn.commit()
        cur_gps.close()

        # 3) registra entrada na fila
        senha_codigo = gerar_senha_codigo()

        cur_fc = conn.cursor()
        cur_fc.execute("""
            INSERT INTO fila_cliente
                (fila_idFila, cliente_idCliente, status, senha_codigo, data_entrada, status_localizacao)
            VALUES
                (%s, %s, 'AGUARDANDO', %s, %s, %s)
        """, (
            fila_id,
            cliente_id,
            senha_codigo,
            datetime.now(),
            status_localizacao
        ))
        conn.commit()
        fila_cliente_id = int(cur_fc.lastrowid)
        cur_fc.close()

        posicao, a_frente = calcular_posicao(conn, fila_id, fila_cliente_id)

        cur_nomefila = conn.cursor(dictionary=True)
        cur_nomefila.execute("""
            SELECT nome
            FROM fila
            WHERE idFila = %s
            LIMIT 1
        """, (fila_id,))
        fila_row = cur_nomefila.fetchone() or {}
        cur_nomefila.close()

        await notify_fila_update(fila_id, "CLIENTE_ENTROU", {
            "cliente_id": cliente_id,
            "fila_cliente_id": fila_cliente_id,
            "nome": nome,
            "fila_nome": (fila_row.get("nome") or f"Fila #{fila_id}"),
            "posicao": posicao,
            "a_frente": a_frente,
            "status_localizacao": status_localizacao,
        })

        conn.close()

        return {
            "ok": True,
            "fila_id": fila_id,
            "cliente_id": cliente_id,
            "fila_cliente_id": fila_cliente_id,
            "senha_codigo": senha_codigo,
            "posicao": posicao,
            "a_frente": a_frente,
            "status": "aguardando",
            "status_localizacao": status_localizacao,
        }

    except HTTPException:
        if conn:
            try:
                conn.rollback()
            except:
                pass
            try:
                conn.close()
            except:
                pass
        raise

    except Exception as e:
        if conn:
            try:
                conn.rollback()
            except:
                pass
            try:
                conn.close()
            except:
                pass
        raise HTTPException(status_code=500, detail=str(e))
    
# =====================================================
# SAIR DA FILA
# =====================================================

@app.post("/api/fila/{fila_id}/cliente/{cliente_id}/sair")
@app.post("/api/filas/{fila_id}/cliente/{cliente_id}/sair")
async def sair_da_fila(fila_id: int, cliente_id: int, origem: str = Query(default="")):
    try:
        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT idFilaCliente
            FROM fila_cliente
            WHERE fila_idFila = %s
              AND cliente_idCliente = %s
              AND status IN ('AGUARDANDO','CHAMADO','EM_ATENDIMENTO')
            ORDER BY idFilaCliente DESC
            LIMIT 1
        """, (fila_id, cliente_id))
        row = cur.fetchone()

        if not row:
            cur.close(); conn.close()
            return {"ok": True, "detail": "Cliente não estava ativo na fila."}

        fila_cliente_id = int(row["idFilaCliente"])

        # pega nome do cliente + nome da fila (pro toast)
        cur3 = conn.cursor(dictionary=True)
        cur3.execute("""
            SELECT c.nome AS cliente_nome, f.nome AS fila_nome
            FROM fila_cliente fc
            JOIN cliente c ON c.idCliente = fc.cliente_idCliente
            JOIN fila f ON f.idFila = fc.fila_idFila
            WHERE fc.idFilaCliente = %s
            LIMIT 1
        """, (fila_cliente_id,))
        info = cur3.fetchone() or {}
        cur3.close()

        # ✅ UPDATE robusto: tenta com data_fim, se não existir cai pro simples
        cur2 = conn.cursor()
        try:
            cur2.execute("""
                UPDATE fila_cliente
                SET status = 'SAIU',
                    data_fim = NOW()
                WHERE idFilaCliente = %s
            """, (fila_cliente_id,))
        except Exception:
            cur2.execute("""
                UPDATE fila_cliente
                SET status = 'SAIU'
                WHERE idFilaCliente = %s
            """, (fila_cliente_id,))
        conn.commit()
        cur2.close()

        # ✅ dispara evento que o painel escuta
        await notify_fila_update(fila_id, "CLIENTE_SAIU", {
            "cliente_id": cliente_id,
            "fila_cliente_id": fila_cliente_id,
            "nome": info.get("cliente_nome") or "Cliente",
            "fila_nome": info.get("fila_nome") or f"Fila #{fila_id}",
            "origem": (origem or "").lower() or "botao"
        })

        cur.close(); conn.close()
        return {"ok": True}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================
# STATUS DO CLIENTE (✅ POSIÇÃO CORRETA) + ✅ RAIO DA FILA
# =====================================================

@app.get("/api/fila/{fila_id}/cliente/{cliente_id}/status")
@app.get("/api/filas/{fila_id}/cliente/{cliente_id}/status")
async def status_cliente_fila(fila_id: int, cliente_id: int):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        # 1) verifica a fila primeiro
        cur.execute("""
            SELECT idFila, status, nome, raio_km
            FROM fila
            WHERE idFila = %s
            LIMIT 1
        """, (fila_id,))
        fila_info = cur.fetchone()

        if not fila_info:
            cur.close()
            conn.close()
            return {
                "encerrado": True,
                "motivo": "fila_excluida"
            }

        fila_status = (fila_info.get("status") or "").upper()

        if fila_status == "FECHADA":
            cur.close()
            conn.close()
            return {
                "encerrado": True,
                "motivo": "fila_fechada"
            }

        if fila_status == "EXCLUIDA":
            cur.close()
            conn.close()
            return {
                "encerrado": True,
                "motivo": "fila_excluida"
            }

        # 2) se a fila estiver ativa, procura o cliente nela
        cur.execute("""
            SELECT
                fc.idFilaCliente,
                fc.status,
                fc.senha_codigo,
                fc.data_entrada,
                fc.status_localizacao,
                f.nome AS fila_nome,
                f.raio_km
            FROM fila_cliente fc
            JOIN fila f ON f.idFila = fc.fila_idFila
            WHERE fc.fila_idFila = %s
              AND fc.cliente_idCliente = %s
              AND fc.status IN ('AGUARDANDO', 'CHAMADO', 'EM_ATENDIMENTO')
            ORDER BY fc.idFilaCliente DESC
            LIMIT 1
        """, (fila_id, cliente_id))

        row = cur.fetchone()

        if not row:
            cur.close()
            conn.close()
            return {
                "encerrado": True,
                "motivo": "cancelado"
            }

        fila_cliente_id = int(row["idFilaCliente"])
        posicao, a_frente = calcular_posicao(conn, fila_id, fila_cliente_id)

        status_db = (row.get("status") or "").upper()
        if status_db == "EM_ATENDIMENTO":
            status_front = "em_atendimento"
        elif status_db == "CHAMADO":
            status_front = "chamado"
        else:
            status_front = "aguardando"

        tempo_medio_min = 12
        estimativa_min = max(0, a_frente * tempo_medio_min)

        cur.close()
        conn.close()

        return {
            "encerrado": False,
            "fila_nome": row.get("fila_nome") or f"Fila #{fila_id}",
            "fila_raio_m": round(float(row.get("raio_km") or 0) * 1000, 2),
            "posicao": posicao,
            "a_frente": a_frente,
            "tempo_medio_min": tempo_medio_min,
            "estimativa_min": estimativa_min,
            "cliente": {
                "cliente_id": cliente_id,
                "fila_cliente_id": fila_cliente_id,
                "status": status_front,
                "senha_codigo": row.get("senha_codigo"),
                "status_localizacao": row.get("status_localizacao")
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        if conn:
            try:
                conn.close()
            except:
                pass
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/fila/{fila_id}/info")
@app.get("/api/filas/{fila_id}/info")
async def fetch_fila_info(fila_id: int):
    conn = None

    try:
        if fila_id <= 0:
            raise HTTPException(status_code=400, detail="fila_id inválido.")

        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT
                f.idFila,
                f.nome,
                f.status,
                f.latitude AS fila_latitude,
                f.longitude AS fila_longitude,
                f.raio_km,
                f.estabelecimento_idEstabelecimento,

                e.idEstabelecimento,
                e.nome AS estabelecimento_nome,
                e.latitude AS estabelecimento_latitude,
                e.longitude AS estabelecimento_longitude,
                e.raio_alerta AS estabelecimento_raio_alerta,
                e.logradouro,
                e.numero,
                e.bairro,
                e.cidade_end,
                e.uf
            FROM fila f
            LEFT JOIN estabelecimento e
                ON e.idEstabelecimento = f.estabelecimento_idEstabelecimento
            WHERE f.idFila = %s
            LIMIT 1
        """, (fila_id,))

        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            raise HTTPException(status_code=404, detail="Fila não encontrada.")

        # PRIORIDADE DAS COORDENADAS
        # 1) fila
        # 2) estabelecimento
        lat = None
        lng = None
        origem_geo = None

        if row["fila_latitude"] is not None and row["fila_longitude"] is not None:
            lat = float(row["fila_latitude"])
            lng = float(row["fila_longitude"])
            origem_geo = "fila"
        elif row["estabelecimento_latitude"] is not None and row["estabelecimento_longitude"] is not None:
            lat = float(row["estabelecimento_latitude"])
            lng = float(row["estabelecimento_longitude"])
            origem_geo = "estabelecimento"

        # =====================================================
        # PRIORIDADE DO RAIO
        # 1) fila.raio_km -> converte para metros
        # 2) estabelecimento.raio_alerta
        # =====================================================
        raio_m = None
        origem_raio = None

        if row["raio_km"] is not None:
            raio_m = int(float(row["raio_km"]) * 1000)
            origem_raio = "fila.raio_km"
        elif row["estabelecimento_raio_alerta"] is not None:
            raio_m = int(row["estabelecimento_raio_alerta"])
            origem_raio = "estabelecimento.raio_alerta"

        # endereço amigável
        endereco_partes = [
            (row.get("logradouro") or "").strip(),
            (row.get("numero") or "").strip(),
            (row.get("bairro") or "").strip(),
            (row.get("cidade_end") or "").strip(),
            (row.get("uf") or "").strip(),
        ]
        endereco_formatado = ", ".join([p for p in endereco_partes if p])

        return {
            "ok": True,
            "fila": {
                "id": row["idFila"],
                "nome": row["nome"],
                "status": row["status"],
                "raio_km": float(row["raio_km"]) if row["raio_km"] is not None else None,
            },
            "estabelecimento": {
                "id": row["idEstabelecimento"],
                "nome": row["estabelecimento_nome"],
                "lat": lat,
                "lng": lng,
                "raio_m": raio_m,
                "endereco": endereco_formatado or None,
                "origem_geo": origem_geo,
                "origem_raio": origem_raio,
            }
        }

    except HTTPException:
        if conn:
            try:
                conn.close()
            except:
                pass
        raise

    except Exception as e:
        if conn:
            try:
                conn.close()
            except:
                pass
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================
# ATENDIMENTO
# =====================================================


def _fila_get_status(conn, fila_id: int):
    cur = conn.cursor(dictionary=True)

    cur.execute(
        "SELECT idFila, status FROM fila WHERE idFila=%s LIMIT 1", (fila_id,))
    fila = cur.fetchone()
    if not fila:
        cur.close()
        raise HTTPException(status_code=404, detail="Fila não encontrada")

    # Cliente em atendimento agora
    cur.execute("""
        SELECT
            fc.idFilaCliente,
            c.nome,
            fc.status_localizacao
        FROM fila_cliente fc
        JOIN cliente c ON c.idCliente = fc.cliente_idCliente
        WHERE fc.fila_idFila = %s
          AND fc.status = 'EM_ATENDIMENTO'
        ORDER BY fc.data_entrada ASC, fc.idFilaCliente ASC
        LIMIT 1
    """, (fila_id,))
    atual = cur.fetchone()

    # Total aguardando/chamado
    cur.execute("""
        SELECT COUNT(*) AS total
        FROM fila_cliente
        WHERE fila_idFila = %s
          AND status IN ('AGUARDANDO','CHAMADO')
    """, (fila_id,))
    aguardando_total = int((cur.fetchone() or {}).get("total", 0))

    # Lista completa da espera:
    # 1º = próximo
    # resto = demais clientes
    cur.execute("""
        SELECT
            fc.idFilaCliente,
            c.nome,
            fc.status,
            fc.status_localizacao
        FROM fila_cliente fc
        JOIN cliente c ON c.idCliente = fc.cliente_idCliente
        WHERE fc.fila_idFila = %s
          AND fc.status IN ('CHAMADO','AGUARDANDO')
        ORDER BY
          CASE fc.status WHEN 'CHAMADO' THEN 0 ELSE 1 END,
          fc.data_entrada ASC,
          fc.idFilaCliente ASC
    """, (fila_id,))
    fila_espera = cur.fetchall() or []

    cur.close()

    atual_obj = None
    if atual:
        atual_obj = {
            "fila_cliente_id": int(atual["idFilaCliente"]),
            "nome": atual["nome"],
            "status_localizacao": atual.get("status_localizacao")
        }

    prox_obj = None
    demais_obj = []

    if fila_espera:
        primeiro = fila_espera[0]

        prox_obj = {
            "fila_cliente_id": int(primeiro["idFilaCliente"]),
            "nome": primeiro["nome"],
            "posicao": 1,
            "status": (primeiro.get("status") or "AGUARDANDO"),
            "status_localizacao": primeiro.get("status_localizacao")
        }

        for idx, item in enumerate(fila_espera[1:], start=2):
            demais_obj.append({
                "fila_cliente_id": int(item["idFilaCliente"]),
                "nome": item["nome"],
                "posicao": idx,
                "status": (item.get("status") or "AGUARDANDO"),
                "status_localizacao": item.get("status_localizacao")
            })

    return {
        "fila_id": int(fila["idFila"]),
        "fila_status": (fila.get("status") or "").upper(),
        "aguardando_total": aguardando_total,
        "tempo_medio_min": calcular_tempo_medio_fila_min(conn, fila_id, padrao=12),
        "atual": atual_obj,
        "proximo": prox_obj,
        "demais_na_fila": demais_obj
    }

@app.get("/api/filas/{fila_id}/atendimento/status")
def atendimento_status(fila_id: int):
    conn = get_conn()
    try:
        return _fila_get_status(conn, fila_id)
    finally:
        conn.close()


@app.post("/api/filas/{fila_id}/atendimento/chamar")
async def atendimento_chamar(fila_id: int):
    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT idFilaCliente FROM fila_cliente
            WHERE fila_idFila=%s AND status='EM_ATENDIMENTO'
            LIMIT 1
        """, (fila_id,))
        if cur.fetchone():
            cur.close()
            raise HTTPException(
                status_code=400, detail="Já existe um cliente em atendimento.")

        # ✅✅ CORRIGIDO: pega CHAMADO primeiro, depois AGUARDANDO
        cur.execute("""
            SELECT fc.idFilaCliente, fc.cliente_idCliente, c.nome, fc.status
            FROM fila_cliente fc
            JOIN cliente c ON c.idCliente = fc.cliente_idCliente
            WHERE fc.fila_idFila=%s AND fc.status IN ('CHAMADO','AGUARDANDO')
            ORDER BY
              CASE fc.status WHEN 'CHAMADO' THEN 0 ELSE 1 END,
              fc.data_entrada ASC, fc.idFilaCliente ASC
            LIMIT 1
        """, (fila_id,))
        prox = cur.fetchone()
        if not prox:
            cur.close()
            raise HTTPException(
                status_code=400, detail="Não há clientes aguardando.")

        fila_cliente_id = int(prox["idFilaCliente"])
        cliente_id = int(prox["cliente_idCliente"])
        nome = prox["nome"]

        agora = datetime.now()

        cur2 = conn.cursor()
        cur2.execute("""
            UPDATE fila_cliente
            SET status='EM_ATENDIMENTO',
                data_inicio_atendimento=%s,
                data_fim_atendimento=NULL
            WHERE idFilaCliente=%s
        """, (agora, fila_cliente_id))
        conn.commit()

        cur2.close()
        cur.close()

        await notify_fila_update(
            fila_id,
            "CHAMOU_PROXIMO",
            {"fila_cliente_id": fila_cliente_id,
                "cliente_id": cliente_id, "nome": nome}
        )
        return {"ok": True, "cliente": {"fila_cliente_id": fila_cliente_id, "cliente_id": cliente_id, "nome": nome, "posicao": 1}}

    finally:
        conn.close()


@app.post("/api/filas/{fila_id}/atendimento/finalizar")
async def atendimento_finalizar(fila_id: int):
    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT fc.idFilaCliente, fc.cliente_idCliente, c.nome
            FROM fila_cliente fc
            JOIN cliente c ON c.idCliente = fc.cliente_idCliente
            WHERE fc.fila_idFila=%s AND fc.status='EM_ATENDIMENTO'
            ORDER BY fc.data_entrada ASC, fc.idFilaCliente ASC
            LIMIT 1
        """, (fila_id,))
        row = cur.fetchone()

        if not row:
            cur.close()
            raise HTTPException(
                status_code=400, detail="Não há cliente em atendimento.")

        fila_cliente_id = int(row["idFilaCliente"])
        cliente_id = int(row["cliente_idCliente"])
        cliente_nome = row["nome"]

        agora = datetime.now()

        cur2 = conn.cursor()
        cur2.execute("""
            UPDATE fila_cliente
            SET status='FINALIZADO',
                data_saida=%s,
                data_fim_atendimento=%s,
                data_inicio_atendimento = COALESCE(data_inicio_atendimento, data_entrada)
            WHERE idFilaCliente=%s
        """, (agora, agora, fila_cliente_id))
        conn.commit()

        cur2.close()
        cur.close()

        await notify_fila_update(fila_id, "ATENDIMENTO_FINALIZADO", {
            "fila_cliente_id": fila_cliente_id,
            "cliente_id": cliente_id,
            "nome": cliente_nome
        })

        await notify_fila_update(fila_id, "FINALIZOU", {
            "fila_cliente_id": fila_cliente_id,
            "cliente_id": cliente_id,
            "nome": cliente_nome
        })

        return {"ok": True}

    finally:
        conn.close()


@app.post("/api/filas/{fila_id}/atendimento/cancelar")
async def atendimento_cancelar(fila_id: int):
    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT fc.idFilaCliente, fc.cliente_idCliente, c.nome
            FROM fila_cliente fc
            JOIN cliente c ON c.idCliente = fc.cliente_idCliente
            WHERE fc.fila_idFila=%s AND fc.status='EM_ATENDIMENTO'
            ORDER BY fc.data_entrada ASC, fc.idFilaCliente ASC
            LIMIT 1
        """, (fila_id,))
        row = cur.fetchone()

        if not row:
            cur.close()
            raise HTTPException(
                status_code=400, detail="Não há cliente em atendimento.")

        fila_cliente_id = int(row["idFilaCliente"])
        cliente_id = int(row["cliente_idCliente"])
        nome = row["nome"]
        agora = datetime.now()

        cur2 = conn.cursor()
        cur2.execute("""
            UPDATE fila_cliente
            SET status='SAIU',
                data_saida=%s,
                data_fim_atendimento=NULL
            WHERE idFilaCliente=%s
        """, (agora, fila_cliente_id))
        conn.commit()
        cur2.close()
        cur.close()

        await notify_fila_update(fila_id, "ATENDIMENTO_CANCELADO", {
            "fila_cliente_id": fila_cliente_id,
            "cliente_id": cliente_id,
            "nome": nome
        })

        await notify_fila_update(fila_id, "CANCELOU", {"fila_cliente_id": fila_cliente_id, "cliente_id": cliente_id, "nome": nome})

        return {"ok": True}

    finally:
        conn.close()


@app.post("/api/filas/{fila_id}/atendimento/pular")
async def atendimento_pular(fila_id: int):
    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT idFilaCliente FROM fila_cliente
            WHERE fila_idFila=%s AND status='EM_ATENDIMENTO'
            LIMIT 1
        """, (fila_id,))
        if cur.fetchone():
            cur.close()
            raise HTTPException(
                status_code=400, detail="Finalize/cancele o atendimento antes de pular.")

        cur.execute("""
            SELECT idFilaCliente
            FROM fila_cliente
            WHERE fila_idFila=%s AND status='AGUARDANDO'
            ORDER BY data_entrada ASC, idFilaCliente ASC
            LIMIT 1
        """, (fila_id,))
        row = cur.fetchone()
        if not row:
            cur.close()
            raise HTTPException(
                status_code=400, detail="Não há clientes aguardando.")

        fila_cliente_id = int(row["idFilaCliente"])

        cur2 = conn.cursor()
        cur2.execute("""
            UPDATE fila_cliente
            SET data_entrada=%s
            WHERE idFilaCliente=%s
        """, (datetime.now(), fila_cliente_id))
        conn.commit()
        cur2.close()
        cur.close()

        await notify_fila_update(fila_id, "PULOU", {"fila_cliente_id": fila_cliente_id})
        return {"ok": True}
    finally:
        conn.close()

# =====================================================
# DASHBOARD (VISÃO GERAL)
# =====================================================


@app.get("/api/dashboard/resumo")
def dashboard_resumo(estabelecimento_id: int = Query(...)):
    try:
        if estabelecimento_id <= 0:
            raise HTTPException(status_code=400, detail="estabelecimento_id inválido")

        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT idEstabelecimento, nome
            FROM estabelecimento
            WHERE idEstabelecimento = %s
            LIMIT 1
        """, (estabelecimento_id,))
        est = cur.fetchone()
        if not est:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Estabelecimento não encontrado")

        # ✅ Totais (ABERTAS) + ✅ Cancelados/Concluídos (histórico do estabelecimento)
        cur.execute("""
            SELECT
              (SELECT COUNT(*)
               FROM fila f2
               JOIN fila_cliente fc2 ON fc2.fila_idFila = f2.idFila
               WHERE f2.estabelecimento_idEstabelecimento = %s
                 AND f2.status = 'ABERTA'
                 AND fc2.status = 'AGUARDANDO'
              ) AS na_fila,

              (SELECT COUNT(*)
               FROM fila f3
               JOIN fila_cliente fc3 ON fc3.fila_idFila = f3.idFila
               WHERE f3.estabelecimento_idEstabelecimento = %s
                 AND f3.status = 'ABERTA'
                 AND fc3.status = 'EM_ATENDIMENTO'
              ) AS atendendo,

              (SELECT COUNT(*)
               FROM fila f4
               JOIN fila_cliente fc4 ON fc4.fila_idFila = f4.idFila
               WHERE f4.estabelecimento_idEstabelecimento = %s
                 AND f4.status = 'ABERTA'
                 AND fc4.status = 'CHAMADO'
              ) AS chamados,

              -- ✅ CONCLUÍDOS (histórico): FINALIZADO
              (SELECT COUNT(*)
               FROM fila f5
               JOIN fila_cliente fc5 ON fc5.fila_idFila = f5.idFila
               WHERE f5.estabelecimento_idEstabelecimento = %s
                 AND fc5.status = 'FINALIZADO'
              ) AS concluidos,

              -- ✅ CANCELADOS (histórico): status SAIU mas com data_inicio_atendimento preenchida
              (SELECT COUNT(*)
               FROM fila f6
               JOIN fila_cliente fc6 ON fc6.fila_idFila = f6.idFila
               WHERE f6.estabelecimento_idEstabelecimento = %s
                 AND fc6.status = 'SAIU'
                 AND fc6.data_inicio_atendimento IS NOT NULL
              ) AS cancelados
        """, (
            estabelecimento_id,
            estabelecimento_id,
            estabelecimento_id,
            estabelecimento_id,
            estabelecimento_id
        ))

        totais = cur.fetchone() or {}

        # ✅ Próximo (ABERTAS)
        cur.execute("""
            SELECT
              fc.idFilaCliente,
              fc.fila_idFila,
              fc.cliente_idCliente,
              fc.status,
              fc.data_entrada,
              c.nome AS cliente_nome
            FROM fila f
            JOIN fila_cliente fc ON fc.fila_idFila = f.idFila
            JOIN cliente c ON c.idCliente = fc.cliente_idCliente
            WHERE f.estabelecimento_idEstabelecimento = %s
              AND f.status = 'ABERTA'
              AND fc.status = 'AGUARDANDO'
            ORDER BY fc.data_entrada ASC, fc.idFilaCliente ASC
            LIMIT 1
        """, (estabelecimento_id,))
        prox = cur.fetchone()

        # ✅ Tempo médio geral das filas abertas do estabelecimento
        cur.execute("""
            SELECT idFila
            FROM fila
            WHERE estabelecimento_idEstabelecimento = %s
              AND status = 'ABERTA'
        """, (estabelecimento_id,))
        filas_abertas = cur.fetchall() or []

        tempos_medios = []
        for fila_item in filas_abertas:
            fila_id = int(fila_item["idFila"])
            tempo_fila = calcular_tempo_medio_fila_min(conn, fila_id, padrao=12)

            if tempo_fila is not None and tempo_fila > 0:
                tempos_medios.append(float(tempo_fila))

        if tempos_medios:
            tempo_medio_geral = round(sum(tempos_medios) / len(tempos_medios))
        else:
            tempo_medio_geral = 12

        cur.close()
        conn.close()

        return {
            "ok": True,
            "estabelecimento": {
                "id": est["idEstabelecimento"],
                "nome": est["nome"]
            },
            "totais": {
                "na_fila": int(totais.get("na_fila") or 0),
                "atendendo": int(totais.get("atendendo") or 0),
                "chamados": int(totais.get("chamados") or 0),
                "cancelados": int(totais.get("cancelados") or 0),
                "concluidos": int(totais.get("concluidos") or 0),
                "tempo_medio_min": int(tempo_medio_geral),
                "no_raio": 0,
            },
            "proximo": (None if not prox else {
                "idFilaCliente": int(prox["idFilaCliente"]),
                "fila_id": int(prox["fila_idFila"]),
                "cliente_id": int(prox["cliente_idCliente"]),
                "nome": prox["cliente_nome"],
                "status": prox["status"],
                "data_entrada": prox["data_entrada"].isoformat() if prox.get("data_entrada") else None
            })
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/dashboard/chamar-proximo")
async def dashboard_chamar_proximo(body: ChamarProximoBody):
    try:
        estabelecimento_id = int(body.estabelecimento_id or 0)
        if estabelecimento_id <= 0:
            raise HTTPException(
                status_code=400, detail="estabelecimento_id inválido")

        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT
              fc.idFilaCliente,
              fc.fila_idFila,
              fc.cliente_idCliente,
              c.nome AS cliente_nome
            FROM fila f
            JOIN fila_cliente fc ON fc.fila_idFila = f.idFila
            JOIN cliente c ON c.idCliente = fc.cliente_idCliente
            WHERE f.estabelecimento_idEstabelecimento = %s
              AND f.status = 'ABERTA'
              AND fc.status = 'AGUARDANDO'
            ORDER BY fc.data_entrada ASC, fc.idFilaCliente ASC
            LIMIT 1
        """, (estabelecimento_id,))
        prox = cur.fetchone()

        if not prox:
            cur.close()
            conn.close()
            return {"ok": True, "detail": "Ninguém aguardando."}

        fila_cliente_id = int(prox["idFilaCliente"])
        fila_id = int(prox["fila_idFila"])

        cur2 = conn.cursor()
        cur2.execute("""
            UPDATE fila_cliente
            SET status = 'CHAMADO'
            WHERE idFilaCliente = %s
        """, (fila_cliente_id,))
        conn.commit()
        cur2.close()

        cur.close()
        conn.close()

        await notify_fila_update(fila_id, "CLIENTE_CHAMADO", {
            "fila_cliente_id": fila_cliente_id,
            "cliente_id": int(prox["cliente_idCliente"]),
            "nome": prox["cliente_nome"]
        })

        return {
            "ok": True,
            "chamado": {
                "fila_id": fila_id,
                "fila_cliente_id": fila_cliente_id,
                "cliente_id": int(prox["cliente_idCliente"]),
                "nome": prox["cliente_nome"]
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================
# INFO FILA + GEO (✅ RAIO DA FILA)
# =====================================================


async def fetch_fila_info(fila_id: int):
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT
                f.idFila,
                f.nome,
                f.status,
                f.latitude,
                f.longitude,
                f.raio_km,
                f.estabelecimento_idEstabelecimento,
                e.nome AS estabelecimento_nome,
                e.latitude AS estabelecimento_latitude,
                e.longitude AS estabelecimento_longitude,
                e.raio_alerta AS estabelecimento_raio_alerta
            FROM fila f
            LEFT JOIN estabelecimento e
                ON e.idEstabelecimento = f.estabelecimento_idEstabelecimento
            WHERE f.idFila = %s
            LIMIT 1
        """, (fila_id,))

        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            raise HTTPException(status_code=404, detail="Fila não encontrada.")

        # prioriza coordenadas da fila; se não tiver, usa as do estabelecimento
        lat = row["latitude"] if row["latitude"] is not None else row["estabelecimento_latitude"]
        lng = row["longitude"] if row["longitude"] is not None else row["estabelecimento_longitude"]

        # prioriza raio da fila (km -> m); se não tiver, usa raio_alerta do estabelecimento
        if row["raio_km"] is not None:
            raio_m = int(float(row["raio_km"]) * 1000)
        elif row["estabelecimento_raio_alerta"] is not None:
            raio_m = int(row["estabelecimento_raio_alerta"])
        else:
            raio_m = None

        return {
            "ok": True,
            "fila": {
                "id": row["idFila"],
                "nome": row["nome"],
                "status": row["status"],
            },
            "estabelecimento": {
                "id": row["estabelecimento_idEstabelecimento"],
                "nome": row["estabelecimento_nome"],
                "lat": float(lat) if lat is not None else None,
                "lng": float(lng) if lng is not None else None,
                "raio_m": raio_m,
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        if conn:
            try:
                conn.close()
            except:
                pass
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/fila/{fila_id}/cliente/{cliente_id}/geo")
@app.post("/api/filas/{fila_id}/cliente/{cliente_id}/geo")
async def atualizar_geo_cliente(fila_id: int, cliente_id: int, body: GeoUpdateBody):
    try:
        conn = get_conn()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT
                f.latitude AS fila_lat,
                f.longitude AS fila_lng,
                e.latitude AS estab_lat,
                e.longitude AS estab_lng,
                f.raio_km
            FROM fila f
            JOIN estabelecimento e ON e.idEstabelecimento = f.estabelecimento_idEstabelecimento
            WHERE f.idFila = %s
            LIMIT 1
        """, (fila_id,))
        row = cur.fetchone()

        if not row:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Fila não encontrada.")

        # prioridade: coordenadas da fila; se não houver, usa estabelecimento
        if row["fila_lat"] is not None and row["fila_lng"] is not None:
            ref_lat = float(row["fila_lat"])
            ref_lng = float(row["fila_lng"])
            origem_geo = "fila"
        elif row["estab_lat"] is not None and row["estab_lng"] is not None:
            ref_lat = float(row["estab_lat"])
            ref_lng = float(row["estab_lng"])
            origem_geo = "estabelecimento"
        else:
            cur.close()
            conn.close()
            raise HTTPException(
                status_code=400,
                detail="Fila/estabelecimento sem latitude/longitude configurados."
            )

        raio_m = float(row.get("raio_km") or 0) * 1000
        if raio_m <= 0:
            cur.close()
            conn.close()
            raise HTTPException(
                status_code=400,
                detail="Fila sem raio configurado."
            )

        acc = float(body.accuracy_m) if body.accuracy_m is not None else None
        max_acc = 200.0
        if acc is not None and acc > max_acc:
            cur.close()
            conn.close()
            raise HTTPException(
                status_code=400,
                detail=f"Localização imprecisa demais (±{acc:.0f}m). Tente novamente."
            )

        dist_m = haversine_m(body.lat, body.lng, ref_lat, ref_lng)
        inside = dist_m <= raio_m

        limite_bloqueio_m = raio_m * 2.5
        if dist_m > limite_bloqueio_m:
            cur.close()
            conn.close()
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "FORA_DA_AREA",
                    "message": "Você está muito longe da fila. Aproxime-se do estabelecimento para entrar.",
                    "distance_m": round(dist_m, 2),
                    "limit_m": round(limite_bloqueio_m, 2),
                    "origem_geo": origem_geo
                }
            )

        now = datetime.now()

        cur2 = conn.cursor()
        cur2.execute("""
            UPDATE cliente
            SET latitude_atual=%s, longitude_atual=%s, ultima_atualizacao=%s
            WHERE idCliente=%s
        """, (body.lat, body.lng, now, cliente_id))

        cur2.execute("""
            INSERT INTO posicao_gps(latitude, longitude, data_ultima_atualizacao, cliente_idCliente)
            VALUES (%s, %s, %s, %s)
        """, (body.lat, body.lng, now, cliente_id))

        conn.commit()
        cur2.close()
        cur.close()
        conn.close()

        return {
            "ok": True,
            "distance_m": round(dist_m, 2),
            "allowed_radius_m": round(raio_m, 2),
            "inside": inside,
            "origem_geo": origem_geo
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================
# MAIN
# =====================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8010, reload=True)


@app.post("/api/cliente/localizacao")
def atualizar_localizacao(data: ClienteLocalizacaoBody):
    conn = None

    try:
        cliente_id = data.cliente_id
        latitude = float(data.latitude)
        longitude = float(data.longitude)

        if cliente_id <= 0:
            raise HTTPException(status_code=400, detail="cliente_id inválido.")

        if not (-90 <= latitude <= 90):
            raise HTTPException(status_code=400, detail="Latitude fora do intervalo válido.")

        if not (-180 <= longitude <= 180):
            raise HTTPException(status_code=400, detail="Longitude fora do intervalo válido.")

        conn = get_conn()

        # 1) Atualiza localização atual do cliente
        cur = conn.cursor()
        cur.execute("""
            UPDATE cliente
            SET latitude_atual = %s,
                longitude_atual = %s,
                ultima_atualizacao = NOW()
            WHERE idCliente = %s
        """, (latitude, longitude, cliente_id))

        if cur.rowcount == 0:
            cur.close()
            conn.rollback()
            conn.close()
            raise HTTPException(status_code=404, detail="Cliente não encontrado.")

        cur.close()

        # 2) Mantém posicao_gps sincronizada (1 registro por cliente)
        cur_check = conn.cursor(dictionary=True)
        cur_check.execute("""
            SELECT idPosicaoGPS
            FROM posicao_gps
            WHERE cliente_idCliente = %s
            LIMIT 1
        """, (cliente_id,))
        gps_row = cur_check.fetchone()
        cur_check.close()

        if gps_row:
            cur_gps = conn.cursor()
            cur_gps.execute("""
                UPDATE posicao_gps
                SET latitude = %s,
                    longitude = %s,
                    data_ultima_atualizacao = NOW()
                WHERE cliente_idCliente = %s
            """, (latitude, longitude, cliente_id))
            cur_gps.close()
        else:
            cur_gps = conn.cursor()
            cur_gps.execute("""
                INSERT INTO posicao_gps
                    (latitude, longitude, data_ultima_atualizacao, cliente_idCliente)
                VALUES
                    (%s, %s, NOW(), %s)
            """, (latitude, longitude, cliente_id))
            cur_gps.close()

        conn.commit()
        conn.close()

        return {
            "ok": True,
            "cliente_id": cliente_id,
            "latitude": latitude,
            "longitude": longitude,
            "mensagem": "Localização atualizada com sucesso."
        }

    except HTTPException:
        if conn:
            try:
                conn.rollback()
            except:
                pass
            try:
                conn.close()
            except:
                pass
        raise

    except Exception as e:
        if conn:
            try:
                conn.rollback()
            except:
                pass
            try:
                conn.close()
            except:
                pass
        raise HTTPException(status_code=500, detail=str(e))
    
import math

def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c