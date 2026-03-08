// /static/js/app_toasts.js
(function(){
  function ensureStack(){
    let stack = document.getElementById("toastStack");
    if (!stack){
      stack = document.createElement("div");
      stack.className = "toast-stack";
      stack.id = "toastStack";
      document.body.appendChild(stack);
    }
    return stack;
  }

  function makeToast(type, html){
    const t = document.createElement("div");
    t.className = `toast ${type || ""}`.trim();

    const ico = document.createElement("div");
    ico.className = "ico";

    const i = document.createElement("i");
    if ((type || "").toLowerCase() === "danger"){
      i.className = "bi bi-x-lg";
    } else {
      i.className = "bi bi-check-lg";
    }
    ico.appendChild(i);

    const txt = document.createElement("div");
    txt.className = "txt";
    txt.innerHTML = html || "";

    t.appendChild(ico);
    t.appendChild(txt);
    return t;
  }

  window.showToastTop = function(type, html){
    const stack = ensureStack();
    const toast = makeToast(type, html);

    stack.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 220);
    }, 3000);
  };

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", ensureStack);
  } else {
    ensureStack();
  }
})();