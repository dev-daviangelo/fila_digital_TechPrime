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
  successName.textContent = nome;
  queueNumber.textContent = `#${String(posicao || 1).padStart(3, "0")}`;
  overlay.classList.add("show");
  overlay.setAttribute("aria-hidden", "false");
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

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (isSubmitting) return; // 🔒 evita duplo POST

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

  try {
    isSubmitting = true;
    if (btnClient) btnClient.disabled = true;

    const resp = await fetch(`${ORIGIN}/api/filas/${filaId}/entrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok || !data.ok) {
      throw new Error(data.detail || "Falha ao entrar na fila.");
    }

    // ================= ✅ SALVAR SESSÃO (IMPORTANTE) =================
    // Esses 3 salvamentos garantem que o cliente reconheça no WS quando for
    // FINALIZADO/CANCELADO, e consiga mostrar o modal corretamente.
    localStorage.setItem(`cliente_session_${filaId}`, String(data.cliente_id || 0));
    localStorage.setItem(`fila_cliente_id_${filaId}`, String(data.fila_cliente_id || 0)); // ✅ NOVO
    localStorage.setItem("CLIENTE_NOME", nome);
    localStorage.setItem(`cliente_nome_${filaId}`, nome); // ✅ NOVO (fallback)

    // ✅ usa posição real do backend
    abrirSucesso(nome, data.posicao);

  } catch (err) {
    if (errorEl) errorEl.textContent = err?.message || "Erro ao entrar na fila.";
  } finally {
    isSubmitting = false;
    if (btnClient) btnClient.disabled = false;
  }
});

// ================= EVENTOS =================
btnAcompanhar?.addEventListener("click", irParaFila);

// Editar nome
document.getElementById("editNameBtn")?.addEventListener("click", () => {
  overlay?.classList.remove("show");
  document.body.classList.remove("lock");
  nomeInput?.focus();
});

(function fixBtnOrangeTextColor(){
  function apply(){
    const ids = ["btnClient", "btnAcompanhar"]; // coloca aqui outros IDs se tiver
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.setProperty("color", "#0b0c0e", "important");
      // se tiver ícone/span dentro, garante também
      el.querySelectorAll("*").forEach(ch => {
        ch.style.setProperty("color", "#0b0c0e", "important");
      });
    });
  }

  // roda agora e depois (caso o modal seja inserido depois via JS)
  apply();
  document.addEventListener("DOMContentLoaded", apply);
  setTimeout(apply, 50);
  setTimeout(apply, 300);
})();