# mysql_db.py
import os
import mysql.connector
from mysql.connector import pooling

_pool = None

def get_pool():
    global _pool
    if _pool is None:
        _pool = pooling.MySQLConnectionPool(
            pool_name="andalogo_pool",
            pool_size=5,
            host=os.getenv("MYSQL_HOST", "localhost"),
            port=int(os.getenv("MYSQL_PORT", "3306")),
            user=os.getenv("MYSQL_USER", "root"),
            password=os.getenv("MYSQL_PASSWORD", "root"),
            database=os.getenv("MYSQL_DB", "fila_digital"),
        )
    return _pool

def get_conn():
    return get_pool().get_connection()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
import mysql.connector

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_conn():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="root",
        database="fila_digital",   # <-- seu schema
    )

class EstabelecimentoCreate(BaseModel):
    nome: str
    cidade: str | None = None
    cnpj: str | None = None
    categoria: str | None = None  # ou Enum
    estado: str | None = None
    telefone: str | None = None
    email: EmailStr
    senha: str
    latitude: float | None = None
    longitude: float | None = None
    raio_alerta: int | None = None

@app.post("/api/estabelecimentos")
def criar_estabelecimento(body: EstabelecimentoCreate):
    try:
        conn = get_conn()
        cur = conn.cursor()

        sql = """
        INSERT INTO estabelecimento
        (nome, cidade, cnpj, categoria, estado, telefone, email, senha, latitude, longitude, raio_alerta)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """
        cur.execute(sql, (
            body.nome,
            body.cidade,
            body.cnpj,
            body.categoria,
            body.estado,
            body.telefone,
            body.email,
            body.senha,
            body.latitude,
            body.longitude,
            body.raio_alerta,
        ))
        conn.commit()
        new_id = cur.lastrowid

        cur.close()
        conn.close()
        return {"ok": True, "idEstabelecimento": new_id}

    except mysql.connector.Error as e:
        raise HTTPException(status_code=400, detail=str(e))