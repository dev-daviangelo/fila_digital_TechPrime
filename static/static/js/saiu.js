document.getElementById("btnEntendi")?.addEventListener("click", () => {
  // volta pro login sem filaId -> força escanear QR novamente
  window.location.href = "/templates/login.html?msg=" + encodeURIComponent(
    "Para entrar novamente, escaneie o QR Code do estabelecimento."
  );
});

document.getElementById("btnVoltar")?.addEventListener("click", () => {
  window.location.href = "/templates/index.html";
});
btnSair?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();

  const ok = confirm("Tem certeza que deseja sair da fila?");
  if (!ok) return;

  // ✅ Redireciona IMEDIATO (garante a troca de página)
  const target = `${window.location.origin}/templates/saiu.html`;

  // limpa sessão e nome
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem("CLIENTE_NOME");
    localStorage.removeItem(`cliente_nome_${filaId}`);
  } catch {}

  // tenta avisar a API sem travar a navegação
  try {
    if (filaId && clienteId) {
      navigator.sendBeacon?.(
        `${API_BASE}/api/filas/${filaId}/cliente/${clienteId}/sair`
      );
    }
  } catch {}

  // ✅ replace evita voltar pra fila com "voltar"
  window.location.replace(target);
});
