// /static/js/app_estab_notifications.js
(() => {
  if (window.__estabNotificationsStarted) return;
  window.__estabNotificationsStarted = true;

  const API_BASE = window.location.origin;
  const wsMap = new Map();
  let refreshTimer = null;
  let reconnectTimer = null;
  let lastKey = "";
  const seenEvents = new Map();

  function getEstabId() {
    const v = localStorage.getItem("estabelecimento_id");
    const id = Number(v || 0);
    return id > 0 ? id : 0;
  }

  function wsUrlForFila(filaId) {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${location.host}/ws/fila/${filaId}`;
  }

  async function getJSON(path) {
    const res = await fetch(API_BASE + path, { cache: "no-store" });
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data?.detail || `Erro HTTP ${res.status}`);
    return data;
  }

  function stopAllWS() {
    for (const ws of wsMap.values()) {
      try {
        ws.close();
      } catch {}
    }
    wsMap.clear();
    lastKey = "";
  }

  function makeEventKey(msg) {
    const a = String(msg?.action || "").toUpperCase();
    const p = msg?.payload || {};

    return [
      a,
      p.fila_cliente_id || "",
      p.cliente_id || "",
      p.nome || p.cliente_nome || "",
      p.fila_id || "",
      p.fila_nome || p.filaNome || ""
    ].join("|");
  }

  function alreadySeen(msg) {
    const key = makeEventKey(msg);
    const now = Date.now();

    for (const [k, exp] of seenEvents.entries()) {
      if (exp <= now) seenEvents.delete(k);
    }

    if (seenEvents.has(key)) return true;

    seenEvents.set(key, now + 4000);
    return false;
  }

  function showEventToast(msg) {
    const a = String(msg?.action || "").toUpperCase();
    const p = msg?.payload || {};
    const nome = p.nome || p.cliente_nome || "Cliente";
    const filaNome = p.fila_nome || p.filaNome || "Fila";

    if (a === "CLIENTE_ENTROU") {
      window.showToastTop?.(
        "success",
        `<b>${nome}</b> entrou na fila: <b>${filaNome}</b>.`,
        3000
      );
      return;
    }

    if (a === "CLIENTE_SAIU") {
      window.showToastTop?.(
        "danger",
        `<b>${nome}</b> saiu da fila: <b>${filaNome}</b>.`,
        3000
      );
    }
  }

  function handleMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg?.type !== "fila_update") return;

    const action = String(msg.action || "").toUpperCase();
    if (action !== "CLIENTE_ENTROU" && action !== "CLIENTE_SAIU") return;

    if (alreadySeen(msg)) return;
    showEventToast(msg);
  }

  function connectFila(filaId) {
    if (!filaId || wsMap.has(filaId)) return;

    const ws = new WebSocket(wsUrlForFila(filaId));
    wsMap.set(filaId, ws);

    ws.onmessage = (e) => handleMessage(e.data);

    ws.onclose = () => {
      wsMap.delete(filaId);
      scheduleReconnect();
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {}
    };
  }

  function syncWS(filaIds) {
    const key = filaIds.slice().sort((a, b) => a - b).join(",");
    if (key === lastKey) return;
    lastKey = key;

    for (const [id, ws] of wsMap.entries()) {
      if (!filaIds.includes(id)) {
        try {
          ws.close();
        } catch {}
        wsMap.delete(id);
      }
    }

    for (const id of filaIds) {
      connectFila(id);
    }
  }

  async function refreshConnections() {
    const estabId = getEstabId();
    if (!estabId) {
      stopAllWS();
      return;
    }

    const filas = await getJSON(`/api/filas?estabelecimento_id=${estabId}`);
    const abertas = (Array.isArray(filas) ? filas : [])
      .filter((f) => String(f.status || "").toUpperCase() === "ABERTA")
      .map((f) => Number(f.idFila || f.id || 0))
      .filter((id) => id > 0);

    if (!abertas.length) {
      stopAllWS();
      return;
    }

    syncWS(abertas);
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      refreshConnections().catch(() => {});
    }, 2500);
  }

  function start() {
    refreshConnections().catch(() => {});
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      refreshConnections().catch(() => {});
    }, 10000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  window.addEventListener("beforeunload", () => {
    clearInterval(refreshTimer);
    clearTimeout(reconnectTimer);
    stopAllWS();
  });
})();