const REFUND_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmVbNM2gBp5BzWLEVmp4gXvXLX9B-Lv62vqXiTLfN1IJ26uhe8M9fbudwtJVP4WVCQVdW7qd_NnewY/pub?gid=1242126290&single=true&output=csv";

let refundChart = null;
let refundDataCache = [];

const REFUND_AFFILIATE_NAMES = {
  al: "Analu",
  es: "Esterzinha",
  jn: "Julesco",
  ws: "Wes"
};

const REFUND_MONTH_ORDER = [
  "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
];

const refundBrl = n => Number(n || 0).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const refundNorm = value => String(value || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

const refundEscape = value => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

function refundParseMoney(value) {
  const raw = String(value ?? "")
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .trim();

  if (!raw) return 0;

  let normalized = raw;
  if (raw.includes(",")) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  }

  const parsed = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function refundParseCSV(text) {
  if (typeof parseCSV === "function") return parseCSV(text);

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
      if (row.some(cell => String(cell).trim() !== "")) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field || row.length) {
    row.push(field.trim());
    if (row.some(cell => String(cell).trim() !== "")) rows.push(row);
  }

  const headers = rows.shift() || [];
  return rows.map(values => headers.reduce((obj, header, index) => {
    obj[String(header || "").trim()] = values[index] || "";
    return obj;
  }, {}));
}

function refundMonthIndex(month) {
  const idx = REFUND_MONTH_ORDER.indexOf(refundNorm(month));
  return idx === -1 ? 99 : idx;
}

function refundSourceLabel(code) {
  const normalized = refundNorm(code);
  if (!normalized) return "Sem afiliação";
  return REFUND_AFFILIATE_NAMES[normalized] || normalized.toUpperCase();
}

function refundDeltaClass(value) {
  return Math.abs(value) < 0.01 ? "refund-neutral" : (value > 0 ? "refund-up" : "refund-down");
}

