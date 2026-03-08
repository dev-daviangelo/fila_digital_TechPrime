// ================= HELPERS =================
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function getFilaId() {
  return getParam("filaId");
}

function getNextPage() {
  // vem do QR: next=Fila_cliente.html
  return getParam("next") || "Fila_cliente.html";
}

// Base (funciona em localhost e ngrok)
const ORIGIN = window.location.origin;
const TEMPLATES_BASE = (window.TEMPLATES_BASE || (ORIGIN + "/templates/"));

// ✅ storage por ABA (não conflita entre abas)
const STORE = sessionStorage;

// ================= ELEMENTOS =================
const form = document.getElementById("form");
const nomeInput = document.getElementById("nome");
const errorEl = document.getElementById("error");

const overlay = document.getElementById("overlay");
const successName = document.getElementById("successName");
const queueNumber = document.getElementById("queueNumber");

const btnAcompanhar = document.querySelector(".successBtn");
const btnClient = document.getElementById("btnClient");


// ================= VALIDAÇÃO =================
function nomeValido(nome) {
  return nome && nome.trim().length >= 3;
}

// ================= ABRIR SUCESSO =================
function abrirSucesso(nome, posicao) {
  if (successName) successName.textContent = nome;
  if (queueNumber) queueNumber.textContent = `#${String(posicao || 1).padStart(3, "0")}`;
  if (overlay) {
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
  }
  document.body.classList.add("lock");
}

// ================= IR PARA FILA =================
function irParaFila() {
  const filaId = getFilaId();
  const next = (getNextPage() || "Fila_cliente.html").trim();

  if (!filaId) {
    alert("Link inválido. Entre pela leitura do QR Code.");
    return;
  }

  let urlFinal;

  // URL completa (ngrok, etc.)
  if (/^https?:\/\//i.test(next)) {
    urlFinal = new URL(next);
  }
  // Caminho absoluto (/templates/...)
  else if (next.startsWith("/")) {
    urlFinal = new URL(window.location.origin + next);
  }
  // Só nome do arquivo
  else {
    urlFinal = new URL(`/templates/${next}`, window.location.origin);
  }

  urlFinal.searchParams.set("filaId", String(filaId));
  window.location.href = urlFinal.toString();
}

// ================= SUBMIT (ÚNICO) =================
let isSubmitting = false;

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (isSubmitting) return;

  const nome = (nomeInput?.value || "").trim();

  if (!nomeValido(nome)) {
    if (errorEl) errorEl.textContent = "Digite um nome válido (mínimo 3 caracteres).";
    return;
  }

  if (errorEl) errorEl.textContent = "";

  const filaId = getFilaId();
  if (!filaId) {
    alert("Link inválido. Entre pela leitura do QR Code.");
    return;
  }

  if (!navigator.geolocation) {
    if (errorEl) errorEl.textContent = "Seu navegador não suporta geolocalização.";
    return;
  }

  try {
    isSubmitting = true;
    if (btnClient) btnClient.disabled = true;

    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });

    const latitude = pos.coords.latitude;
    const longitude = pos.coords.longitude;

    console.log("LAT CAPTURADA:", latitude);
    console.log("LNG CAPTURADA:", longitude);

    const resp = await fetch(`${ORIGIN}/api/filas/${filaId}/entrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome,
        latitude,
        longitude
      }),
    });

    const data = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const detail = data.detail || {};

    if (resp.status === 403 && detail.code === "FORA_DA_AREA") {
      throw new Error(detail.message || "Você precisa estar mais perto do endereço da fila para entrar.");
    }

    throw new Error(
      typeof detail === "string" ? detail : (detail.message || "Falha ao entrar na fila.")
    );
  }
    if (data.ok === false) {
      throw new Error(data.detail || "Falha ao entrar na fila.");
    }

    const clienteId = Number(data.cliente_id || 0);
    const filaClienteId = Number(data.fila_cliente_id || 0);

    STORE.setItem(`cliente_session_${filaId}`, String(clienteId));
    STORE.setItem(`fila_cliente_id_${filaId}`, String(filaClienteId));
    STORE.setItem(`cliente_nome_${filaId}`, nome);

    localStorage.setItem(`cliente_session_${filaId}`, String(clienteId));
    localStorage.setItem(`fila_cliente_id_${filaId}`, String(filaClienteId));
    localStorage.setItem(`cliente_nome_${filaId}`, nome);

    const posicao = Number(data.posicao || data.pos || data.numero || 1);

    abrirSucesso(nome, posicao);

  } catch (err) {
    console.error(err);

    let msg = err?.message || "Erro ao entrar na fila.";

    if (err?.code === 1) {
      msg = "Permissão de localização negada.";
    } else if (err?.code === 2) {
      msg = "Não foi possível obter sua localização.";
    } else if (err?.code === 3) {
      msg = "Tempo esgotado ao obter localização.";
    }

    if (errorEl) errorEl.textContent = msg;
  } finally {
    isSubmitting = false;
    if (btnClient) btnClient.disabled = false;
  }
});

// ================= EVENTOS =================
btnAcompanhar?.addEventListener("click", irParaFila);

// ✅ REMOVIDO: editar nome por completo (não registra listener)
// Se ainda existir botão no HTML, ele não fará nada.

// ================= FIX: texto do botão laranja =================
(function fixBtnOrangeTextColor(){
  function apply(){
    const ids = ["btnClient", "btnAcompanhar"];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.setProperty("color", "#0b0c0e", "important");
      el.querySelectorAll("*").forEach(ch => {
        ch.style.setProperty("color", "#0b0c0e", "important");
      });
    });
  }

  apply();
  document.addEventListener("DOMContentLoaded", apply);
  setTimeout(apply, 50);
  setTimeout(apply, 300);
})();