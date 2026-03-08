// ===== Sidebar mobile (somente nesta página) =====
const sidebar = document.getElementById("sidebar");
const backdrop = document.getElementById("backdrop");
const menuBtn = document.getElementById("menuBtn");

function openSidebar(){
  if (!sidebar || !backdrop) return;
  sidebar.classList.add("open");
  backdrop.classList.add("show");
}
function closeSidebar(){
  if (!sidebar || !backdrop) return;
  sidebar.classList.remove("open");
  backdrop.classList.remove("show");
}

menuBtn?.addEventListener("click", openSidebar);
backdrop?.addEventListener("click", closeSidebar);

// ===== API =====
const API_BASE = window.location.origin;

// ===== Toast =====
const toast = document.getElementById("toast");
function showToast(msg){
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1500);
}

// ===== Topbar nome =====
function setNomeTopbar(nome){
  const el = document.getElementById("nomeEstabelecimento");
  if (el) el.textContent = (nome || "—").trim();
}

// ===== Inputs do formulário =====
const inpNome = document.getElementById("inpNome");
const inpEndereco = document.getElementById("inpEndereco");
const inpTelefone = document.getElementById("inpTelefone");

// ✅ garante bloqueio (mesmo se esquecer readonly no HTML)
function bloquearCamposFixos(){
  if (inpNome) inpNome.readOnly = true;
  if (inpEndereco) inpEndereco.readOnly = true;
}
bloquearCamposFixos();

// ===== Helpers =====
async function getJSON(path){
  const res = await fetch(API_BASE + path, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Erro HTTP ${res.status}`);
  return data;
}

function digitsOnly(s){
  return String(s || "").replace(/\D+/g, "");
}

// ===== Telefone/WhatsApp: máscara BR (11 dígitos) =====
function formatBRPhone(value){
  const d = digitsOnly(value).slice(0, 11);

  // (00) 0000-0000
  if (d.length <= 10){
    const p1 = d.slice(0, 2);
    const p2 = d.slice(2, 6);
    const p3 = d.slice(6, 10);
    if (!p1) return "";
    if (d.length <= 2) return `(${p1}`;
    if (d.length <= 6) return `(${p1}) ${p2}`;
    return `(${p1}) ${p2}-${p3}`;
  }

  // (00) 00000-0000
  const p1 = d.slice(0, 2);
  const p2 = d.slice(2, 7);
  const p3 = d.slice(7, 11);
  return `(${p1}) ${p2}-${p3}`;
}

function bindPhoneMask(){
  if (!inpTelefone) return;

  // aplica máscara ao digitar
  inpTelefone.addEventListener("input", () => {
    const old = inpTelefone.value;
    const masked = formatBRPhone(old);
    inpTelefone.value = masked;
  });

  // ao colar, mascara também
  inpTelefone.addEventListener("paste", () => {
    setTimeout(() => {
      inpTelefone.value = formatBRPhone(inpTelefone.value);
    }, 0);
  });
}
bindPhoneMask();

function preencherPerfil(est){
  const nome = (est?.nome || "").trim();
  const telefone = (est?.telefone || "").trim();

  // endereço: seu backend agora tem campos separados (logradouro/numero/bairro/cidade_end/uf)
  const endereco =
    (est?.endereco || "").trim() ||
    [
      est?.logradouro,
      est?.numero,
      est?.bairro,
      est?.cidade_end || est?.cidade,
      est?.uf || est?.estado
    ]
      .filter(Boolean)
      .join(", ");

  if (inpNome) inpNome.value = nome || inpNome.value || "";
  if (inpEndereco) inpEndereco.value = endereco || inpEndereco.value || "";

  if (inpTelefone){
    // máscara aplicada (aceita 10/11 dígitos)
    inpTelefone.value = formatBRPhone(telefone);
  }

  // topbar + localStorage
  if (nome){
    setNomeTopbar(nome);
    localStorage.setItem("estabelecimento_nome", nome);
    localStorage.setItem("nomeEstabelecimento", nome);
  }
}

// ===== Carregar perfil do banco =====
async function carregarPerfil(){
  const estabId = Number(localStorage.getItem("estabelecimento_id") || 0);
  if (!estabId){
    showToast("Faça login novamente.");
    window.location.href = "/templates/LoginCnpj.html";
    return;
  }

  // primeiro tenta o cache
  const nomeLS = (localStorage.getItem("estabelecimento_nome") || "").trim();
  if (nomeLS) setNomeTopbar(nomeLS);

  // agora busca do banco
  const est = await getJSON(`/api/estabelecimentos/${estabId}`);
  preencherPerfil(est);
}

// ===== Form salvar =====
// ✅ Agora só permite salvar TELEFONE (nome/endereço bloqueados)
async function putJSON(path, body){
  const res = await fetch(API_BASE + path, {
    method: "PUT",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(body || {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Erro HTTP ${res.status}`);
  return data;
}

const formPerfil = document.getElementById("formPerfil");
formPerfil?.addEventListener("submit", async (e) => {
  e.preventDefault();

  try{
    const estabId = Number(localStorage.getItem("estabelecimento_id") || 0);
    if (!estabId) throw new Error("Sessão inválida. Faça login novamente.");

    // manda só dígitos
    const telDigits = digitsOnly(inpTelefone?.value || "");

    // validação básica (opcional)
    if (telDigits && !(telDigits.length === 10 || telDigits.length === 11)){
      throw new Error("Telefone inválido. Use DDD + número (10 ou 11 dígitos).");
    }

    await putJSON(`/api/estabelecimentos/${estabId}`, {
      telefone: telDigits || null
    });

    // mantém máscara no input
    if (inpTelefone) inpTelefone.value = formatBRPhone(telDigits);

    showToast("Telefone atualizado!");
  } catch (err){
    console.error(err);
    showToast(err?.message || "Erro ao salvar.");
  }
});

// ===== Preferências (mock salvar local) =====
const prefs = {
  notif: document.getElementById("togNotif"),
  live: document.getElementById("togLive"),
  qr: document.getElementById("togQr"),
};

function loadPrefs(){
  const saved = JSON.parse(localStorage.getItem("prefs") || "{}");
  if (typeof saved.notif === "boolean" && prefs.notif) prefs.notif.checked = saved.notif;
  if (typeof saved.live === "boolean" && prefs.live) prefs.live.checked = saved.live;
  if (typeof saved.qr === "boolean" && prefs.qr) prefs.qr.checked = saved.qr;
}
function savePrefs(){
  localStorage.setItem("prefs", JSON.stringify({
    notif: !!prefs.notif?.checked,
    live: !!prefs.live?.checked,
    qr: !!prefs.qr?.checked
  }));
  showToast("Preferências salvas!");
}

Object.values(prefs).forEach((el) => el?.addEventListener("change", savePrefs));
loadPrefs();

// ===== Sair =====
document.getElementById("btnSair")?.addEventListener("click", () => {
  localStorage.removeItem("estabelecimento_id");
  localStorage.removeItem("estabelecimento_nome");
  localStorage.removeItem("nomeEstabelecimento");

  showToast("Sessão encerrada!");
  setTimeout(() => {
    window.location.href = "/templates/index.html";
  }, 800);
});

// ===== INIT =====
carregarPerfil().catch((e) => {
  console.error("Erro carregarPerfil:", e);
  showToast(e.message || "Erro ao carregar perfil.");
});