function refundDeltaMoney(value) {
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${refundBrl(Math.abs(value))}`;
}

function refundDeltaCount(value) {
  return `${value > 0 ? "+" : ""}${Number(value || 0).toLocaleString("pt-BR")}`;
}

function refundPct(value, base) {
  return base ? `${((value / base) * 100).toFixed(1).replace(".", ",")}%` : "0%";
}

function refundFindMonth(name) {
  return refundDataCache.find(item => item.month === name) || refundDataCache[0];
}

function refundAggregate(rows) {
  const map = new Map();

  rows.forEach(row => {
    const month = String(row["Mês"] || row["Mes"] || "").trim();
    if (!month) return;

    const value = refundParseMoney(row["Valor"] || row["Valor (R$)"] || 0);
    const sourceCode = refundNorm(row["Afiliacao"] || row["Afiliação"] || "") || "sem-afiliacao";
    const motive = String(row["Motivo"] || "").trim() || "Não informado";

    if (!map.has(month)) {
      map.set(month, {
        month,
        count: 0,
        value: 0,
        avg: 0,
        sourcesMap: new Map(),
        motivesMap: new Map()
      });
    }

    const item = map.get(month);
    item.count += 1;
    item.value += value;

    if (!item.sourcesMap.has(sourceCode)) {
      item.sourcesMap.set(sourceCode, {
        code: sourceCode,
        name: refundSourceLabel(sourceCode),
        count: 0,
        value: 0
      });
    }

    const source = item.sourcesMap.get(sourceCode);
    source.count += 1;
    source.value += value;

    if (!item.motivesMap.has(motive)) {
      item.motivesMap.set(motive, { motive, count: 0, value: 0 });
    }
    const motiveItem = item.motivesMap.get(motive);
    motiveItem.count += 1;
    motiveItem.value += value;
  });

  return [...map.values()]
    .map(item => ({
      month: item.month,
      count: item.count,
      value: item.value,
      avg: item.count ? item.value / item.count : 0,
      sources: [...item.sourcesMap.values()].sort((a, b) => b.value - a.value),
      motives: [...item.motivesMap.values()].sort((a, b) => b.count - a.count || b.value - a.value)
    }))
    .sort((a, b) => refundMonthIndex(a.month) - refundMonthIndex(b.month));
}

async function refundLoadData() {
  const response = await fetch(`${REFUND_CSV_URL}&t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Erro ${response.status} ao buscar REEMBOLSOS_DASH.`);
  const text = await response.text();
  const rows = refundParseCSV(text);
  refundDataCache = refundAggregate(rows);
  return refundDataCache;
}

function createRefundTab() {
  const nav = document.querySelector(".dashboard-tabs");
  const main = document.querySelector("main.container");
  if (!nav || !main || document.querySelector('[data-tab="reembolsos"]')) return;

  const btn = document.createElement("button");
  btn.className = "tab-btn";
  btn.dataset.tab = "reembolsos";
  btn.textContent = "Reembolsos";
  nav.appendChild(btn);

  const section = document.createElement("section");
  section.className = "refunds-area refunds-hero";
  section.innerHTML = `
    <div class="refund-panel refund-live-panel">
      <div class="refund-panel-header">
        <div>
          <div class="refund-title-line">
            <h3>Reembolsos</h3>
            <span class="refund-live-badge">● Base conectada</span>
          </div>
          <p>Dados lidos diretamente da aba <strong>REEMBOLSOS_DASH</strong> da planilha comercial.</p>
        </div>
        <button id="refundReloadBtn" class="refund-reload-btn" type="button">Atualizar agora</button>
      </div>
      <div id="refundStatus" class="refund-status">Carregando dados da planilha...</div>
      <div id="refundSummary" class="refunds-grid"></div>
    </div>

    <div class="refund-panel">
      <div class="refund-panel-header">
        <div><h3>Comparativo entre meses</h3><p>Compare quantidade, custo e variação dos reembolsos entre quaisquer meses.</p></div>
        <div class="refund-selectors"><select id="refundMonthA"></select><select id="refundMonthB"></select></div>
      </div>
      <div id="refundCompareCards" class="refund-compare-grid"></div>
      <div class="refund-chart-wrap"><canvas id="refundCompareChart"></canvas></div>
    </div>

    <div class="refund-panel">
      <div class="refund-panel-header"><div><h3>Histórico mensal</h3><p>Evolução da quantidade, valor devolvido e ticket médio.</p></div></div>
      <div id="refundMonthlyTable" class="refund-table-wrap"></div>
    </div>

    <div class="refund-panel">
      <div class="refund-panel-header">
        <div><h3 id="refundSourceTitle">Afiliações</h3><p>al = Analu · es = Esterzinha · jn = Julesco · ws = Wes. Outros códigos permanecem visíveis pelo próprio código.</p></div>
      </div>
      <div id="refundSourceGrid" class="refund-source-grid"></div>
    </div>

    <div class="refund-panel">
      <div class="refund-panel-header"><div><h3>Comparativo de afiliações por mês</h3><p>Quantidade e valor de reembolso atribuídos a cada origem ao longo dos meses.</p></div></div>
      <div id="refundAffiliateTable" class="refund-table-wrap"></div>
    </div>

    <div class="refund-panel">
      <div class="refund-panel-header"><div><h3 id="refundMotivesTitle">Motivos de reembolso</h3><p>Principais motivos registrados no mês analisado, sem exibir nomes de leads.</p></div></div>
      <div id="refundMotives" class="refund-motives-grid"></div>
      <div class="refund-note">Esta aba usa somente os campos <strong>Mês</strong>, <strong>Valor</strong>, <strong>Motivo</strong> e <strong>Afiliacao</strong> da base publicada. Nenhum nome de lead é exibido.</div>
    </div>
  `;
  main.appendChild(section);

  const vendas = document.querySelectorAll(".vendas-area");
  const disparos = document.querySelectorAll(".disparos-area");
  const refunds = document.querySelectorAll(".refunds-area");
  refunds.forEach(el => el.style.display = "none");

  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));
    btn.classList.add("active");
    vendas.forEach(el => el.style.display = "none");
    disparos.forEach(el => el.style.display = "none");
    refunds.forEach(el => el.style.display = "block");
    setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
  });

  document.querySelectorAll('.tab-btn:not([data-tab="reembolsos"])').forEach(other => {
    other.addEventListener("click", () => refunds.forEach(el => el.style.display = "none"));
  });
}

function renderRefundSummary() {
  const latest = refundDataCache[refundDataCache.length - 1];
  const previous = refundDataCache[refundDataCache.length - 2] || latest;
  if (!latest) return;

  const countDelta = latest.count - previous.count;
  const valueDelta = latest.value - previous.value;
  const totalCount = refundDataCache.reduce((sum, month) => sum + month.count, 0);
  const totalValue = refundDataCache.reduce((sum, month) => sum + month.value, 0);
  const topSource = latest.sources[0];

  document.getElementById("refundSummary").innerHTML = `
    <div class="refund-card"><span>Reembolsos em ${refundEscape(latest.month)}</span><strong>${latest.count.toLocaleString("pt-BR")}</strong><small class="${refundDeltaClass(countDelta)}">${refundDeltaCount(countDelta)} vs ${refundEscape(previous.month)}</small></div>
    <div class="refund-card"><span>Custo em ${refundEscape(latest.month)}</span><strong>${refundBrl(latest.value)}</strong><small class="${refundDeltaClass(valueDelta)}">${refundDeltaMoney(valueDelta)} vs ${refundEscape(previous.month)}</small></div>
    <div class="refund-card"><span>Ticket médio</span><strong>${refundBrl(latest.avg)}</strong><small>Média por reembolso em ${refundEscape(latest.month)}</small></div>
    <div class="refund-card"><span>Maior origem no mês</span><strong>${topSource ? refundEscape(topSource.name) : "-"}</strong><small>${topSource ? `${topSource.count.toLocaleString("pt-BR")} reembolsos · ${refundBrl(topSource.value)}` : "Sem dados"}</small></div>
    <div class="refund-card"><span>Acumulado do período</span><strong>${totalCount.toLocaleString("pt-BR")}</strong><small>${refundBrl(totalValue)} devolvidos</small></div>
  `;
}

function renderRefundMonthlyTable() {
  const body = refundDataCache.map((month, index) => {
    const previous = refundDataCache[index - 1];
    const countDelta = previous ? month.count - previous.count : 0;
    const valueDelta = previous ? month.value - previous.value : 0;
    const pctValue = previous && previous.value ? (valueDelta / previous.value) * 100 : 0;

    return `
      <tr>
        <td><strong>${refundEscape(month.month)}</strong></td>
        <td>${month.count.toLocaleString("pt-BR")}</td>
        <td>${refundBrl(month.value)}</td>
        <td>${refundBrl(month.avg)}</td>
        <td class="${refundDeltaClass(countDelta)}">${previous ? refundDeltaCount(countDelta) : "-"}</td>
        <td class="${refundDeltaClass(valueDelta)}">${previous ? refundDeltaMoney(valueDelta) : "-"}</td>
        <td class="${refundDeltaClass(pctValue)}">${previous ? `${pctValue > 0 ? "+" : ""}${pctValue.toFixed(1).replace(".", ",")}%` : "-"}</td>
      </tr>`;
  }).join("");

  document.getElementById("refundMonthlyTable").innerHTML = `
    <table class="refund-table">
      <thead><tr><th>Mês</th><th>Quantidade</th><th>Valor reembolsado</th><th>Ticket médio</th><th>Δ qtd.</th><th>Δ valor</th><th>Δ % valor</th></tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}

