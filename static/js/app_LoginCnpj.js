// static/js/app_LoginCnpj.js

const API_BASE = window.location.origin;
const forgotBtn = document.getElementById("forgotBtn");
const modeForgot = document.getElementById("modeForgot");
const forgotEmail = document.getElementById("forgotEmail");
const forgotError = document.getElementById("forgotError");
const btnForgot = document.getElementById("btnForgot");
const backLoginBtn = document.getElementById("backLoginBtn");

// ================= FETCH =================
async function postJSON(path, data) {
  const url = API_BASE + path;

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch {
    throw new Error("Falha ao conectar com a API.");
  }

  let payload = null;
  let raw = "";
  try { payload = await res.json(); }
  catch { raw = await res.text().catch(() => ""); }

  if (!res.ok) {
    throw new Error(payload?.detail || raw || `Erro HTTP ${res.status}`);
  }
  return payload;
}

async function getJSON(url) {
  let res;
  try { res = await fetch(url); }
  catch { throw new Error("Falha ao conectar."); }

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || "Erro na consulta.");
  return data;
}

// ================= HELPERS =================
function onlyDigits(v) { return (v || "").replace(/\D/g, ""); }

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizarEmail(email) { return (email || "").trim().toLowerCase(); }

// ================= ELEMENTOS (LOGIN/CADASTRO) =================
const bizError = document.getElementById("bizError");
const signupError = document.getElementById("signupError");
const signupError2 = document.getElementById("signupError2");

const modeBiz = document.getElementById("modeBiz");
const modeBizSignup = document.getElementById("modeBizSignup");

const signupBtn = document.getElementById("signupBtn");
const signupBackToLogin1 = document.getElementById("signupBackToLogin1");

const bizEmail = document.getElementById("bizEmail");
const bizPass = document.getElementById("bizPass");
const btnBiz = document.getElementById("btnBiz");

const signupStep1 = document.getElementById("signupStep1");
const signupStep2 = document.getElementById("signupStep2");
const signupStep3 = document.getElementById("signupStep3");

const btnSignupContinue = document.getElementById("btnSignupContinue");
const goPrevStepBtn = document.getElementById("goPrevStepBtn");
const goPrevStepBtn2 = document.getElementById("goPrevStepBtn2");
const btnSignupBiz = document.getElementById("btnSignupBiz");

const signupBizName = document.getElementById("signupBizName");
const signupBizCnpj = document.getElementById("signupBizCnpj");
const signupBizCategory = document.getElementById("signupBizCategory");
const signupBizCity = document.getElementById("signupBizCity");
const signupBizUF = document.getElementById("signupBizUF");
const signupBizPhone = document.getElementById("signupBizPhone");

const signupBizEmail = document.getElementById("signupBizEmail");
const signupBizPass = document.getElementById("signupBizPass");
const signupBizPass2 = document.getElementById("signupBizPass2");

// ================= ELEMENTOS (ENDEREÇO) =================
const addrCep = document.getElementById("addrCep");
const addrNumero = document.getElementById("addrNumero");
const addrCompl = document.getElementById("addrCompl");
const addrLogradouro = document.getElementById("addrLogradouro");
const addrBairro = document.getElementById("addrBairro");
const addrCidade = document.getElementById("addrCidade");
const addrUf = document.getElementById("addrUf");

const addrError = document.getElementById("addrError");
const btnBuscarCep = document.getElementById("btnBuscarCep");
const btnSalvarEndereco = document.getElementById("btnSalvarEndereco");
const togglePass = document.getElementById("togglePass");
const toggleSignupPass = document.getElementById("toggleSignupPass");

function configurarToggleSenha(botao, input) {
  if (!botao || !input) return;

  const atualizarAcessibilidade = () => {
    const mostrando = input.type === "text";
    botao.setAttribute("aria-label", mostrando ? "Ocultar senha" : "Mostrar senha");
    botao.setAttribute("aria-pressed", mostrando ? "true" : "false");
  };

  botao.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    input.type = input.type === "password" ? "text" : "password";
    atualizarAcessibilidade();
    input.focus({ preventScroll: true });

    const fim = input.value.length;
    try { input.setSelectionRange(fim, fim); } catch {}
  });

  atualizarAcessibilidade();
}

