const MONTH_FILTER_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmVbNM2gBp5BzWLEVmp4gXvXLX9B-Lv62vqXiTLfN1IJ26uhe8M9fbudwtJVP4WVCQVdW7qd_NnewY/pub?gid=1899560077&single=true&output=csv";
const MONTH_FILTER_META = 250000;
const MONTH_FILTER_MAX = 1000000;
let monthFilterReceitaChart = null;
let monthFilterIndividualChart = null;

function mfBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function mfSet(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function mfNorm(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function mfValor(value) {
  const number = Number(String(value || "").replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
  return number > MONTH_FILTER_MAX ? 0 : number;
}

function mfParseCSV(text) {
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

function mfOrdenarData(a, b) {
  const [da, ma] = a.split("/").map(Number);
  const [db, mb] = b.split("/").map(Number);
  if (ma !== mb) return ma - mb;
  return da - db;
}

function mfBase(rows) {
  const mesAtual = String(new Date().getMonth() + 1).padStart(2, "0");
  const ignorar = new Set(["total vendido/dia", "total vendido/mes", "total vendido/mês", "meta", "faltando", "meta diaria", "meta diária"]);

  const todosDias = Object.keys(rows[0] || {}).filter(c => /^\d{2}\/\d{2}$/.test(c)).sort(mfOrdenarData);
  const dias = todosDias.filter(day => day.endsWith(`/${mesAtual}`));
  const vendedores = rows.filter(row => row.Closer && !ignorar.has(mfNorm(row.Closer)));

  const totalDia = {};
  dias.forEach(day => {
    totalDia[day] = vendedores.reduce((sum, row) => sum + mfValor(row[day]), 0);
  });

  const ranking = vendedores.map(row => ({
    nome: String(row.Closer).trim(),
    total: dias.reduce((sum, day) => sum + mfValor(row[day]), 0),
    row
  })).sort((a, b) => b.total - a.total);

  return { dias, vendedores, totalDia, ranking, mesAtual };
}

function mfAtualizarVendas(base) {
  const hoje = new Date();
  const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const vendido = base.ranking.reduce((sum, item) => sum + item.total, 0);
  const pct = MONTH_FILTER_META ? (vendido / MONTH_FILTER_META) * 100 : 0;
  const falta = Math.max(MONTH_FILTER_META - vendido, 0);
  const metaDia = MONTH_FILTER_META / ultimoDiaMes;

  let ultimo = null;
  base.dias.forEach(day => {
    if (base.totalDia[day] > 0) ultimo = day;
  });

  mfSet("meta", mfBRL(MONTH_FILTER_META));
  mfSet("vendido", mfBRL(vendido));
  mfSet("falta", mfBRL(falta));
  mfSet("percentual", `${pct.toFixed(2)}%`);
  mfSet("percentualBarra", `${pct.toFixed(2)}%`);
  mfSet("hoje", mfBRL(ultimo ? base.totalDia[ultimo] : 0));
  mfSet("metaDia", mfBRL(metaDia));

  const barra = document.getElementById("barra");
  if (barra) barra.style.width = `${Math.min(pct, 100)}%`;

  const lider = document.getElementById("liderMes");
  if (lider) {
    const top = base.ranking[0];
    lider.innerHTML = top?.total > 0
      ? `<div class="leader-sub">Melhor closer acumulado no mês atual</div><div class="leader-main">🥇 ${top.nome} - ${mfBRL(top.total)}</div>`
      : "Nenhum dado disponível para o mês atual.";
  }

  const rankingBox = document.getElementById("ranking");
  if (rankingBox) {
    const m = ["🥇", "🥈", "🥉", "🏅"];
    rankingBox.innerHTML = base.ranking.map((item, index) => `
      <div class="rank-card">
        <div class="rank-top">${m[index] || "🏅"} ${item.nome}</div>
        <div class="rank-value">${mfBRL(item.total)}</div>
        <div class="rank-meta">${index + 1}º lugar no mês atual</div>
      </div>
    `).join("");
  }

  const tabelaBox = document.getElementById("tabela");
  if (tabelaBox) {
    tabelaBox.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Closer</th>
            ${base.dias.map(day => `<th>${day}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${base.vendedores.map(row => `
            <tr>
              <td>${row.Closer}</td>
              ${base.dias.map(day => `<td>${mfBRL(mfValor(row[day]))}</td>`).join("")}
            </tr>
          `).join("")}
          <tr class="total-row">
            <td>Total vendido/dia</td>
            ${base.dias.map(day => `<td>${mfBRL(base.totalDia[day])}</td>`).join("")}
          </tr>
        </tbody>
      </table>
    `;
  }

  mfRenderReceitaChart(base);
}

function mfRenderReceitaChart(base) {
  const canvas = document.getElementById("receitaChart");
  if (!canvas || typeof Chart === "undefined") return;

  const existing = Chart.getChart ? Chart.getChart(canvas) : null;
  if (existing) existing.destroy();
  if (monthFilterReceitaChart) monthFilterReceitaChart.destroy();

  let acc = 0;
  const real = base.dias.map(day => acc += base.totalDia[day]);
  const meta = base.dias.map((_, i) => MONTH_FILTER_META / Math.max(base.dias.length, 1) * (i + 1));

  monthFilterReceitaChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: base.dias,
      datasets: [
        { label: "Realizado", data: real, borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,.12)", fill: true, tension: .35 },
        { label: "Meta ideal", data: meta, borderColor: "#ef4444", borderDash: [8, 6], pointRadius: 0 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { callback: mfBRL } } } }
  });
}

function mfAtualizarIndividual(base) {
  const select = document.getElementById("filtroCloserIndividual");
  if (!select || !base.vendedores.length) return;

  const atual = localStorage.getItem("closerIndividual") || select.value || String(base.vendedores[0].Closer).trim();
  select.innerHTML = base.vendedores.map(row => {
    const nome = String(row.Closer).trim();
    return `<option value="${nome}">${nome}</option>`;
  }).join("");
  if ([...select.options].some(option => option.value === atual)) select.value = atual;

  select.onchange = () => {
    localStorage.setItem("closerIndividual", select.value);
    mfRenderIndividual(base, select.value);
  };

  mfRenderIndividual(base, select.value);
}

function mfRenderIndividual(base, nome) {
  const row = base.vendedores.find(v => String(v.Closer).trim() === nome) || base.vendedores[0];
  if (!row) return;

  const valores = base.dias.map(day => ({ day, value: mfValor(row[day]) }));
  const total = valores.reduce((sum, item) => sum + item.value, 0);
  const ativos = valores.filter(item => item.value > 0);
  const media = total / Math.max(ativos.length, 1);
  const melhor = [...valores].sort((a, b) => b.value - a.value)[0];
  const pior = [...ativos].sort((a, b) => a.value - b.value)[0];
  const hoje = new Date();
  const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const projecao = (total / Math.max(hoje.getDate(), 1)) * ultimoDiaMes;

  let streakAtual = 0;
  let streakMelhor = 0;
  valores.forEach(item => {
    if (item.value > 0) {
      streakAtual += 1;
      streakMelhor = Math.max(streakMelhor, streakAtual);
    } else {
      streakAtual = 0;
    }
  });

  mfSet("individualNome", String(row.Closer).trim());
  mfSet("individualTotal", mfBRL(total));
  mfSet("individualMedia", mfBRL(media));
  mfSet("individualProjecao", mfBRL(projecao));
  mfSet("individualDiasAtivos", `${ativos.length} dias`);
  mfSet("individualMelhorDia", melhor ? `${melhor.day} • ${mfBRL(melhor.value)}` : "-");
  mfSet("individualPiorDia", pior ? `${pior.day} • ${mfBRL(pior.value)}` : "-");
  mfSet("individualMelhorSemana", "Mês atual");
  mfSet("individualStreak", `${streakMelhor} dias`);

  const canvas = document.getElementById("individualChart");
  if (!canvas || typeof Chart === "undefined") return;
  const existing = Chart.getChart ? Chart.getChart(canvas) : null;
  if (existing) existing.destroy();
  if (monthFilterIndividualChart) monthFilterIndividualChart.destroy();

  let acc = 0;
  const acumulado = valores.map(item => acc += item.value);

  monthFilterIndividualChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: valores.map(item => item.day),
      datasets: [
        { label: `Diário - ${row.Closer}`, data: valores.map(item => item.value), borderColor: "#0ea5e9", backgroundColor: "rgba(14,165,233,.13)", fill: true, tension: .35, yAxisID: "y" },
        { label: "Acumulado", data: acumulado, borderColor: "#6366f1", borderWidth: 3, pointRadius: 0, tension: .3, yAxisID: "y1" }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { tooltip: { callbacks: { label: context => `${context.dataset.label}: ${mfBRL(context.raw)}` } } },
      scales: {
        y: { beginAtZero: true, ticks: { callback: mfBRL } },
        y1: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false }, ticks: { callback: mfBRL } }
      }
    }
  });
}

async function monthFilterInit() {
  try {
    const response = await fetch(`${MONTH_FILTER_URL}&monthFilter=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Erro ao buscar vendas: ${response.status}`);
    const csv = await response.text();
    const rows = mfParseCSV(csv);
    const base = mfBase(rows);

    mfAtualizarVendas(base);
    mfAtualizarIndividual(base);
  } catch (error) {
    console.error("Erro no filtro automático de mês:", error);
  }
}

setTimeout(monthFilterInit, 900);
setInterval(monthFilterInit, 300000);
