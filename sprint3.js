function sprint3AtualizarRelatorio() {
  const data = new Date();
  const dataFormatada = data.toLocaleString("pt-BR");
  const elData = document.getElementById("reportData");
  const elMes = document.getElementById("reportMes");
  const mesAtual = document.getElementById("mesAtual")?.textContent || "-";

  if (elData) elData.textContent = dataFormatada;
  if (elMes) elMes.textContent = mesAtual;
}

function sprint3ExportarPDF() {
  sprint3AtualizarRelatorio();
  document.body.classList.add("report-mode");
  setTimeout(() => {
    window.print();
    setTimeout(() => document.body.classList.remove("report-mode"), 600);
  }, 250);
}

function sprint3AlternarCompacto() {
  document.body.classList.toggle("compact-mode");
  const ativo = document.body.classList.contains("compact-mode");
  localStorage.setItem("placarCompactMode", ativo ? "1" : "0");
  const btn = document.getElementById("modoCompactoBtn");
  if (btn) btn.textContent = ativo ? "Modo normal" : "Modo compacto";

  setTimeout(() => {
    window.dispatchEvent(new Event("resize"));
  }, 150);
}

function carregarScriptSprint3(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `${src}?v=${Date.now()}`;
    s.onload = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

async function sprint3CarregarReembolsos() {
  if (!document.querySelector('link[href^="refund-dashboard.css"]')) {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `refund-dashboard.css?v=${Date.now()}`;
    document.head.appendChild(css);
  }

  try {
    await carregarScriptSprint3("refund-dashboard.js");
  } catch (e) {
    console.error("Erro ao carregar dashboard de reembolsos:", e);
  }
}

function sprint3Init() {
  const btnPdf = document.getElementById("exportarPdfBtn");
  const btnCompacto = document.getElementById("modoCompactoBtn");

  if (localStorage.getItem("placarCompactMode") === "1") {
    document.body.classList.add("compact-mode");
    if (btnCompacto) btnCompacto.textContent = "Modo normal";
  }

  if (btnPdf) btnPdf.addEventListener("click", sprint3ExportarPDF);
  if (btnCompacto) btnCompacto.addEventListener("click", sprint3AlternarCompacto);

  sprint3AtualizarRelatorio();
  setInterval(sprint3AtualizarRelatorio, 60000);
  sprint3CarregarReembolsos();
}

sprint3Init();