configurarToggleSenha(togglePass, bizPass);
configurarToggleSenha(toggleSignupPass, signupBizPass);

// ================= UI MODOS =================

// ✅ Força o botão "Esqueceu a senha?" a SEMPRE ir para a página separada
// ✅ Bloqueia qualquer listener antigo que esteja abrindo o modeForgot
// === ESQUECEU A SENHA (FORÇAR REDIRECIONAMENTO) ===
if (forgotBtn) {
  forgotBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const em = (bizEmail?.value || "").trim();
    const url = em
      ? `/templates/recuperar_senha.html?email=${encodeURIComponent(em)}`
      : "/templates/recuperar_senha.html";

    window.location.assign(url);
  }, true); // CAPTURE
}
// ✅ ÚNICA versão (sem duplicar função)
function mostrarApenas(target) {
  [modeBiz, modeBizSignup, modeForgot].forEach(m => m?.classList.add("hidden"));
  target?.classList.remove("hidden");
}

// ================= FORGOT PASSWORD (NOVO FLUXO) =================
// ✅ Agora o botão "Esqueceu a senha?" SEMPRE redireciona para a nova página.
// ✅ Mesmo que modeForgot exista no HTML, ele não será usado.

forgotBtn?.addEventListener("click", (e) => {
  e.preventDefault();

  const em = (bizEmail?.value || "").trim();
  const url = em
    ? `/templates/recuperar_senha.html?email=${encodeURIComponent(em)}`
    : "/templates/recuperar_senha.html";

  window.location.href = url;
});

// (mantidos por compatibilidade, mas sem uso)
backLoginBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  if (forgotError) forgotError.textContent = "";
  mostrarApenas(modeBiz);
});

// ⚠️ Desativado: envio antigo via modeForgot
// (deixamos sem listener para não ter dois fluxos e evitar duplicidade)
if (btnForgot) {
  btnForgot.disabled = true;
  btnForgot.title = "Este fluxo foi substituído pela nova tela de recuperação.";
}

// ================= UTILIDADES LOGIN =================
function extrairEstabId(data) {
  const candidatos = [
    data?.estabelecimento_id,
    data?.estabelecimentoId,
    data?.idEstabelecimento,
    data?.id,
    data?.estabelecimento?.id,
    data?.estabelecimento?.idEstabelecimento,
    data?.user?.id,
  ];
  const id = candidatos.find(v => Number(v) > 0);
  return id ? Number(id) : null;
}

function extrairNomeEstab(data) {
  const candidatos = [
    data?.nome,
    data?.estabelecimento_nome,
    data?.nomeEstabelecimento,
    data?.estabelecimento?.nome,
    data?.user?.nome,
  ];
  const nome = candidatos.find(v => typeof v === "string" && v.trim());
  return nome ? nome.trim() : null;
}

function salvarNomeEstabelecimento(nome) {
  if (!nome || !String(nome).trim()) return;
  const n = String(nome).trim();
  localStorage.setItem("nomeEstabelecimento", n);
  localStorage.setItem("estabelecimento_nome", n);
}

// ✅ interpreta flags tipo true/1/"true"/"1"
function flagTrue(v) {
  if (v === true) return true;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "sim" || s === "yes";
  }
  return false;
}

// ✅ tenta achar a flag mesmo se backend usar outro nome
function precisaEndereco(data) {
  return flagTrue(
    data?.needs_address ??
    data?.needsAddress ??
    data?.precisa_endereco ??
    data?.precisaEndereco ??
    data?.needs_endereco ??
    data?.needsEndereco
  );
}

// ================= STEPPER =================
const stepDot1 = document.getElementById("stepDot1");
const stepDot2 = document.getElementById("stepDot2");
const stepDot3 = document.getElementById("stepDot3");
const stepLine = document.getElementById("stepLine");
const stepLine2 = document.getElementById("stepLine2");
const stepperText = document.getElementById("stepperText");

