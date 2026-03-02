// ================= CONFIG =================
const API_BASE = window.location.origin;

// ================= HELPERS =================
function getParam(name){
  return new URLSearchParams(location.search).get(name);
}

function obterNomeClienteAtual(){
  // 1) tentativas diretas (mais comuns)
  const directKeys = ["CLIENTE_NOME", "cliente_nome", "nomeCliente", "nome_cliente"];
  for (const k of directKeys){
    const v = localStorage.getItem(k);
    if (v && v.trim()) return v.trim();
  }

  // 2) tenta achar dentro da fila (se tiver filaId)
  const filaId = getParam("filaId");
  if (!filaId) return null;

  // algum ID do cliente (se você já salva)
  const clienteId =
    localStorage.getItem("CLIENTE_ID") ||
    localStorage.getItem(`CLIENTE_ID_${filaId}`) ||
    getParam("clienteId");

  try {
    const lista = JSON.parse(localStorage.getItem(`clientesFila_${filaId}`) || "[]");
    if (clienteId){
      const achou = lista.find(c => String(c.id) === String(clienteId));
      if (achou?.nome) return String(achou.nome).trim();
    }

    // fallback: se não tiver ID, tenta o último nome salvo em CLIENTE_NOME mesmo
    // (ou o primeiro cliente da lista, se fizer sentido no seu fluxo)
    // const first = lista[0];
    // if (first?.nome) return String(first.nome).trim();
  } catch {}

  return null;
}

function preencherNomeClienteNoTopo(){
  const el = document.getElementById("clienteNomeHeader");
  if (!el) return;

  const nome = obterNomeClienteAtual();
  el.textContent = nome || "—";
}

document.addEventListener("DOMContentLoaded", preencherNomeClienteNoTopo);

// opcional: se o nome mudar em outra aba/tela (editar nome), atualiza sozinho
window.addEventListener("storage", (e) => {
  if (["CLIENTE_NOME", "cliente_nome", "nomeCliente", "nome_cliente"].includes(e.key)){
    preencherNomeClienteNoTopo();
  }
});

function fmt2(n){ return String(n).padStart(2,"0"); }
function horaAgora(){
  const d = new Date();
  return `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}:${fmt2(d.getSeconds())}`;
}
function pad3(n){ return String(n).padStart(3,"0"); }

function showToast(msg){
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"), 1400);
}

function getFilaId(){
  return new URLSearchParams(location.search).get("filaId");
}

function getClienteNome(filaId){
  let nome = localStorage.getItem("CLIENTE_NOME");
  if (!nome && filaId) nome = localStorage.getItem(`cliente_nome_${filaId}`);
  if (nome && filaId) localStorage.setItem(`cliente_nome_${filaId}`, nome);
  return (nome || "").trim();
}

