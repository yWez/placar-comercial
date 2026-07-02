const INDIVIDUAL_URL_VENDAS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmVbNM2gBp5BzWLEVmp4gXvXLX9B-Lv62vqXiTLfN1IJ26uhe8M9fbudwtJVP4WVCQVdW7qd_NnewY/pub?gid=1899560077&single=true&output=csv";
const INDIVIDUAL_META = 250000;
const INDIVIDUAL_MAX = 1000000;
let individualChart = null;

function iBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function iSet(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function iNorm(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function iValor(value) {
  const number = Number(String(value || "").replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
  return number > INDIVIDUAL_MAX ? 0 : number;
}

function iParseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field || row.length) {
    row.push(field.trim());
    rows.push(row);
  }

  const clean = rows.filter(r => r.some(c => String(c).trim() !== ""));
  const header = clean.shift() || [];

  return clean.map(r => {
    const obj = {};
    header.forEach((h, i) => obj[String(h || "").trim()] = r[i] || "");
    return obj;
  });
}

function iOrdenarData(a, b) {
  const [da, ma] = a.split("/").map(Number);
  const [db, mb] = b.split("/").map(Number);
  if (ma !== mb) return ma - mb;
  return da - db;
}

function iMontarBase(rows) {
  const ignorar = new Set(["total vendido/dia", "total vendido/mes", "total vendido/mês", "meta", "faltando", "meta diaria", "meta diária"]);
  const mesAtual = String(new Date().getMonth() + 1).padStart(2, "0");
  const dias = Object.keys(rows[0] || {})
    .filter(c => /^\d{2}\/\d{2}$/.test(c) && c.endsWith(`/${mesAtual}`))
    .sort(iOrdenarData);
  const vendedores = rows.filter(row => row.Closer && !ignorar.has(iNorm(row.Closer)));
  return { dias, vendedores };
}

function iStreak(dias, row) {
  let atual = 0;
  let melhor = 0;
  dias.forEach(day => {
    if (iValor(row[day]) > 0) {
      atual += 1;
      melhor = Math.max(melhor, atual);
    } else {
      atual = 0;
    }
  });
  return { atual, melhor };
}

function iSemanaKey(day) {
  const [d, m] = day.split("/").map(Number);
  const date = new Date(2026, m - 1, d);
  const start = new Date(2026, 0, 1);
  return Math.ceil((((date - start) / 86400000) + start.getDay() + 1) / 7);
}

function iRenderSelect(base) {
  const select = document.getElementById("filtroCloserIndividual");
  if (!select) return;

  const atual = localStorage.getItem("closerIndividual") || select.value;
  select.innerHTML = base.vendedores.map(row => {
    const nome = String(row.Closer).trim();
    return `<option value="${nome}">${nome}</option>`;
  }).join("");

  if ([...select.options].some(option => option.value === atual)) select.value = atual;
  select.onchange = () => {
    localStorage.setItem("closerIndividual", select.value);
    iRenderIndividual(base, select.value);
  };
}

function iRenderIndividual(base, nomeSelecionado) {
  const row = base.vendedores.find(v => String(v.Closer).trim() === nomeSelecionado) || base.vendedores[0];
  if (!row) return;

  const nome = String(row.Closer).trim();
  const valores = base.dias.map(day => ({ day, value: iValor(row[day]) }));
  const total = valores.reduce((sum, item) => sum + item.value, 0);
  const diasAtivos = valores.filter(item => item.value > 0);
  const media = total / Math.max(diasAtivos.length, 1);
  const melhor = [...valores].sort((a, b) => b.value - a.value)[0];
  const piorComVenda = [...diasAtivos].sort((a, b) => a.value - b.value)[0];
  const hoje = new Date();
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const diaAtual = Math.max(hoje.getDate(), 1);
  const projecao = (total / diaAtual) * diasNoMes;
  const streak = iStreak(base.dias, row);

  const semanas = new Map();
  valores.forEach(item => {
    const key = iSemanaKey(item.day);
    semanas.set(key, (semanas.get(key) || 0) + item.value);
  });
  const melhorSemana = [...semanas.entries()].sort((a, b) => b[1] - a[1])[0];

  iSet("individualNome", nome);
  iSet("individualTotal", iBRL(total));
  iSet("individualMedia", iBRL(media));
  iSet("individualProjecao", iBRL(projecao));
  iSet("individualDiasAtivos", `${diasAtivos.length} dias`);
  iSet("individualMelhorDia", melhor ? `${melhor.day} • ${iBRL(melhor.value)}` : "-");
  iSet("individualPiorDia", piorComVenda ? `${piorComVenda.day} • ${iBRL(piorComVenda.value)}` : "-");
  iSet("individualMelhorSemana", melhorSemana ? `Semana ${melhorSemana[0]} • ${iBRL(melhorSemana[1])}` : "-");
  iSet("individualStreak", `${streak.melhor} dias`);

  iRenderChart(nome, valores);
}

function iRenderChart(nome, valores) {
  const canvas = document.getElementById("individualChart");
  if (!canvas || typeof Chart === "undefined") return;

  const existing = Chart.getChart ? Chart.getChart(canvas) : null;
  if (existing) existing.destroy();
  if (individualChart) individualChart.destroy();

  const acumulado = [];
  let acc = 0;
  valores.forEach(item => {
    acc += item.value;
    acumulado.push(acc);
  });

  individualChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: valores.map(item => item.day),
      datasets: [
        {
          label: `Diário - ${nome}`,
          data: valores.map(item => item.value),
          borderColor: "#0ea5e9",
          backgroundColor: "rgba(14,165,233,.13)",
          fill: true,
          tension: .35,
          yAxisID: "y"
        },
        {
          label: "Acumulado",
          data: acumulado,
          borderColor: "#6366f1",
          borderWidth: 3,
          pointRadius: 0,
          tension: .3,
          yAxisID: "y1"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: "#334155", font: { weight: "700" } } },
        tooltip: { callbacks: { label: context => `${context.dataset.label}: ${iBRL(context.raw)}` } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: iBRL } },
        y1: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false }, ticks: { callback: iBRL } }
      }
    }
  });
}

async function individualInit() {
  try {
    const response = await fetch(`${INDIVIDUAL_URL_VENDAS}&individual=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Erro ao buscar vendas individuais: ${response.status}`);
    const csv = await response.text();
    const rows = iParseCSV(csv);
    const base = iMontarBase(rows);
    iRenderSelect(base);
    const selected = document.getElementById("filtroCloserIndividual")?.value;
    iRenderIndividual(base, selected);
  } catch (error) {
    console.error("Erro no painel individual:", error);
    iSet("individualNome", "Erro ao carregar");
  }
}

function carregarFiltroMesAtual() {
  const existente = document.querySelector('script[data-month-filter="true"]');
  if (existente) return;
  const script = document.createElement("script");
  script.src = `month-filter.js?v=1&t=${Date.now()}`;
  script.dataset.monthFilter = "true";
  document.body.appendChild(script);
}

individualInit();
setInterval(individualInit, 300000);
carregarFiltroMesAtual();
