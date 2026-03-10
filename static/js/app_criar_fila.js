/* =========================================================
   app_criar_fila.js — COMPLETO (SEM ENDEREÇO)
   ✅ Tooltip flutuante no slider (valor acompanha bolinha)
   ✅ Fill do slider
   ✅ Criar fila sem endereço
   ✅ Erros do FastAPI (422/400) aparecem direito
========================================================= */

console.log("[CRIAR FILA] app_criar_fila.js carregou");

// ===============================
// ESTABELECIMENTO (nome dinâmico)
// ===============================
function obterNomeEstabelecimento() {
  const direct =
    localStorage.getItem("nomeEstabelecimento") ||
    localStorage.getItem("estabelecimento_nome") ||
    localStorage.getItem("nome_estabelecimento") ||
    localStorage.getItem("estab_nome");

  if (direct && direct.trim()) return direct.trim();

  const possibleJsonKeys = ["estabelecimento", "biz", "usuarioEstab"];
  for (const k of possibleJsonKeys) {
    const raw = localStorage.getItem(k);
    if (!raw) continue;
    try {
      const obj = JSON.parse(raw);
      const name = obj?.nome || obj?.nomeEstabelecimento || obj?.estabelecimento_nome;
      if (name && String(name).trim()) return String(name).trim();
    } catch {}
  }
  return null;
}

function preencherNomeNoTopo() {
  const nome = obterNomeEstabelecimento();
  const el = document.getElementById("nomeEstabelecimento");
  const header = document.getElementById("estabHeader");

  if (el) el.textContent = nome || "—";
  if (header) header.title = `Estabelecimento: ${nome || "—"}`;
}

document.addEventListener("DOMContentLoaded", preencherNomeNoTopo);

// ===============================
// Sidebar mobile
// ===============================
const sidebar = document.getElementById("sidebar");
const backdrop = document.getElementById("backdrop");
const menuBtn = document.getElementById("menuBtn");

function openSidebar() {
  if (!sidebar || !backdrop) return;
  sidebar.classList.add("open");
  backdrop.classList.add("show");
}
function closeSidebar() {
  if (!sidebar || !backdrop) return;
  sidebar.classList.remove("open");
  backdrop.classList.remove("show");
}

if (menuBtn) menuBtn.addEventListener("click", openSidebar);
if (backdrop) backdrop.addEventListener("click", closeSidebar);

// ===============================
// Range (raio) — tooltip + fill
// ===============================
const rangeMeters = document.getElementById("rangeMeters");
const rangeValue = document.getElementById("rangeValue");

function atualizarRangeUI() {
  if (!rangeMeters) return;

  const min = Number(rangeMeters.min || 0);
  const max = Number(rangeMeters.max || 100);
  const val = Number(rangeMeters.value || 0);

  const percent = ((val - min) * 100) / (max - min || 1);

  // texto
  if (rangeValue) {
    rangeValue.textContent = `${val}m`;

rangeValue.style.left = `${percent}%`;
rangeValue.textContent = `${val}m`;

    // ✅ evita cortar nas pontas
    rangeValue.classList.toggle("is-min", percent <= 2);
    rangeValue.classList.toggle("is-max", percent >= 98);
  }

  // fill do slider
const trackRest = "rgba(255,255,255,.14)"; // casa com o CSS do track
  rangeMeters.style.background =
    `linear-gradient(90deg, var(--accent) 0%, var(--accent) ${percent}%, ${trackRest} ${percent}%, ${trackRest} 100%)`;
}

if (rangeMeters) {
  atualizarRangeUI();
  rangeMeters.addEventListener("input", atualizarRangeUI);
  rangeMeters.addEventListener("change", atualizarRangeUI);
}

// ===============================
// CRIAR FILA
// ===============================
const nomeFila = document.getElementById("nomeFila");
const tempoMedio = document.getElementById("tempoMedio");
const capacidade = document.getElementById("capacidade");
const toggleAtiva = document.getElementById("toggleAtiva");
const msgBoasVindas = document.getElementById("msgBoasVindas");
const horario = document.getElementById("horario");
const observacoes = document.getElementById("observacoes");

const btnSalvar = document.getElementById("btnSalvarFila");

const API_BASE = window.location.origin;

// ===============================
// Erro legível
// ===============================
function extrairMensagemErro(err) {
  if (!err) return "Erro desconhecido";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || "Erro";
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

// ===============================
// FETCH helper (mostra erro do FastAPI)
// ===============================
async function postJSON(path, data) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const payloadText = await res.text();
  let payload = null;
  try { payload = payloadText ? JSON.parse(payloadText) : null; } catch {}

  if (!res.ok) {
    // FastAPI 422 pode vir como {detail: [...]}
    let msg = payload?.detail || payload?.message || `Erro HTTP ${res.status}`;
    if (Array.isArray(msg)) {
      // pega a primeira mensagem do pydantic
      const first = msg[0];
      msg = first?.msg || first?.message || "Erro de validação (422)";
    }
    throw new Error(msg);
  }

  return payload;
}

// ===============================
// SALVAR FILA (NO BANCO) — SEM ENDEREÇO
// ===============================
if (btnSalvar) {
  btnSalvar.addEventListener("click", async () => {

    const estabId = Number(localStorage.getItem("estabelecimento_id") || 0);
    if (!estabId) {
      alert("Faça login novamente. ID do estabelecimento não encontrado.");
      return;
    }

    const nome = (nomeFila?.value || "").trim();
    const tempo = Number(tempoMedio?.value);

    if (!nome || !Number.isFinite(tempo) || tempo <= 0) {
      alert("Preencha os campos obrigatórios (Nome e Tempo médio).");
      return;
    }

    const capRaw = (capacidade?.value ?? "").toString().trim();
    const capNum = capRaw ? Number(capRaw) : null;
    const capFinal = (capNum && Number.isFinite(capNum) && capNum > 0) ? capNum : null;

    const raio = rangeMeters ? Number(rangeMeters.value) : 500;

    const payloadAPI = {
      estabelecimento_id: estabId,
      status: toggleAtiva?.checked ? "ABERTA" : "FECHADA",
      nome,
      raio_metros: raio,
      tempo_medio_min: tempo,
      capacidade_max: capFinal,
      mensagem_boas_vindas: (msgBoasVindas?.value || "").trim() || null,
      horario_funcionamento: (horario?.value || "").trim() || null,
      observacoes: (observacoes?.value || "").trim() || null,
    };

    try {
      const resp = await postJSON("/api/filas", payloadAPI);
      alert(`Fila criada no banco! ID: ${resp?.idFila ?? "—"}`);

      // limpar
      if (nomeFila) nomeFila.value = "";
      if (msgBoasVindas) msgBoasVindas.value = "";
      if (horario) horario.value = "";
      if (observacoes) observacoes.value = "";
      if (capacidade) capacidade.value = "";

      atualizarRangeUI();
    } catch (e) {
      alert(extrairMensagemErro(e));
      console.error("[CRIAR FILA] erro:", e);
    }
  });
}