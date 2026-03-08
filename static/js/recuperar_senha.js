const API_BASE = window.location.origin;

const stepSend = document.getElementById("stepSend");
const stepReset = document.getElementById("stepReset");

const email = document.getElementById("email");
const email2 = document.getElementById("email2");
const code = document.getElementById("code");
const newPass = document.getElementById("newPass");
const newPass2 = document.getElementById("newPass2");

const sendError = document.getElementById("sendError");
const resetError = document.getElementById("resetError");

const btnSend = document.getElementById("btnSend");
const btnReset = document.getElementById("btnReset");

function show(el){ el.classList.remove("hidden"); }
function hide(el){ el.classList.add("hidden"); }

function emailValido(v){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim());
}

// ✅ postJSON mais robusto: pega JSON ou TEXTO e mostra a mensagem real
async function postJSON(path, data){
  const r = await fetch(API_BASE + path, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(data),
  });

  const text = await r.text().catch(() => "");
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch (_) {}

  if (!r.ok){
    const msg =
      payload?.detail ||
      payload?.message ||
      text ||
      `Erro HTTP ${r.status}`;
    throw new Error(msg);
  }

  return payload ?? {};
}

function goToSend(prefillEmail = ""){
  sendError.textContent = "";
  resetError.textContent = "";
  hide(stepReset);
  show(stepSend);
  if (prefillEmail) email.value = prefillEmail;
}

function goToReset(prefillEmail = ""){
  sendError.textContent = "";
  resetError.textContent = "";
  hide(stepSend);
  show(stepReset);

  const em = (prefillEmail || email.value || "").trim();
  email2.value = em;
  if (email2.value) code.focus();
}

// ✅ Agora: se vier ?email=..., preenche e fica na ETAPA 1 (Enviar código)
(function init(){
  const params = new URLSearchParams(window.location.search);
  const em = (params.get("email") || "").trim();

  if (em){
    goToSend(em); // <-- mudou aqui
  } else {
    goToSend("");
  }
})();

// Toggle senha
function bindToggle(btnId, inputEl){
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener("click", () => {
    inputEl.type = (inputEl.type === "password") ? "text" : "password";
  });
}
bindToggle("toggle1", newPass);
bindToggle("toggle2", newPass2);

// Navegação
document.getElementById("goLogin").addEventListener("click", () => {
  window.location.href = "/templates/cnpj.html";
});
document.getElementById("goStepReset").addEventListener("click", () => goToReset(email.value));
document.getElementById("backSend").addEventListener("click", () => goToSend(email2.value));

// Somente números no código
code.addEventListener("input", () => {
  code.value = code.value.replace(/\D/g, "").slice(0, 6);
});

// Enviar código
btnSend.addEventListener("click", async () => {
  sendError.textContent = "";

  const em = (email.value || "").trim().toLowerCase();
  if (!em){ sendError.textContent = "Digite seu e-mail."; return; }
  if (!emailValido(em)){ sendError.textContent = "E-mail inválido."; return; }

  try{
    await postJSON("/api/forgot-password", { email: em });
    alert("Código enviado! Verifique sua caixa de entrada / spam.");
    goToReset(em);
  }catch(e){
    sendError.textContent = e.message || "Erro ao enviar o código.";
  }
});

// Reenviar
document.getElementById("resend").addEventListener("click", async () => {
  resetError.textContent = "";

  const em = (email2.value || "").trim().toLowerCase();
  if (!em){ resetError.textContent = "Digite seu e-mail."; return; }
  if (!emailValido(em)){ resetError.textContent = "E-mail inválido."; return; }

  try{
    await postJSON("/api/forgot-password", { email: em });
    alert("Código reenviado! Verifique sua caixa de entrada / spam.");
  }catch(e){
    resetError.textContent = e.message || "Erro ao reenviar.";
  }
});

// Alterar senha
btnReset.addEventListener("click", async () => {
  resetError.textContent = "";

  const em = (email2.value || "").trim().toLowerCase();
  const cd = (code.value || "").trim();
  const p1 = (newPass.value || "").trim();
  const p2 = (newPass2.value || "").trim();

  if (!em){ resetError.textContent = "Digite seu e-mail."; return; }
  if (!emailValido(em)){ resetError.textContent = "E-mail inválido."; return; }
  if (!/^\d{6}$/.test(cd)){ resetError.textContent = "Código inválido (precisa ter 6 dígitos)."; return; }
  if (p1.length < 8){ resetError.textContent = "Senha deve ter no mínimo 8 caracteres."; return; }
  if (p1 !== p2){ resetError.textContent = "As senhas não conferem."; return; }

  try{
    await postJSON("/api/reset-password", { email: em, code: cd, new_password: p1 });
    alert("Senha alterada com sucesso! Faça login novamente.");
    window.location.href = "/templates/cnpj.html";
  }catch(e){
    resetError.textContent = e.message || "Código inválido ou expirado.";
  }
});