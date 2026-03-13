const API_BASE = window.location.origin;

// ===============================
// ESTABELECIMENTO
// ===============================
(function syncNomeEstab() {
  const ja = localStorage.getItem("nomeEstabelecimento");
  if (ja && ja.trim()) return;

  const n =
    localStorage.getItem("estabelecimento_nome") ||
    localStorage.getItem("nome_estabelecimento") ||
    localStorage.getItem("estab_nome");

  if (n && n.trim()) localStorage.setItem("nomeEstabelecimento", n.trim());
})();

function obterNomeEstabelecimento() {
  return (
    localStorage.getItem("nomeEstabelecimento") ||
    localStorage.getItem("estabelecimento_nome") ||
    localStorage.getItem("nome_estabelecimento") ||
    localStorage.getItem("estab_nome") ||
    "—"
  );
}

function preencherNomeTopo() {
  const nome = obterNomeEstabelecimento();
  const el = document.getElementById("nomeEstabelecimento");
  const header = document.getElementById("estabHeader");

  if (el) el.textContent = nome;
  if (header) header.title = `Estabelecimento: ${nome}`;
}

function getEstabId() {
  const raw = localStorage.getItem("estabelecimento_id");
  const id = Number(raw || 0);
  return id > 0 ? id : 0;
}

// ===============================
// SIDEBAR MOBILE
// ===============================
function setupSidebar() {
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("backdrop");
  const menuBtn = document.getElementById("menuBtn");

  function openSidebar() {
    sidebar?.classList.add("open");
    backdrop?.classList.add("show");
  }

  function closeSidebar() {
    sidebar?.classList.remove("open");
    backdrop?.classList.remove("show");
  }

  menuBtn?.addEventListener("click", openSidebar);
  backdrop?.addEventListener("click", closeSidebar);
}

// ===============================
// RANGE DO RAIO
// ===============================
function setupRange() {
  const range = document.getElementById("rangeMeters");
  const value = document.getElementById("rangeValue");

  if (!range || !value) return;

  function atualizar() {
    value.textContent = `${range.value}m`;
  }

  range.addEventListener("input", atualizar);
  atualizar();
}

//MODAL//
function criarModalSucesso() {
  if (document.getElementById("modalSucessoFila")) return;

  const modal = document.createElement("div");
  modal.id = "modalSucessoFila";
  modal.innerHTML = `
    <div id="modalSucessoOverlay" style="
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    ">
      <div style="
        background: #1f1f1f;
        color: white;
        padding: 28px 24px;
        border-radius: 16px;
        width: min(90%, 420px);
        box-shadow: 0 10px 30px rgba(0,0,0,0.35);
        text-align: center;
        font-family: Arial, sans-serif;
      ">
        <div style="
          font-size: 42px;
          margin-bottom: 12px;
        ">✅</div>

        <h3 style="
          margin: 0 0 10px 0;
          font-size: 22px;
          font-weight: 700;
        ">Fila criada com sucesso!</h3>

        <p style="
          margin: 0;
          font-size: 16px;
          color: #d6d6d6;
          line-height: 1.5;
        ">
          Redirecionando para o QR Code...
        </p>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function mostrarModalSucessoERedirecionar(urlDestino) {
  criarModalSucesso();

  const modal = document.getElementById("modalSucessoFila");
  if (modal) modal.style.display = "block";

  setTimeout(() => {
    window.location.href = urlDestino;
  }, 1500);
}
// ===============================
// CRIAR FILA
// ===============================
async function criarFila() {
  const estabId = getEstabId();

  if (!estabId) {
    alert("Sessão do estabelecimento não encontrada. Faça login novamente.");
    return;
  }

  const nomeFila = document.getElementById("nomeFila")?.value?.trim() || "";
  const rangeMeters = Number(document.getElementById("rangeMeters")?.value || 500);
  const tempoMedio = Number(document.getElementById("tempoMedio")?.value || 0);
  const toggleAtiva = document.getElementById("toggleAtiva")?.checked ?? true;

  const msgBoasVindas = document.getElementById("msgBoasVindas")?.value?.trim() || "";
  const horario = document.getElementById("horario")?.value?.trim() || "";
  const observacoes = document.getElementById("observacoes")?.value?.trim() || "";

  if (!nomeFila) {
    alert("Digite o nome da fila.");
    return;
  }

  if (!tempoMedio || tempoMedio <= 0) {
    alert("Informe um tempo médio válido.");
    return;
  }

  const body = {
    nome: nomeFila,
    estabelecimento_id: estabId,
    raio_metros: rangeMeters,
    tempo_medio_min: tempoMedio,
    status: toggleAtiva ? "ABERTA" : "FECHADA",

    // campos extras
    mensagem_boas_vindas: msgBoasVindas,
    horario_funcionamento: horario,
    observacoes: observacoes
  };

  const btn = document.getElementById("btnSalvarFila");

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="bi bi-hourglass-split"></i> Salvando...`;
    }

    const res = await fetch(`${API_BASE}/api/filas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.detail || `Erro HTTP ${res.status}`);
    }

    const filaId = Number(data?.idFila || 0);

    if (!filaId) {
      throw new Error("A fila foi criada, mas o id da fila não foi retornado.");
    }

    // salva a última fila criada, caso queira usar depois
    localStorage.setItem("ultima_fila_criada_id", String(filaId));

    // ✅ mostra modal e depois redireciona
    mostrarModalSucessoERedirecionar(`/templates/Qr_code.html?filaId=${filaId}`);
    return;
  } catch (err) {
    console.error("Erro ao criar fila:", err);
    alert(err.message || "Erro ao criar fila.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="bi bi-floppy"></i> Salvar fila`;
    }
  }
}

// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  preencherNomeTopo();
  setupSidebar();
  setupRange();

  const btnSalvar = document.getElementById("btnSalvarFila");
  btnSalvar?.addEventListener("click", criarFila);
});