function haversineMeters(lat1, lon1, lat2, lon2){
  const R = 6371000;
  const toRad = (x) => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function formatDist(m){
  if (!isFinite(m)) return "--";
  if (m < 1000) return `${m.toFixed(0)} m`;
  return `${(m/1000).toFixed(2)} km`;
}

async function fetchFilaInfo(filaId){
  const res = await fetch(`${API_BASE}/api/fila/${filaId}/info`);
  if (!res.ok) throw new Error("Falha ao buscar info da fila");
  return res.json();
}

// ================= ELEMENTOS =================
const elPos = document.getElementById("posicao");
const elFrente = document.getElementById("aFrente");
const elTempoMedio = document.getElementById("tempoMedio");
const elEstimativa = document.getElementById("estimativa");

const elDist = document.getElementById("distancia");
const elCoordsStatus = document.getElementById("coordsStatus");
const elPillRaio = document.getElementById("pillRaio");

const elFilaNome = document.getElementById("filaNome");
const elFilaRaio = document.getElementById("filaRaio");
const elUlt = document.getElementById("ultimaAtualizacao");

const btnGeo = document.getElementById("btnGeo");
const btnAtualizar = document.getElementById("btnAtualizar");
const btnSair = document.getElementById("btnSair");

// ================= Estado =================
const filaId = getFilaId();
if (!filaId){
  alert("Link inválido: falta filaId. Acesse pela leitura do QR Code.");
  window.location.replace(`${window.location.origin}/templates/saiu.html`);
  throw new Error("Sem filaId");
}

const SESSION_KEY = `cliente_session_${filaId}`;
let clienteId = Number(localStorage.getItem(SESSION_KEY) || 0);
let filaClienteIdAtual = Number(localStorage.getItem(`fila_cliente_id_${filaId}`) || 0);

let atendimentoEncerrado = false;
let filaInfoCache = null;

// "finalizado" | "cancelado" | null
let encerramentoModo = null;

// usado pra decidir no fallback
let ultimoStatusConhecido = null; // aguardando | chamado | em_atendimento

// ================= MODAL PADRONIZADO =================
function ensureEndModal() {
  if (!document.getElementById("endModalStyle")) {
    const style = document.createElement("style");
    style.id = "endModalStyle";
    style.innerHTML = `
      body.lock{overflow:hidden}
      .final-modal{position:fixed; inset:0; display:none; z-index:99999; align-items:center; justify-content:center; padding:16px;}
      .final-modal.show{display:flex}
      .final-overlay{position:absolute; inset:0; background:rgba(0,0,0,.75); backdrop-filter: blur(6px);}
      .final-card{position:relative; z-index:2; width:min(560px, 92vw); border-radius:18px; border:1px solid rgba(255,122,0,.25);
        background:linear-gradient(180deg, rgba(255,122,0,.14), rgba(0,0,0,.30)); box-shadow:0 30px 90px rgba(0,0,0,.85);
        padding:28px 26px; text-align:center; color:#fff; animation:pop .22s ease;}
      @keyframes pop{from{opacity:0; transform:scale(.95)} to{opacity:1; transform:scale(1)}}
      .final-title{font-weight:900; font-size:26px; margin:0 0 10px;}
      .final-sub{opacity:.9; margin:0 0 16px; font-size:14px; line-height:1.45}
      .final-pill{display:inline-flex; align-items:center; gap:10px; padding:10px 14px; border-radius:999px; border:1px solid rgba(255,255,255,.12);
        background:rgba(0,0,0,.18); font-weight:800; margin:10px 0 18px;}
      .final-actions{display:flex; justify-content:center; gap:12px; flex-wrap:wrap}
      .final-btn{border-radius:14px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.06); color:#fff; padding:12px 16px;
        font-weight:900; cursor:pointer; min-width:220px;}
      .final-btn.primary{background:#ff7a00; color:#0b0c0e; border-color:rgba(255,122,0,.55); box-shadow:0 14px 30px rgba(255,122,0,.18);}
    `;
    document.head.appendChild(style);
  }

  let modal = document.getElementById("finalModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "finalModal";
    modal.className = "final-modal";
    document.body.appendChild(modal);
  }

  modal.className = "final-modal";
  modal.innerHTML = `
    <div class="final-overlay"></div>
    <div class="final-card" role="dialog" aria-modal="true" aria-label="Encerramento">
      <div class="final-title" id="finalTitle">Aviso</div>
      <p class="final-sub" id="finalSub">—</p>
      <div class="final-pill" id="finalPill">—</div>
      <div class="final-actions">
        <button class="final-btn primary" id="finalBtnSair" type="button">SAIR</button>
      </div>
    </div>
  `;

  modal.style.display = "";

  // ✅ SÓ sai quando clicar no botão SAIR
  const btn = document.getElementById("finalBtnSair");
  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    forceExitToSaiu();
  };

  // ✅ NÃO sai clicando no overlay (evita sair sozinho no mobile)
  const overlay = modal.querySelector(".final-overlay");
  overlay.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
}