function setStepper(etapa) {
  const dots = [stepDot1, stepDot2, stepDot3];
  const lines = [stepLine, stepLine2];

  dots.forEach(d => d?.classList.remove("active", "done"));
  lines.forEach(l => l?.classList.remove("filled"));

  if (etapa === 1) {
    stepDot1?.classList.add("active");
  } else if (etapa === 2) {
    stepDot1?.classList.add("done");
    stepLine?.classList.add("filled");
    stepDot2?.classList.add("active");
  } else {
    stepDot1?.classList.add("done");
    stepDot2?.classList.add("done");
    stepLine?.classList.add("filled");
    stepLine2?.classList.add("filled");
    stepDot3?.classList.add("active");
  }

  if (stepperText) stepperText.textContent = `Etapa ${etapa} de 3`;
}

function abrirModoBiz() { mostrarApenas(modeBiz); }

// ✅ agora abre no step que você quiser (padrão 1)
function abrirModoBizSignup(etapa = 1) {
  mostrarApenas(modeBizSignup);
  mostrarSignupEtapa(etapa);
}

function mostrarSignupEtapa(etapa) {
  signupStep1?.classList.add("hidden");
  signupStep2?.classList.add("hidden");
  signupStep3?.classList.add("hidden");

  if (etapa === 1) signupStep1?.classList.remove("hidden");
  if (etapa === 2) signupStep2?.classList.remove("hidden");
  if (etapa === 3) signupStep3?.classList.remove("hidden");

  setStepper(etapa);
}

// ================= NAVEGAÇÃO =================
signupBtn?.addEventListener("click", () => abrirModoBizSignup(1));
signupBackToLogin1?.addEventListener("click", abrirModoBiz);
goPrevStepBtn?.addEventListener("click", () => mostrarSignupEtapa(1));
goPrevStepBtn2?.addEventListener("click", () => mostrarSignupEtapa(2));

// ================= VALIDAÇÃO ETAPA 1 =================
function validarEtapa1() {
  if (!signupBizName?.value.trim()) return "Digite o nome.";
  if (onlyDigits(signupBizCnpj?.value).length !== 14) return "CNPJ inválido.";
  if (!signupBizCategory?.value) return "Selecione categoria.";
  if (onlyDigits(signupBizPhone?.value).length < 10) return "Telefone inválido.";
  return "";
}

btnSignupContinue?.addEventListener("click", () => {
  const msg = validarEtapa1();
  if (msg) {
    signupError.textContent = msg;
    return;
  }
  signupError.textContent = "";
  mostrarSignupEtapa(2);
});

// ================= VALIDAÇÃO ETAPA 2 =================
function validarEtapa2() {
  const email = signupBizEmail.value.trim();
  const p1 = signupBizPass.value;
  const p2 = signupBizPass2.value;

  if (!emailValido(email)) return "Email inválido.";
  if (p1.length < 8) return "Senha mínima 8 caracteres.";
  if (p1 !== p2) return "Senhas não coincidem.";
  return "";
}

// ================= CADASTRO ETAPA 2 (cria conta) =================
btnSignupBiz?.addEventListener("click", async () => {
  const msg = validarEtapa2();
  if (msg) {
    signupError2.textContent = msg;
    return;
  }
  signupError2.textContent = "";

  const categoriaMap = {
    "Clínica": "CLINICA",
    "Barbearia": "BARBEARIA",
    "Salão": "SALAO",
    "Estética": "ESTETICA",
    "Restaurante": "RESTAURANTE",
    "Açougue": "ACOUGUE",
    "Supermercado": "SUPERMERCADO",
    "Outros": "OUTROS",
  };
  const categoria = categoriaMap[(signupBizCategory.value || "").trim()] || "OUTROS";

  const payload = {
    nome: signupBizName.value.trim(),
    cidade: signupBizCity?.value?.trim() || null,
    cnpj: signupBizCnpj.value.trim(),
    categoria,
    estado: signupBizUF?.value?.trim() || null,
    telefone: signupBizPhone.value.trim(),
    email: normalizarEmail(signupBizEmail.value),
    senha: signupBizPass.value,
    latitude: null,
    longitude: null,
    raio_alerta: 0.20,
  };

  try {
    const resp = await postJSON("/api/estabelecimentos", payload);

    const id = extrairEstabId(resp) || resp?.id || null;
    if (!id) throw new Error("Cadastro criado, mas a API não retornou o id.");

    localStorage.setItem("estabelecimento_id", String(id));
    salvarNomeEstabelecimento(payload.nome);

    // ✅ Vai direto pra etapa 3 (endereço)
    mostrarSignupEtapa(3);

  } catch (e) {
    signupError2.textContent = e.message;
  }
});

