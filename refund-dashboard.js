let refundChart = null;

const refundBrl = n => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const refundPct = (n, base) => base ? `${((n / base) * 100).toFixed(1).replace(".", ",")}%` : "0%";

function refundDeltaClass(v){ return Math.abs(v) < .01 ? "refund-neutral" : (v > 0 ? "refund-up" : "refund-down"); }
function refundDeltaMoney(v){ return `${v > 0 ? "+" : v < 0 ? "-" : ""}${refundBrl(Math.abs(v))}`; }
function refundDeltaCount(v){ return `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR")}`; }
function refundFindMonth(name){ return REFUND_DATA.find(x => x.month === name) || REFUND_DATA[0]; }

function createRefundTab(){
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
    <div class="refund-panel">
      <div class="refund-panel-header">
        <div><h3>Reembolsos</h3><p>Quantidade de vendas reembolsadas e valor devolvido à base, com comparação mês a mês.</p></div>
      </div>
      <div id="refundSummary" class="refunds-grid"></div>
    </div>

    <div class="refund-panel">
      <div class="refund-panel-header">
        <div><h3>Comparativo entre meses</h3><p>Compare volume e custo de reembolso entre quaisquer meses.</p></div>
        <div class="refund-selectors"><select id="refundMonthA"></select><select id="refundMonthB"></select></div>
      </div>
      <div id="refundCompareCards" class="refund-compare-grid"></div>
      <div class="refund-chart-wrap"><canvas id="refundCompareChart"></canvas></div>
    </div>

    <div class="refund-panel">
      <div class="refund-panel-header"><div><h3>Histórico mensal</h3><p>Evolução da quantidade e do valor reembolsado.</p></div></div>
      <div id="refundMonthlyTable" class="refund-table-wrap"></div>
    </div>

    <div class="refund-panel">
      <div class="refund-panel-header"><div><h3 id="refundSourceTitle">Origem dos reembolsos</h3><p>UTM_SOURCE: al = Analu, es = Esterzinha, jn = Julesco, ws = Wes. Demais origens ficam em Outros.</p></div></div>
      <div id="refundSourceGrid" class="refund-source-grid"></div>
      <div class="refund-note">Critério usado nesta visão: somente transações com status <strong>Reembolsada</strong>. O valor de custo é a soma da coluna <strong>valor venda</strong>. Não há nomes de leads nesta aba.</div>
    </div>
  `;
  main.appendChild(section);

  const vendas = document.querySelectorAll(".vendas-area");
  const disparos = document.querySelectorAll(".disparos-area");
  const refunds = document.querySelectorAll(".refunds-area");
  refunds.forEach(x => x.style.display = "none");

  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    vendas.forEach(x => x.style.display = "none");
    disparos.forEach(x => x.style.display = "none");
    refunds.forEach(x => x.style.display = "block");
    setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
  });

  document.querySelectorAll('.tab-btn:not([data-tab="reembolsos"])').forEach(other => {
    other.addEventListener("click", () => refunds.forEach(x => x.style.display = "none"));
  });
}

function renderRefundSummary(){
  const latest = REFUND_DATA[REFUND_DATA.length - 1];
  const previous = REFUND_DATA[REFUND_DATA.length - 2] || latest;
  const countDelta = latest.count - previous.count;
  const valueDelta = latest.value - previous.value;
  const totalCount = REFUND_DATA.reduce((s,x)=>s+x.count,0);
  const totalValue = REFUND_DATA.reduce((s,x)=>s+x.value,0);

  document.getElementById("refundSummary").innerHTML = `
    <div class="refund-card"><span>Reembolsos em ${latest.month}</span><strong>${latest.count.toLocaleString("pt-BR")}</strong><small class="${refundDeltaClass(countDelta)}">${refundDeltaCount(countDelta)} vs ${previous.month}</small></div>
    <div class="refund-card"><span>Custo em ${latest.month}</span><strong>${refundBrl(latest.value)}</strong><small class="${refundDeltaClass(valueDelta)}">${refundDeltaMoney(valueDelta)} vs ${previous.month}</small></div>
    <div class="refund-card"><span>Ticket médio reembolsado</span><strong>${refundBrl(latest.avg)}</strong><small>Média por reembolso em ${latest.month}</small></div>
    <div class="refund-card"><span>Acumulado Mai–Ago</span><strong>${totalCount.toLocaleString("pt-BR")} reembolsos</strong><small>${refundBrl(totalValue)} devolvidos</small></div>
  `;
}

function renderRefundMonthlyTable(){
  const body = REFUND_DATA.map((m,i) => {
    const prev = REFUND_DATA[i-1];
    const dc = prev ? m.count - prev.count : 0;
    const dv = prev ? m.value - prev.value : 0;
    return `<tr><td><strong>${m.month}</strong></td><td>${m.count.toLocaleString("pt-BR")}</td><td>${refundBrl(m.value)}</td><td>${refundBrl(m.avg)}</td><td class="${refundDeltaClass(dc)}">${prev ? refundDeltaCount(dc) : "-"}</td><td class="${refundDeltaClass(dv)}">${prev ? refundDeltaMoney(dv) : "-"}</td></tr>`;
  }).join("");
  document.getElementById("refundMonthlyTable").innerHTML = `<table class="refund-table"><thead><tr><th>Mês</th><th>Quantidade</th><th>Valor reembolsado</th><th>Ticket médio</th><th>Δ qtd.</th><th>Δ valor</th></tr></thead><tbody>${body}</tbody></table>`;
}

function renderRefundSource(monthName){
  const month = refundFindMonth(monthName);
  document.getElementById("refundSourceTitle").textContent = `Origem dos reembolsos — ${month.month}`;
  document.getElementById("refundSourceGrid").innerHTML = month.sources.map(s => `<div class="refund-source-card"><span>${s.name}</span><strong>${s.count.toLocaleString("pt-BR")}</strong><small>${refundBrl(s.value)} · ${refundPct(s.value, month.value)}</small></div>`).join("");
}

function renderRefundComparison(){
  const aSel = document.getElementById("refundMonthA");
  const bSel = document.getElementById("refundMonthB");
  const a = refundFindMonth(aSel.value);
  const b = refundFindMonth(bSel.value);
  const dc = b.count - a.count;
  const dv = b.value - a.value;
  const dp = a.value ? (dv / a.value) * 100 : 0;
  const better = b.value < a.value ? b.month : a.month;

  document.getElementById("refundCompareCards").innerHTML = `
    <div class="refund-compare-card"><span>${a.month}</span><strong>${a.count} reembolsos</strong><small>${refundBrl(a.value)}</small></div>
    <div class="refund-compare-card"><span>${b.month}</span><strong>${b.count} reembolsos</strong><small>${refundBrl(b.value)}</small></div>
    <div class="refund-compare-card"><span>Diferença</span><strong class="${refundDeltaClass(dv)}">${refundDeltaMoney(dv)}</strong><small class="${refundDeltaClass(dc)}">${refundDeltaCount(dc)} reembolsos · ${dp.toFixed(1).replace(".",",")}%</small></div>
    <div class="refund-compare-card"><span>Melhor mês</span><strong>${better}</strong><small>Menor custo com reembolso</small></div>`;

  if (refundChart) refundChart.destroy();
  const canvas = document.getElementById("refundCompareChart");
  if (canvas && typeof Chart !== "undefined") {
    refundChart = new Chart(canvas, {
      type: "bar",
      data: { labels: ["Quantidade", "Valor (R$ mil)"], datasets: [
        { label: a.month, data: [a.count, Number((a.value/1000).toFixed(2))] },
        { label: b.month, data: [b.count, Number((b.value/1000).toFixed(2))] }
      ] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:"bottom"}} }
    });
  }
  renderRefundSource(b.month);
}

function initRefundDashboard(){
  if (typeof REFUND_DATA === "undefined") return;
  createRefundTab();
  const aSel = document.getElementById("refundMonthA");
  const bSel = document.getElementById("refundMonthB");
  if (!aSel || !bSel) return;
  const opts = REFUND_DATA.map(m => `<option value="${m.month}">${m.month}</option>`).join("");
  aSel.innerHTML = opts; bSel.innerHTML = opts;
  aSel.value = REFUND_DATA[Math.max(0,REFUND_DATA.length-2)].month;
  bSel.value = REFUND_DATA[REFUND_DATA.length-1].month;
  aSel.onchange = renderRefundComparison; bSel.onchange = renderRefundComparison;
  renderRefundSummary(); renderRefundMonthlyTable(); renderRefundComparison();
}

initRefundDashboard();