function showEncerradoModal({ mode="finalizado", nome="" } = {}){
  ensureEndModal();

  const modal = document.getElementById("finalModal");
  const title = document.getElementById("finalTitle");
  const sub = document.getElementById("finalSub");
  const pill = document.getElementById("finalPill");

  const clienteNome = nome || getClienteNome(filaId) || "Cliente";

  if (mode === "cancelado") {
    title.textContent = "Atendimento cancelado!";
    sub.innerHTML =
      `Você foi removido da fila.<br><br>` +
      `Clique em <b>SAIR</b> para voltar.`;
    pill.textContent = `Cliente: ${clienteNome}`;
  } else {
    title.textContent = "Atendimento concluído!";
    sub.innerHTML =
      `Seu atendimento foi concluído com sucesso.<br><br>` +
      `Clique em <b>SAIR</b> para finalizar.`;
    pill.textContent = `Cliente: ${clienteNome}`;
  }

  document.body.classList.add("lock");
  modal.classList.add("show");
}

function encerrarETravar(mode, nome){
  if (atendimentoEncerrado) return;

  atendimentoEncerrado = true;
  encerramentoModo = mode;

  showEncerradoModal({ mode, nome });

  // para tudo e evita loop
  try { ws?.close(); } catch {}
  ws = null;

  clearInterval(wsPingTimer);
  clearTimeout(wsRetryTimer);
  clearInterval(fallbackTimer);

  // ✅ NÃO redireciona sozinho.
  // Só sai quando clicar no botão SAIR.
}

function forceExitToSaiu(){
  const target = `${window.location.origin}/templates/saiu.html`;

  atendimentoEncerrado = true;
  document.body.classList.remove("lock");

  try { ws?.close(); } catch {}
  ws = null;

  clearInterval(wsPingTimer);
  clearTimeout(wsRetryTimer);
  clearInterval(fallbackTimer);

  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem("CLIENTE_NOME");
    localStorage.removeItem(`cliente_nome_${filaId}`);
    localStorage.removeItem(`fila_cliente_id_${filaId}`);
  } catch {}

  window.location.replace(target);
  setTimeout(() => window.location.replace(target), 250);
}

// ================= Render =================
function renderStatus(payload){
  const stRaw = payload?.cliente?.status ?? payload?.status ?? "aguardando";
  const st = String(stRaw).toLowerCase();

  ultimoStatusConhecido = st;

  const aFrente = Number(payload.a_frente ?? 0);
  const pos = Number(payload.posicao ?? (aFrente + 1));

  if (st === "em_atendimento" || st === "em atendimento") {
    if (elPos){
      elPos.textContent = "Em atendimento";
      elPos.classList.add("em-atendimento");
    }
    if (elFrente){
      elFrente.textContent = "Você está sendo atendido agora";
      elFrente.classList.add("em-atendimento");
    }
  } else {
    if (elPos){
      elPos.textContent = `#${pad3(pos)}`;
      elPos.classList.remove("em-atendimento");
    }
    if (elFrente){
      elFrente.textContent = `${aFrente} pessoas à frente`;
      elFrente.classList.remove("em-atendimento");
    }
  }

  const tempoMedioMin = Number(payload.tempo_medio_min ?? 12);
  if (elTempoMedio) elTempoMedio.textContent = `${tempoMedioMin} min`;

  const estimativa = Number(payload.estimativa_min ?? (aFrente * tempoMedioMin));
  if (elEstimativa) elEstimativa.textContent = `~${estimativa} min`;

  if (elFilaNome) elFilaNome.textContent = payload.fila_nome || "Fila";
  if (elUlt) elUlt.textContent = horaAgora();
  if (payload.fila_raio_m && elFilaRaio) elFilaRaio.textContent = `${payload.fila_raio_m}m`;
}

