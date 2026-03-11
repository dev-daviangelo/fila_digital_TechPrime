// /static/js/app_toasts.js
(() => {
  if (window.__appToastsLoaded) return;
  window.__appToastsLoaded = true;

  const CONTAINER_ID = "toastTopContainer";

  function ensureContainer() {
    let container = document.getElementById(CONTAINER_ID);

    if (!container) {
      container = document.createElement("div");
      container.id = CONTAINER_ID;
      container.style.position = "fixed";
      container.style.top = "70px";
      container.style.right = "18px";
      container.style.zIndex = "99999";
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.gap = "10px";
      container.style.alignItems = "stretch";
      container.style.pointerEvents = "none";
      container.style.maxWidth = "390px";
      container.style.width = "calc(100vw - 32px)";
      document.body.appendChild(container);
    }

    return container;
  }

  function getTypeConfig(type) {
    const t = String(type || "info").toLowerCase();

    if (t === "success") {
      return {
        border: "#14532d",
        bg: "#166534",
        color: "#ffffff",
        icon: "✓",
        progress: "rgba(255,255,255,.45)"
      };
    }

    if (t === "danger" || t === "error") {
      return {
        border: "#7f1d1d",
        bg: "#991b1b",
        color: "#ffffff",
        icon: "✕",
        progress: "rgba(255,255,255,.42)"
      };
    }

    if (t === "warning") {
      return {
        border: "#92400e",
        bg: "#b45309",
        color: "#ffffff",
        icon: "!",
        progress: "rgba(255,255,255,.40)"
      };
    }

    return {
      border: "#1e3a8a",
      bg: "#1d4ed8",
      color: "#ffffff",
      icon: "i",
      progress: "rgba(255,255,255,.40)"
    };
  }

  function removeToast(toast) {
    if (!toast || !toast.parentNode) return;

    toast.style.opacity = "0";
    toast.style.transform = "translateX(18px) scale(0.98)";

    setTimeout(() => {
      try {
        toast.remove();
      } catch {}
    }, 220);
  }

  function showToastTop(type, html, timeout = 3000) {
    const container = ensureContainer();
    const cfg = getTypeConfig(type);

    const toast = document.createElement("div");
    toast.style.pointerEvents = "auto";
    toast.style.position = "relative";
    toast.style.overflow = "hidden";
    toast.style.display = "flex";
    toast.style.alignItems = "center";
    toast.style.gap = "12px";
    toast.style.background = cfg.bg;
    toast.style.color = cfg.color;
    toast.style.borderLeft = `5px solid ${cfg.border}`;
    toast.style.borderRadius = "16px";
    toast.style.padding = "14px 16px";
    toast.style.boxShadow = "0 12px 30px rgba(0,0,0,.38)";
    toast.style.fontSize = "14px";
    toast.style.lineHeight = "1.45";
    toast.style.fontWeight = "500";
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    toast.style.transition = "opacity .22s ease, transform .22s ease";
    toast.style.width = "100%";
    toast.style.boxSizing = "border-box";
    toast.style.backdropFilter = "blur(4px)";

    const icon = document.createElement("div");
    icon.textContent = cfg.icon;
    icon.style.width = "30px";
    icon.style.height = "30px";
    icon.style.display = "flex";
    icon.style.alignItems = "center";
    icon.style.justifyContent = "center";
    icon.style.borderRadius = "999px";
    icon.style.border = "2px solid rgba(255,255,255,.92)";
    icon.style.fontSize = "16px";
    icon.style.fontWeight = "700";
    icon.style.lineHeight = "1";
    icon.style.flex = "0 0 30px";
    icon.style.color = "#ffffff";
    icon.style.background = "rgba(255,255,255,.08)";
    icon.style.boxSizing = "border-box";

    const body = document.createElement("div");
    body.style.flex = "1 1 auto";
    body.style.minWidth = "0";
    body.style.display = "flex";
    body.style.alignItems = "center";

    const text = document.createElement("div");
    text.style.width = "100%";
    text.style.whiteSpace = "normal";
    text.style.wordBreak = "break-word";
    text.style.lineHeight = "1.45";
    text.innerHTML = html || "";

    const close = document.createElement("button");
    close.type = "button";
    close.innerHTML = "&times;";
    close.setAttribute("aria-label", "Fechar notificação");
    close.style.background = "transparent";
    close.style.border = "0";
    close.style.color = cfg.color;
    close.style.fontSize = "22px";
    close.style.lineHeight = "1";
    close.style.cursor = "pointer";
    close.style.padding = "0";
    close.style.margin = "0 0 0 8px";
    close.style.opacity = ".88";
    close.style.flex = "0 0 auto";
    close.style.alignSelf = "center";
    close.style.transition = "opacity .15s ease, transform .15s ease";

    close.addEventListener("mouseenter", () => {
      close.style.opacity = "1";
      close.style.transform = "scale(1.08)";
    });

    close.addEventListener("mouseleave", () => {
      close.style.opacity = ".88";
      close.style.transform = "scale(1)";
    });

    close.addEventListener("click", () => {
      removeToast(toast);
    });

    const progress = document.createElement("div");
    progress.style.position = "absolute";
    progress.style.left = "0";
    progress.style.bottom = "0";
    progress.style.height = "3px";
    progress.style.width = "100%";
    progress.style.background = cfg.progress;
    progress.style.transformOrigin = "left center";
    progress.style.transform = "scaleX(1)";
    progress.style.transition = `transform ${Number(timeout || 0)}ms linear`;

    body.appendChild(text);

    toast.appendChild(icon);
    toast.appendChild(body);
    toast.appendChild(close);
    toast.appendChild(progress);
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateX(0)";
    });

    requestAnimationFrame(() => {
      progress.style.transform = "scaleX(0)";
    });

    const ttl = Number(timeout || 0);
    if (ttl > 0) {
      setTimeout(() => {
        removeToast(toast);
      }, ttl);
    }

    return toast;
  }

  window.showToastTop = showToastTop;
})();