// ================= ENDEREÇO: VIA CEP =================
async function buscarViaCep(cepDigits) {
  const url = `https://viacep.com.br/ws/${cepDigits}/json/`;
  const data = await getJSON(url);
  if (data?.erro) throw new Error("CEP não encontrado.");
  return data;
}

function validarEtapa3() {
  const cep = onlyDigits(addrCep.value);
  if (cep.length !== 8) return "CEP inválido.";
  if (!addrNumero.value.trim()) return "Informe o número.";
  if (!addrLogradouro.value.trim()) return "Informe o logradouro.";
  if (!addrBairro.value.trim()) return "Informe o bairro.";
  if (!addrCidade.value.trim()) return "Informe a cidade.";
  if (!addrUf.value.trim() || addrUf.value.trim().length !== 2) return "Informe a UF (2 letras).";
  return "";
}

btnBuscarCep?.addEventListener("click", async () => {
  addrError.textContent = "";
  const cep = onlyDigits(addrCep.value);

  if (cep.length !== 8) {
    addrError.textContent = "CEP inválido.";
    return;
  }

  try {
    const v = await buscarViaCep(cep);
    addrLogradouro.value = v.logradouro || "";
    addrBairro.value = v.bairro || "";
    addrCidade.value = v.localidade || "";
    addrUf.value = (v.uf || "").toUpperCase();
    if (signupBizCity && !signupBizCity.value.trim()) signupBizCity.value = addrCidade.value;
    if (signupBizUF && (signupBizUF.value === "" || signupBizUF.value === "UF")) signupBizUF.value = addrUf.value;
    addrNumero.focus();
  } catch (e) {
    addrError.textContent = e.message;
  }
});

// ================= SALVAR ENDEREÇO NO BACKEND =================
btnSalvarEndereco?.addEventListener("click", async () => {
  addrError.textContent = "";

  const msg = validarEtapa3();
  if (msg) {
    addrError.textContent = msg;
    return;
  }

  const estabId = Number(localStorage.getItem("estabelecimento_id") || 0);
  if (!estabId) {
    addrError.textContent = "Não encontrei o id do estabelecimento. Faça o cadastro novamente.";
    return;
  }

  const payload = {
    cep: onlyDigits(addrCep.value),
    numero: addrNumero.value.trim(),
    complemento: addrCompl.value.trim() || null,
    logradouro: addrLogradouro.value.trim(),
    bairro: addrBairro.value.trim(),
    cidade_end: addrCidade.value.trim(),
    uf: addrUf.value.trim().toUpperCase(),
  };

  try {
    await postJSON(`/api/estabelecimentos/${estabId}/endereco`, payload);

    abrirModoBiz();
    bizEmail.value = normalizarEmail(signupBizEmail.value);
    bizPass.value = "";
    bizError.textContent = "Endereço salvo! Agora faça login.";

  } catch (e) {
    addrError.textContent = e.message;
  }
});

// ================= LOGIN (POST /api/login-estabelecimento) =================
btnBiz?.addEventListener("click", async () => {
  bizError.textContent = "";

  const email = normalizarEmail(bizEmail.value);
  const senha = bizPass.value;

  if (!emailValido(email)) {
    bizError.textContent = "Email inválido.";
    return;
  }
  if (!senha) {
    bizError.textContent = "Digite a senha.";
    return;
  }

  try {
    const data = await postJSON("/api/login-estabelecimento", { email, senha });

    const estabId = extrairEstabId(data);
    if (!estabId) {
      console.log("Resposta do login:", data);
      throw new Error("Login OK, mas a API não retornou o id do estabelecimento.");
    }

    localStorage.setItem("estabelecimento_id", String(estabId));

    const nomeDaApi = extrairNomeEstab(data);
    if (nomeDaApi) salvarNomeEstabelecimento(nomeDaApi);

    // ✅ se precisar cadastrar endereço, abre etapa 3 (robusto)
    if (precisaEndereco(data)) {
      abrirModoBizSignup(3);
      addrError.textContent = "Cadastre o endereço do estabelecimento para continuar.";
      return;
    }

    window.location.href = "/templates/Dashboard.html";
  } catch (e) {
    bizError.textContent = e.message;
  }
});