async function atualizarStatus({ silent=false } = {}) {
  if (!filaId || !clienteId) return;
  if (atendimentoEncerrado) return;

  const res = await fetch(`${API_BASE}/api/filas/${filaId}/cliente/${clienteId}/status`);

  if (!res.ok){
    if (res.status === 404){
      const modo = encerramentoModo || (ultimoStatusConhecido === "em_atendimento" ? "finalizado" : "cancelado");
      encerrarETravar(modo, getClienteNome(filaId));
      return;
    }
    if (!silent) showToast("Erro ao atualizar");
    return;
  }

  const data = await res.json();

  const fcId = Number(data?.cliente?.fila_cliente_id || 0);
  if (fcId) {
    filaClienteIdAtual = fcId;
    localStorage.setItem(`fila_cliente_id_${filaId}`, String(fcId));
  }

  renderStatus(data);
  if (!silent) showToast("Atualizado!");
}

async function entrarNaFila(){
  if (!filaId) return;

  if (clienteId){
    await atualizarStatus({ silent:true });
    return;
  }

  const nome = getClienteNome(filaId);

  if (!nome){
    const url = new URL("/templates/login.html", window.location.origin);
    url.searchParams.set("next", "Fila_cliente.html");
    url.searchParams.set("filaId", String(filaId));
    window.location.replace(url.toString());
    return;
  }

  const res = await fetch(`${API_BASE}/api/fila/${filaId}/entrar`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ nome })
  });

  if (!res.ok){
    const err = await res.json().catch(()=>({detail:"Erro"}));
    alert(err.detail || "Erro ao entrar na fila");
    return;
  }

  const data = await res.json();

  clienteId = Number(data.cliente_id || 0);
  if (clienteId) localStorage.setItem(SESSION_KEY, String(clienteId));

  const fcId = Number(data.fila_cliente_id || 0);
  if (fcId) {
    filaClienteIdAtual = fcId;
    localStorage.setItem(`fila_cliente_id_${filaId}`, String(fcId));
  }

  showToast(`Sua senha: ${data.senha_codigo || "OK"}`);
  await atualizarStatus({ silent:true });
}

// ================= GEO =================
function setRaioStatus(ok){
  if (!elPillRaio) return;
  elPillRaio.classList.toggle("ok", ok);
  elPillRaio.classList.toggle("bad", !ok);
  elPillRaio.innerHTML = ok
    ? `<i class="bi bi-check2-circle"></i><span>Dentro do raio</span>`
    : `<i class="bi bi-x-circle"></i><span>Fora do raio</span>`;
}

