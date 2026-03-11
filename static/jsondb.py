import json
import os
import threading
from datetime import datetime, timezone

_DB_LOCK = threading.Lock()

def _now_iso() -> str:
    # ISO 8601 em UTC (com 'Z')
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

def _db_path() -> str:
    # Permite sobrescrever via env, mas padrão é no mesmo diretório do main.py
    return os.getenv("JSON_DB_FILE", "dados.json")

def _default_db():
    return {
        "filas": {},              # {fila_id: fila_dict}
        "fila_clientes": {},      # {fila_id: [cliente_dict, ...]}
        "fila_estado": {},        # {fila_id: {"atendendo_cliente_id": int|None}}
        "next_cliente_id": 1
    }

def load_db():
    path = _db_path()
    with _DB_LOCK:
        if not os.path.exists(path):
            db = _default_db()
            save_db(db)
            return db
        try:
            with open(path, "r", encoding="utf-8") as f:
                db = json.load(f)
        except Exception:
            db = _default_db()
            save_db(db)
            return db

        # migra campos faltando
        base = _default_db()
        for k,v in base.items():
            if k not in db:
                db[k] = v
        return db

def save_db(db):
    path = _db_path()
    with _DB_LOCK:
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(db, f, ensure_ascii=False, indent=2)
        os.replace(tmp, path)

def next_cliente_id(db) -> int:
    cid = int(db.get("next_cliente_id", 1))
    db["next_cliente_id"] = cid + 1
    return cid

def ensure_fila_structs(db, fila_id: str):
    db["fila_clientes"].setdefault(fila_id, [])
    db["fila_estado"].setdefault(fila_id, {"atendendo_cliente_id": None})

def new_fila_dict(body: dict) -> dict:
    now = _now_iso()
    return {
        "id": body["id"],
        "nome": body["nome"],
        "endereco": body["endereco"],
        "raio_m": int(body.get("raio_m", 500)),
        "tempo_medio_min": int(body.get("tempo_medio_min", 15)),
        "capacidade_max": body.get("capacidade_max", None),
        "ativa": bool(body.get("ativa", True)),
        "msg_boas_vindas": body.get("msg_boas_vindas", None),
        "horario_func": body.get("horario_func", None),
        "observacoes": body.get("observacoes", None),
        "created_at": now,
        "updated_at": now,
    }

def new_cliente_dict(db, fila_id: str, nome: str, senha_num: int) -> dict:
    cid = next_cliente_id(db)
    now = _now_iso()
    return {
        "id": cid,
        "fila_id": fila_id,
        "nome": nome,
        "senha_num": int(senha_num),
        "senha_codigo": str(senha_num).zfill(3),
        "status": "aguardando",
        "entrou_em": now,
        "chamado_em": None,
        "finalizado_em": None,
        "cancelado_em": None,
    }
