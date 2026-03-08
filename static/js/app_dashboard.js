// ================= NAVEGAÇÃO =================
function go(url){ window.location.href = url; }

// Sidebar mobile
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
menuBtn?.addEventListener("click", () => sidebar?.classList.toggle("open"));

// ================= CONFIG =================
const API_BASE = window.location.origin;

function getEstabId(){
  const v = localStorage.getItem("estabelecimento_id");
  const id = Number(v || 0);
  return id > 0 ? id : 0;
}

// ================= ESTABELECIMENTO (nome dinâmico) =================
(function syncNomeEstab(){
  const ja = localStorage.getItem("nomeEstabelecimento");
  if (ja && ja.trim()) return;

  const n =
    localStorage.getItem("estabelecimento_nome") ||
    localStorage.getItem("nome_estabelecimento") ||
    localStorage.getItem("estab_nome");

  if (n && n.trim()) localStorage.setItem("nomeEstabelecimento", n.trim());
})();

function renderTopoNomeEstab(nome){
  const finalNome =
    (nome ||
      localStorage.getItem("nomeEstabelecimento") ||
      localStorage.getItem("estabelecimento_nome") ||
      "—"
    ).trim();

  const el = document.getElementById("nomeEstabelecimento");
  const header = document.getElementById("estabHeader");

  if (el) el.textContent = finalNome;
  if (header) header.title = `Estabelecimento: ${finalNome}`;
}

// ================= UI (SEU HTML) =================
const elFila = document.getElementById("fila");
const elTempoMedio = document.getElementById("tempoMedioDash");
const elEmAtendimento = document.getElementById("emAtendimentoDash");

// NOVOS CARDS
const elCancelados = document.getElementById("canceladosDash");
const elConcluidos = document.getElementById("concluidosDash");

const elProximoNome = document.getElementById("proximoNome");
const btnChamar = document.getElementById("btnChamar");

// ================= API =================
async function getJSON(path){
  const res = await fetch(API_BASE + path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || `Erro HTTP ${res.status}`);
  return data;
}

async function postJSON(path, body){
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(body || {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || `Erro HTTP ${res.status}`);
  return data;
}

// ================= WEBSOCKET (filas abertas) =================
const wsMap = new Map();
let lastKey = "";

function wsUrlForFila(filaId){
  const proto = (location.protocol === "https:") ? "wss" : "ws";
  return `${proto}://${location.host}/ws/fila/${filaId}`;
}

function stopAllWS(){
  for (const ws of wsMap.values()){
    try { ws.close(); } catch {}
  }
  wsMap.clear();
  lastKey = "";
}

function syncWS(filaIds){
  const key = filaIds.slice().sort((a,b)=>a-b).join(",");
  if (key === lastKey) return;
  lastKey = key;

  for (const [id, ws] of wsMap.entries()){
    if (!filaIds.includes(id)){
      try { ws.close(); } catch {}
      wsMap.delete(id);
    }
  }

  for (const id of filaIds){
    if (wsMap.has(id)) continue;

    const ws = new WebSocket(wsUrlForFila(id));
    wsMap.set(id, ws);

    ws.onmessage = (e) => {
      try{
        const msg = JSON.parse(e.data);
        if (msg?.type !== "fila_update") return;

        // mantém atualização
        atualizarDashboard(false).catch(()=>{});

        // ✅ TOASTS APENAS: cliente entrou / saiu
        const a = String(msg.action || "").toUpperCase();
        const p = msg.payload || {};

        if (a === "CLIENTE_ENTROU"){
          const nome = p.nome || "Cliente";
          const filaNome = p.fila_nome || p.filaNome || "Fila";
          window.showToastTop?.(
            "success",
            `<b>${nome}</b> entrou na fila: <b>${filaNome}</b>.`
          );
        } else if (a === "CLIENTE_SAIU"){
          const nome = p.nome || "Cliente";
          const filaNome = p.fila_nome || p.filaNome || "Fila";
          window.showToastTop?.(
            "danger",
            `<b>${nome}</b> saiu da fila: <b>${filaNome}</b>.`
          );
        }

      } catch {}
    };

    ws.onclose = () => setTimeout(() => atualizarDashboard(true).catch(()=>{}), 2500);
  }
}

// ================= RENDER =================
function renderResumo(data){
  // ✅ topo nome
  const nomeLocal = localStorage.getItem("estabelecimento_nome");
  const nomeApi = data?.estabelecimento?.nome;
  const nome = (nomeApi || nomeLocal || "—");

  if (nomeApi && String(nomeApi).trim()){
    localStorage.setItem("estabelecimento_nome", String(nomeApi).trim());
    localStorage.setItem("nomeEstabelecimento", String(nomeApi).trim());
  }
  renderTopoNomeEstab(nome);

  // ✅ totais (todas as filas do estabelecimento)
  const totais = data?.totais || {};

  if (elFila) elFila.textContent = String(totais.na_fila ?? 0);

  const tm = totais.tempo_medio_min;
  if (elTempoMedio) {
    elTempoMedio.textContent =
      (tm === null || tm === undefined) ? "-- min" : `${Math.round(Number(tm))} min`;
  }

  if (elEmAtendimento) elEmAtendimento.textContent = String(totais.em_atendimento ?? totais.atendendo ?? 0);

  if (elCancelados) elCancelados.textContent = String(totais.cancelados ?? 0);
  if (elConcluidos) elConcluidos.textContent = String(totais.concluidos ?? 0);

  // ✅ próximo global do estabelecimento
  const prox = data?.proximo || null;
  if (!prox){
    if (elProximoNome) elProximoNome.textContent = "—";
    if (btnChamar) btnChamar.disabled = true;
    return;
  }

  if (elProximoNome) elProximoNome.textContent = prox.nome || "Cliente";
  if (btnChamar) btnChamar.disabled = false;
}

// ================= UPDATE =================
async function atualizarDashboard(syncSockets = true){
  const estabId = getEstabId();
  if (!estabId){
    alert("Sessão não encontrada. Faça login novamente.");
    window.location.href = "/templates/LoginCnpj.html";
    return;
  }

  const data = await getJSON(`/api/dashboard/resumo?estabelecimento_id=${estabId}`);
  renderResumo(data);

  if (syncSockets){
    const filas = await getJSON(`/api/filas?estabelecimento_id=${estabId}`);
    const abertas = (Array.isArray(filas) ? filas : [])
      .filter(f => String(f.status || "").toUpperCase() === "ABERTA")
      .map(f => Number(f.idFila || f.id || 0))
      .filter(id => id > 0);

    if (abertas.length) syncWS(abertas);
    else stopAllWS();
  }
}

// ================= AÇÃO CHAMAR =================
btnChamar?.addEventListener("click", async () => {
  try {
    const estabId = getEstabId();
    if (!estabId) return;

    const resp = await postJSON(`/api/dashboard/chamar-proximo`, { estabelecimento_id: estabId });

    await atualizarDashboard(false);

    const nome = resp?.chamado?.nome;
    alert(nome ? ("Chamando: " + nome) : "Chamando próximo!");
  } catch (e) {
    alert(e.message || "Erro ao chamar próximo.");
  }
});

// ================= INIT =================
(async () => {
  try {
    renderTopoNomeEstab(localStorage.getItem("estabelecimento_nome") || "");
    await atualizarDashboard(true);
    setInterval(() => atualizarDashboard(false).catch(()=>{}), 5000);
  } catch (e) {
    console.log("Dashboard init erro:", e);
  }
})();