function renderRefundSource(monthName) {
  const month = refundFindMonth(monthName);
  if (!month) return;

  document.getElementById("refundSourceTitle").textContent = `Afiliações — ${month.month}`;
  document.getElementById("refundSourceGrid").innerHTML = month.sources.map(source => `
    <div class="refund-source-card">
      <span>${refundEscape(source.name)}</span>
      <strong>${source.count.toLocaleString("pt-BR")}</strong>
      <small>${refundBrl(source.value)} · ${refundPct(source.value, month.value)} do custo</small>
    </div>`).join("");
}

function renderRefundAffiliateTable() {
  const sourceCodes = [...new Set(refundDataCache.flatMap(month => month.sources.map(source => source.code)))];
  const rankedCodes = sourceCodes.sort((a, b) => {
    const totalA = refundDataCache.reduce((sum, month) => sum + (month.sources.find(source => source.code === a)?.value || 0), 0);
    const totalB = refundDataCache.reduce((sum, month) => sum + (month.sources.find(source => source.code === b)?.value || 0), 0);
    return totalB - totalA;
  });

  const head = refundDataCache.map(month => `<th>${refundEscape(month.month)}<small>Qtd. / Valor</small></th>`).join("");
  const rows = rankedCodes.map(code => {
    const cells = refundDataCache.map(month => {
      const source = month.sources.find(item => item.code === code);
      return `<td>${source ? `<strong>${source.count.toLocaleString("pt-BR")}</strong><small>${refundBrl(source.value)}</small>` : `<span class="refund-empty">—</span>`}</td>`;
    }).join("");

    const totalCount = refundDataCache.reduce((sum, month) => sum + (month.sources.find(item => item.code === code)?.count || 0), 0);
    const totalValue = refundDataCache.reduce((sum, month) => sum + (month.sources.find(item => item.code === code)?.value || 0), 0);

    return `<tr><td><strong>${refundEscape(refundSourceLabel(code))}</strong><small>${code === "sem-afiliacao" ? "sem código" : refundEscape(code)}</small></td>${cells}<td><strong>${totalCount.toLocaleString("pt-BR")}</strong><small>${refundBrl(totalValue)}</small></td></tr>`;
  }).join("");

  document.getElementById("refundAffiliateTable").innerHTML = `
    <table class="refund-table refund-affiliate-table">
      <thead><tr><th>Afiliação</th>${head}<th>Total<small>Qtd. / Valor</small></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderRefundMotives(monthName) {
  const month = refundFindMonth(monthName);
  if (!month) return;

  document.getElementById("refundMotivesTitle").textContent = `Motivos de reembolso — ${month.month}`;
  const top = month.motives.slice(0, 12);
  document.getElementById("refundMotives").innerHTML = top.map((item, index) => `
    <div class="refund-motive-card">
      <div class="refund-motive-rank">${index + 1}</div>
      <div><strong>${refundEscape(item.motive)}</strong><small>${item.count.toLocaleString("pt-BR")} ocorrências · ${refundBrl(item.value)}</small></div>
    </div>`).join("");
}

function renderRefundComparison() {
  const aSelect = document.getElementById("refundMonthA");
  const bSelect = document.getElementById("refundMonthB");
  if (!aSelect || !bSelect) return;

  const a = refundFindMonth(aSelect.value);
  const b = refundFindMonth(bSelect.value);
  if (!a || !b) return;

  const countDelta = b.count - a.count;
  const valueDelta = b.value - a.value;
  const valuePct = a.value ? (valueDelta / a.value) * 100 : 0;
  const ticketDelta = b.avg - a.avg;
  const better = b.value < a.value ? b.month : a.month;

  document.getElementById("refundCompareCards").innerHTML = `
    <div class="refund-compare-card"><span>${refundEscape(a.month)}</span><strong>${a.count.toLocaleString("pt-BR")} reembolsos</strong><small>${refundBrl(a.value)}</small></div>
    <div class="refund-compare-card"><span>${refundEscape(b.month)}</span><strong>${b.count.toLocaleString("pt-BR")} reembolsos</strong><small>${refundBrl(b.value)}</small></div>
    <div class="refund-compare-card"><span>Diferença de custo</span><strong class="${refundDeltaClass(valueDelta)}">${refundDeltaMoney(valueDelta)}</strong><small class="${refundDeltaClass(countDelta)}">${refundDeltaCount(countDelta)} reembolsos · ${valuePct > 0 ? "+" : ""}${valuePct.toFixed(1).replace(".", ",")}%</small></div>
    <div class="refund-compare-card"><span>Ticket médio</span><strong class="${refundDeltaClass(ticketDelta)}">${refundDeltaMoney(ticketDelta)}</strong><small>Variação do ticket reembolsado</small></div>
    <div class="refund-compare-card"><span>Melhor mês</span><strong>${refundEscape(better)}</strong><small>Menor custo total de reembolso</small></div>`;

  if (refundChart) refundChart.destroy();
  const canvas = document.getElementById("refundCompareChart");
  if (canvas && typeof Chart !== "undefined") {
    refundChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: ["Quantidade", "Valor (R$ mil)", "Ticket médio (R$)"],
        datasets: [
          { label: a.month, data: [a.count, Number((a.value / 1000).toFixed(2)), Number(a.avg.toFixed(2))] },
          { label: b.month, data: [b.count, Number((b.value / 1000).toFixed(2)), Number(b.avg.toFixed(2))] }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  renderRefundSource(b.month);
  renderRefundMotives(b.month);
}

function refundPopulateSelectors() {
  const aSelect = document.getElementById("refundMonthA");
  const bSelect = document.getElementById("refundMonthB");
  if (!aSelect || !bSelect || !refundDataCache.length) return;

  const options = refundDataCache.map(month => `<option value="${refundEscape(month.month)}">${refundEscape(month.month)}</option>`).join("");
  aSelect.innerHTML = options;
  bSelect.innerHTML = options;
  aSelect.value = refundDataCache[Math.max(0, refundDataCache.length - 2)].month;
  bSelect.value = refundDataCache[refundDataCache.length - 1].month;
  aSelect.onchange = renderRefundComparison;
  bSelect.onchange = renderRefundComparison;
}

function refundRenderAll() {
  if (!refundDataCache.length) throw new Error("A aba REEMBOLSOS_DASH não retornou linhas válidas.");
  refundPopulateSelectors();
  renderRefundSummary();
  renderRefundMonthlyTable();
  renderRefundAffiliateTable();
  renderRefundComparison();

  const totalRows = refundDataCache.reduce((sum, month) => sum + month.count, 0);
  const status = document.getElementById("refundStatus");
  if (status) {
    status.className = "refund-status refund-status-ok";
    status.textContent = `${totalRows.toLocaleString("pt-BR")} reembolsos carregados · ${refundDataCache.length} meses · atualizado ${new Date().toLocaleString("pt-BR")}`;
  }
}

async function refundRefresh() {
  const status = document.getElementById("refundStatus");
  const button = document.getElementById("refundReloadBtn");
  if (status) {
    status.className = "refund-status";
    status.textContent = "Atualizando dados da planilha...";
  }
  if (button) button.disabled = true;

  try {
    await refundLoadData();
    refundRenderAll();
  } catch (error) {
    console.error("Erro ao carregar reembolsos:", error);
    if (status) {
      status.className = "refund-status refund-status-error";
      status.textContent = "Não foi possível ler a aba REEMBOLSOS_DASH agora. Tente novamente em alguns segundos.";
    }
  } finally {
    if (button) button.disabled = false;
  }
}

async function initRefundDashboard() {
  createRefundTab();
  const reloadButton = document.getElementById("refundReloadBtn");
  if (reloadButton) reloadButton.addEventListener("click", refundRefresh);
  await refundRefresh();
}

initRefundDashboard();