async function atualizarLocalizacao(){
  if (atendimentoEncerrado) return;

  if (!navigator.geolocation){
    if (elCoordsStatus){
      elCoordsStatus.textContent = "Indisponível";
      elCoordsStatus.classList.add("danger");
    }
    showToast("Geolocalização indisponível.");
    return;
  }

  try {
    if (!filaInfoCache) {
      const info = await fetchFilaInfo(filaId);
      if (!info?.ok) throw new Error(info?.error || "Info inválida");
      filaInfoCache = info;

      if (elFilaNome) elFilaNome.textContent = info.fila?.nome || "Fila";
      const raio = info.estabelecimento?.raio_m;
      if (raio && elFilaRaio) elFilaRaio.textContent = `${raio}m`;
    }
  } catch (e) {
    console.log(e);
    showToast("Erro ao carregar dados da fila");
    return;
  }

  const estab = filaInfoCache.estabelecimento;
  const estabLat = Number(estab?.lat);
  const estabLng = Number(estab?.lng);
  const raioM = Number(estab?.raio_m);

  if (!isFinite(estabLat) || !isFinite(estabLng) || !isFinite(raioM)){
    showToast("Estabelecimento sem GPS/raio configurados");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const acc = pos.coords.accuracy;

      if (elCoordsStatus){
        elCoordsStatus.textContent = `Ativa (±${acc.toFixed(0)}m)`;
        elCoordsStatus.classList.remove("danger");
      }

      const distM = haversineMeters(lat, lng, estabLat, estabLng);
      if (elDist) elDist.textContent = formatDist(distM);

      const dentro = distM <= raioM;
      setRaioStatus(dentro);

      if (elUlt) elUlt.textContent = horaAgora();
      showToast("Localização atualizada!");
    },
    (err) => {
      if (elCoordsStatus){
        elCoordsStatus.textContent = "Permissão negada";
        elCoordsStatus.classList.add("danger");
      }
      setRaioStatus(false);
      showToast("Permissão de localização negada.");
      console.log(err);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// ================= SAIR (manual) =================
function sairDaFila(evt){
  if (evt){
    evt.preventDefault();
    evt.stopPropagation();
    if (evt.stopImmediatePropagation) evt.stopImmediatePropagation();
  }
  const ok = confirm("Tem certeza que deseja sair da fila?");
  if (!ok) return;
  forceExitToSaiu();
}

// ================= LISTENERS =================
btnGeo?.addEventListener("click", atualizarLocalizacao);
btnAtualizar?.addEventListener("click", () => atualizarStatus({ silent:false }));

btnSair?.addEventListener("touchend", sairDaFila, { capture: true });
btnSair?.addEventListener("click", sairDaFila, { capture: true });

// ================= WEBSOCKET (TEMPO REAL) =================
let ws = null;
let wsPingTimer = null;
let wsRetryTimer = null;
let fallbackTimer = null;

function wsUrlForFila(filaId) {
  const proto = (location.protocol === "https:") ? "wss" : "ws";
  return `${proto}://${location.host}/ws/fila/${filaId}`;
}

function eventoEhMeu(p = {}) {
  const payloadClienteId = Number(p.cliente_id || 0);
  const payloadFilaClienteId = Number(p.fila_cliente_id || 0);

  if (payloadClienteId && clienteId && payloadClienteId === Number(clienteId)) return true;
  if (payloadFilaClienteId && filaClienteIdAtual && payloadFilaClienteId === Number(filaClienteIdAtual)) return true;

  return false;
}

function startWebSocket() {
  if (!filaId) return;
  if (atendimentoEncerrado) return;

  try { ws?.close(); } catch {}
  ws = null;

  ws = new WebSocket(wsUrlForFila(filaId));

  ws.onopen = () => {
    clearInterval(wsPingTimer);
    wsPingTimer = setInterval(() => {
      try {
        if (ws?.readyState === WebSocket.OPEN) ws.send("ping");
      } catch {}
    }, 25000);
  };

  ws.onmessage = (e) => {
    if (atendimentoEncerrado) return;

    try {
      const msg = JSON.parse(e.data);
      if (msg.type !== "fila_update") return;

      const action = (msg.action || "").toString().toUpperCase();
      const p = msg.payload || {};
      const ehMeu = eventoEhMeu(p);

      if ((action === "ATENDIMENTO_FINALIZADO" || action === "FINALIZOU") && ehMeu) {
        encerramentoModo = "finalizado";
        encerrarETravar("finalizado", p.nome || getClienteNome(filaId));
        return;
      }

      if ((action === "ATENDIMENTO_CANCELADO" || action === "CANCELOU") && ehMeu) {
        encerramentoModo = "cancelado";
        encerrarETravar("cancelado", p.nome || getClienteNome(filaId));
        return;
      }

      // atualização normal
      atualizarStatus({ silent:true }).catch(()=>{});
    } catch {
      // ignore
    }
  };

  ws.onclose = () => {
    clearInterval(wsPingTimer);
    if (atendimentoEncerrado) return;
    clearTimeout(wsRetryTimer);
    wsRetryTimer = setTimeout(startWebSocket, 2500);
  };
}

// ================= INIT (ORDEM CORRETA) =================
(async () => {
  try {
    ensureEndModal();

    // ✅ primeiro: garante clienteId / filaClienteIdAtual
    await entrarNaFila();

    // ✅ agora sim: WS (vai reconhecer evento como “meu”)
    startWebSocket();

    // ✅ status inicial
    await atualizarStatus({ silent:true });

    await atualizarLocalizacao();

    // ✅ fallback polling sempre
    fallbackTimer = setInterval(() => {
      if (atendimentoEncerrado) return;
      atualizarStatus({ silent:true }).catch(()=>{});
    }, 5000);

  } catch (e) {
    console.log("Init erro:", e);
  }
})();