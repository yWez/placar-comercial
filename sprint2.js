const SPRINT2_URL_VENDAS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmVbNM2gBp5BzWLEVmp4gXvXLX9B-Lv62vqXiTLfN1IJ26uhe8M9fbudwtJVP4WVCQVdW7qd_NnewY/pub?gid=1899560077&single=true&output=csv";
const SPRINT2_MAX = 1000000;
let sprint2RankingChart = null;

function s2BRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function s2Set(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function s2Norm(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function s2Valor(value) {
  const number = Number(String(value || "").replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
  return number > SPRINT2_MAX ? 0 : number;
}

function s2ParseCSV(text) {
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

function s2OrdenarData(a, b) {
  const [da, ma] = a.split("/").map(Number);
  const [db, mb] = b.split("/").map(Number);
  if (ma !== mb) return ma - mb;
  return da - db;
}

function s2DiaSemana(label) {
  const [day, month] = label.split("/").map(Number);
  const date = new Date(2026, month - 1, day);
  return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][date.getDay()];
}

function s2MontarBase(rows) {
  const ignorar = new Set(["total vendido/dia", "total vendido/mes", "total vendido/mês", "meta", "faltando", "meta diaria", "meta diária"]);
  const dias = Object.keys(rows[0] || {}).filter(c => /^\d{2}\/\d{2}$/.test(c)).sort(s2OrdenarData);
  const vendedores = rows.filter(r => r.Closer && !ignorar.has(s2Norm(r.Closer)));
  const closers = vendedores.map(r => String(r.Closer).trim());

  const totalDia = {};
  dias.forEach(dia => {
    totalDia[dia] = vendedores.reduce((sum, row) => sum + s2Valor(row[dia]), 0);
  });

  const totalPorCloser = vendedores.map(row => ({
    nome: String(row.Closer).trim(),
    total: dias.reduce((sum, dia) => sum + s2Valor(row[dia]), 0),
    row
  })).sort((a, b) => b.total - a.total);

  return { dias, vendedores, closers, totalDia, totalPorCloser };
}

function s2RankingAteDia(base, diasUsados) {
  return base.vendedores.map(row => ({
    nome: String(row.Closer).trim(),
    total: diasUsados.reduce((sum, dia) => sum + s2Valor(row[dia]), 0)
  })).sort((a, b) => b.total - a.total);
}

function s2RenderRankingEvolucao(base) {
  const box = document.getElementById("rankingEvolucao");
  if (!box) return;

  const diasComVenda = base.dias.filter(d => base.totalDia[d] > 0);
  const diasAntes = diasComVenda.slice(0, -1);
  const rankingAtual = s2RankingAteDia(base, diasComVenda);
  const rankingAnterior = s2RankingAteDia(base, diasAntes.length ? diasAntes : diasComVenda);
  const posAnterior = new Map(rankingAnterior.map((item, index) => [item.nome, index + 1]));

  box.innerHTML = rankingAtual.map((item, index) => {
    const posAtual = index + 1;
    const posAnt = posAnterior.get(item.nome) || posAtual;
    const movimento = posAnt - posAtual;
    let tag = "→";
    let cls = "flat";
    if (movimento > 0) { tag = `↑${movimento}`; cls = "up"; }
    if (movimento < 0) { tag = `↓${Math.abs(movimento)}`; cls = "down"; }

    return `
      <div class="evolucao-card">
        <div class="evolucao-pos">#${posAtual}</div>
        <div class="evolucao-body">
          <strong>${item.nome}</strong>
          <span>${s2BRL(item.total)}</span>
        </div>
        <div class="move-tag ${cls}">${tag}</div>
      </div>
    `;
  }).join("");

  const canvas = document.getElementById("rankingEvolucaoChart");
  if (!canvas || typeof Chart === "undefined") return;
  if (sprint2RankingChart) sprint2RankingChart.destroy();

  sprint2RankingChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: rankingAtual.map(item => item.nome),
      datasets: [{
        label: "Total vendido",
        data: rankingAtual.map(item => item.total),
        backgroundColor: "rgba(99,102,241,.72)",
        borderColor: "#6366f1",
        borderWidth: 2,
        borderRadius: 12
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { callback: s2BRL } } }
    }
  });
}

function s2RenderHeatmap(base) {
  const box = document.getElementById("heatmapComercial");
  if (!box) return;

  const diasSemana = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const matriz = base.vendedores.map(row => {
    const valores = Object.fromEntries(diasSemana.map(d => [d, 0]));
    base.dias.forEach(dia => {
      const semana = s2DiaSemana(dia);
      valores[semana] += s2Valor(row[dia]);
    });
    return { nome: String(row.Closer).trim(), valores };
  });

  const max = Math.max(...matriz.flatMap(item => diasSemana.map(d => item.valores[d])), 1);

  box.innerHTML = `
    <div class="heatmap-table">
      <div class="heatmap-row heatmap-head">
        <div>Closer</div>
        ${diasSemana.map(d => `<div>${d}</div>`).join("")}
      </div>
      ${matriz.map(item => `
        <div class="heatmap-row">
          <div class="heatmap-name">${item.nome}</div>
          ${diasSemana.map(dia => {
            const valor = item.valores[dia];
            const intensidade = Math.min(valor / max, 1);
            return `<div class="heat-cell" style="--heat:${intensidade.toFixed(2)}" title="${item.nome} • ${dia}: ${s2BRL(valor)}"><strong>${s2BRL(valor)}</strong></div>`;
          }).join("")}
        </div>
      `).join("")}
    </div>
  `;
}

function s2RenderInsights(base) {
  const box = document.getElementById("insightsAutomaticos");
  if (!box) return;

  const ranking = base.totalPorCloser;
  const total = ranking.reduce((sum, item) => sum + item.total, 0);
  const media = ranking.length ? total / ranking.length : 0;
  const lider = ranking[0];
  const ultimo = ranking[ranking.length - 1];

  const diasComVenda = base.dias.filter(d => base.totalDia[d] > 0);
  const melhorDia = [...base.dias].sort((a, b) => base.totalDia[b] - base.totalDia[a])[0];
  const ultimoDia = diasComVenda[diasComVenda.length - 1];
  const penultimoDia = diasComVenda[diasComVenda.length - 2];
  const crescimentoUltimoDia = ultimoDia && penultimoDia ? base.totalDia[ultimoDia] - base.totalDia[penultimoDia] : 0;
  const participacaoLider = total > 0 && lider ? (lider.total / total) * 100 : 0;

  const melhoresSemana = {};
  base.dias.forEach(d => {
    const semana = s2DiaSemana(d);
    melhoresSemana[semana] = (melhoresSemana[semana] || 0) + base.totalDia[d];
  });
  const melhorSemana = Object.entries(melhoresSemana).sort((a, b) => b[1] - a[1])[0];

  const insights = [];
  if (lider) insights.push({ icon: "👑", title: `${lider.nome} lidera o mês`, text: `${s2BRL(lider.total)} vendidos, representando ${participacaoLider.toFixed(1)}% do total.` });
  if (lider && media > 0) insights.push({ icon: "🚀", title: "Acima da média", text: `${lider.nome} está ${(((lider.total - media) / media) * 100).toFixed(1)}% acima da média do time.` });
  if (melhorDia) insights.push({ icon: "🔥", title: `Melhor dia: ${melhorDia}`, text: `O time vendeu ${s2BRL(base.totalDia[melhorDia])} nesse dia.` });
  if (melhorSemana) insights.push({ icon: "📆", title: `${melhorSemana[0]} é o melhor dia da semana`, text: `Somando ${s2BRL(melhorSemana[1])} em vendas no período analisado.` });
  if (ultimo && lider && ultimo.nome !== lider.nome) insights.push({ icon: "🎯", title: "Oportunidade de gestão", text: `${ultimo.nome} está com o menor acumulado. Pode valer uma análise de cadência e volume.` });
  if (ultimoDia && penultimoDia) insights.push({ icon: crescimentoUltimoDia >= 0 ? "📈" : "📉", title: `Último dia vs anterior`, text: `${crescimentoUltimoDia >= 0 ? "Crescimento" : "Queda"} de ${s2BRL(Math.abs(crescimentoUltimoDia))} em relação ao dia anterior com venda.` });

  box.innerHTML = insights.slice(0, 6).map(insight => `
    <div class="insight-card">
      <div class="insight-icon">${insight.icon}</div>
      <div>
        <strong>${insight.title}</strong>
        <p>${insight.text}</p>
      </div>
    </div>
  `).join("");
}

async function sprint2Init() {
  try {
    const response = await fetch(`${SPRINT2_URL_VENDAS}&sprint2=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Erro ao buscar vendas sprint 2: ${response.status}`);
    const csv = await response.text();
    const rows = s2ParseCSV(csv);
    const base = s2MontarBase(rows);

    s2RenderHeatmap(base);
    s2RenderRankingEvolucao(base);
    s2RenderInsights(base);
  } catch (error) {
    console.error("Erro no Sprint 2:", error);
    s2Set("sprint2Status", "Erro ao carregar Sprint 2");
  }
}

sprint2Init();
setInterval(sprint2Init, 300000);
