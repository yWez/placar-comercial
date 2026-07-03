(() => {
  const URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmVbNM2gBp5BzWLEVmp4gXvXLX9B-Lv62vqXiTLfN1IJ26uhe8M9fbudwtJVP4WVCQVdW7qd_NnewY/pub?gid=1899560077&single=true&output=csv";
  const MAX = 1000000;
  let chart = null;
  const mesesNome = {"01":"Janeiro","02":"Fevereiro","03":"Março","04":"Abril","05":"Maio","06":"Junho","07":"Julho","08":"Agosto","09":"Setembro","10":"Outubro","11":"Novembro","12":"Dezembro"};
  const colors = ["#22c55e", "#8b5cf6", "#3b82f6", "#f59e0b", "#06b6d4", "#ef4444", "#ec4899", "#14b8a6", "#a855f7", "#84cc16", "#f97316", "#64748b"];
  const brl = v => Number(v || 0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  const norm = v => String(v || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const money = v => { const n = Number(String(v || "").replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".")) || 0; return n > MAX ? 0 : n; };
  function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
  function hexToRgba(hex, a){ const n=parseInt(hex.replace("#",""),16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; }

  function parseCSV(text) {
    const rows = []; let row = []; let field = ""; let quoted = false;
    for (let i = 0; i < text.length; i++) { const c = text[i], n = text[i + 1];
      if (c === '"') { if (quoted && n === '"') { field += '"'; i++; } else quoted = !quoted; continue; }
      if (c === "," && !quoted) { row.push(field.trim()); field = ""; continue; }
      if ((c === "\n" || c === "\r") && !quoted) { if (c === "\r" && n === "\n") i++; row.push(field.trim()); rows.push(row); row = []; field = ""; continue; }
      field += c;
    }
    if (field || row.length) { row.push(field.trim()); rows.push(row); }
    return rows.filter(r => r.some(c => String(c).trim() !== ""));
  }
  function dataInfo(v) { const s = String(v || "").trim(); let m = s.match(/^(\d{2})\/(\d{2})$/); if (m) return { label: m[1] + "/" + m[2], mes: m[2], dia: Number(m[1]) }; m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+.*)?$/); if (m) return { label: m[3] + "/" + m[2], mes: m[2], dia: Number(m[3]) }; return null; }
  function montarBase(matriz) {
    const ignorar = new Set(["total vendido/dia","total vendido/mes","total vendido/mês","meta","faltando","meta diaria","meta diária","falta para meta","total para meta"]);
    let headerIndex = -1, maxDates = 0;
    matriz.forEach((linha, index) => { if (!linha.some(c => norm(c) === "closer")) return; const qtd = linha.filter(c => dataInfo(c)).length; if (qtd > maxDates) { maxDates = qtd; headerIndex = index; } });
    if (headerIndex === -1) return { meses:{}, vendedores:[] };
    const header = matriz[headerIndex]; const closerCol = header.findIndex(c => norm(c) === "closer");
    const dateCols = header.map((cell, index) => ({...dataInfo(cell), index})).filter(i => i.label).sort((a,b) => a.mes === b.mes ? a.dia - b.dia : Number(a.mes) - Number(b.mes));
    const vendedores = [];
    for (let i = headerIndex + 1; i < matriz.length; i++) { const linha = matriz[i]; const nome = String(linha[closerCol] || "").trim(); const n = norm(nome); if (!nome) continue; if (ignorar.has(n) || n.includes("total") || n.includes("meta") || n.includes("falta")) break; const vendas = {}; dateCols.forEach(col => vendas[col.label] = money(linha[col.index])); vendedores.push({nome, vendas}); }
    const meses = {};
    dateCols.forEach(col => { if (!meses[col.mes]) meses[col.mes] = {mes: col.mes, label: (mesesNome[col.mes] || col.mes) + "/2026", dias: [], totalDia:{}, total:0, ranking:[], acumulado:[]}; if (!meses[col.mes].dias.includes(col.label)) meses[col.mes].dias.push(col.label); });
    Object.values(meses).forEach(mes => { mes.dias.sort((a,b) => Number(a.split("/")[0]) - Number(b.split("/")[0])); mes.dias.forEach(day => mes.totalDia[day] = vendedores.reduce((sum, v) => sum + (v.vendas[day] || 0), 0)); mes.total = mes.dias.reduce((sum, day) => sum + mes.totalDia[day], 0); let acc=0; mes.acumulado = Array.from({length:31}, (_,i)=>{ const label=String(i+1).padStart(2,"0")+"/"+mes.mes; acc += mes.totalDia[label] || 0; return acc; }); mes.ranking = vendedores.map(v => ({ nome:v.nome, total:mes.dias.reduce((sum, day) => sum + (v.vendas[day] || 0), 0), diasAtivos:mes.dias.filter(day => (v.vendas[day] || 0) > 0).length, melhor: melhorDia(v, mes.dias)})).sort((a,b) => b.total - a.total); mes.melhorDia = [...mes.dias].sort((a,b) => mes.totalDia[b] - mes.totalDia[a])[0] || "-"; mes.melhorCloser = mes.ranking[0] || null; mes.mediaDiaria = mes.dias.length ? mes.total / mes.dias.length : 0; });
    return {meses, vendedores};
  }
  function melhorDia(vendedor, dias) { return dias.map(day => ({day, value:vendedor.vendas[day] || 0})).sort((a,b) => b.value - a.value)[0] || {day:"-", value:0}; }
  function renderRanking(base) { const box = document.getElementById("techRankingClosers"); if (!box) return; const mesAtual = String(new Date().getMonth() + 1).padStart(2, "0"); const mes = base.meses[mesAtual] || Object.values(base.meses).sort((a,b) => Number(b.mes) - Number(a.mes))[0]; if (!mes) return; const ranking = mes.ranking.slice(0, 5); const maior = Math.max(...ranking.map(i => i.total), 1); const total = ranking.reduce((s,i) => s + i.total, 0); box.replaceChildren(); ranking.forEach((item, index) => { const share = total > 0 ? item.total / total * 100 : 0; const width = Math.max(item.total / maior * 100, item.total > 0 ? 8 : 0); const card = el("article", "rank-card-tech" + (index === 0 ? " leader" : "")); card.style.order = String(index + 1); const top = el("div", "rank-card-topline"); top.append(el("div", "rank-position", (index + 1) + "º")); top.append(el("div", "rank-share", share.toFixed(1) + "%")); const body = el("div"); body.append(el("h4", "", item.nome)); body.append(el("strong", "", brl(item.total))); body.append(el("small", "", item.diasAtivos + " dias com venda • melhor dia: " + item.melhor.day)); const mini = el("div", "rank-mini-bar"); const fill = el("div"); fill.style.setProperty("--w", width + "%"); mini.append(fill); body.append(mini); card.append(top); card.append(body); box.append(card); }); }

  function setupMulti(base) {
    const box = document.getElementById("monthMultiSelect"); if (!box) return;
    const meses = Object.values(base.meses).sort((a,b)=>Number(a.mes)-Number(b.mes));
    const cur = String(new Date().getMonth()+1).padStart(2,"0"); const prev = String(new Date().getMonth()).padStart(2,"0");
    const saved = JSON.parse(localStorage.getItem("monthCompareMulti") || "null") || [prev, cur].filter(m=>base.meses[m]);
    box.replaceChildren();
    meses.forEach(m => { const label = el("label", "month-chip"); const cb = document.createElement("input"); cb.type = "checkbox"; cb.value = m.mes; cb.checked = saved.includes(m.mes); const span = el("span", "", m.label); label.append(cb, span); box.append(label); cb.onchange = () => { const selected = [...box.querySelectorAll("input:checked")].map(i=>i.value); localStorage.setItem("monthCompareMulti", JSON.stringify(selected)); renderCompare(base); }; });
  }
  function selectedMonths(base){ const box=document.getElementById("monthMultiSelect"); let selected=box?[...box.querySelectorAll("input:checked")].map(i=>i.value):[]; if(!selected.length){ selected=Object.keys(base.meses).sort((a,b)=>Number(a)-Number(b)).slice(-2); } return selected.map(m=>base.meses[m]).filter(Boolean); }
  function renderCompare(base) {
    const meses = selectedMonths(base); if (!meses.length) return;
    const sorted = [...meses].sort((a,b)=>Number(a.mes)-Number(b.mes)); const first=sorted[0], last=sorted[sorted.length-1]; const diff = last.total - first.total; const pct = first.total > 0 ? diff / first.total * 100 : 0; const cls = diff >= 0 ? "delta-up" : "delta-down";
    set("monthCompareTotalA", brl(first.total)); set("monthCompareTotalB", brl(last.total)); set("monthCompareDelta", (diff >= 0 ? "+" : "-") + brl(Math.abs(diff))); set("monthComparePct", (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%"); set("monthCompareBestCloser", last.melhorCloser ? last.melhorCloser.nome + " • " + brl(last.melhorCloser.total) : "-"); set("monthCompareBestDay", last.melhorDia ? last.melhorDia + " • " + brl(last.totalDia[last.melhorDia] || 0) : "-"); set("monthCompareAvg", brl(last.mediaDiaria));
    const d=document.getElementById("monthCompareDelta"), p=document.getElementById("monthComparePct"); if(d)d.className=cls; if(p)p.className=cls;
    const legend=document.getElementById("monthCompareLegend"); if(legend) legend.textContent = `${sorted.length} mês(es) selecionado(s). Evolução de ${first.label} até ${last.label}: ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%.`;
    renderChart(sorted);
  }
  function renderChart(meses) { const canvas=document.getElementById("monthCompareChart"); if(!canvas||typeof Chart==="undefined")return; const existing=Chart.getChart?Chart.getChart(canvas):null; if(existing)existing.destroy(); if(chart)chart.destroy(); const labels=Array.from({length:31},(_,i)=>String(i+1).padStart(2,"0")); chart=new Chart(canvas,{type:"line",data:{labels,datasets:meses.map((m,i)=>{ const color=colors[i%colors.length]; return {label:m.label,data:m.acumulado,borderColor:color,backgroundColor:hexToRgba(color,.14),fill:i===meses.length-1,tension:.35,borderWidth:3,pointRadius:2,pointHoverRadius:5};})},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},plugins:{legend:{labels:{color:"#cbd5e1",font:{weight:"700"}}},tooltip:{callbacks:{label:ctx=>ctx.dataset.label+": "+brl(ctx.raw)}}},scales:{x:{grid:{color:"rgba(148,163,184,.10)"},ticks:{color:"#94a3b8"}},y:{beginAtZero:true,grid:{color:"rgba(148,163,184,.14)"},ticks:{color:"#94a3b8",callback:brl}}}}}); }
  async function init() { try { const res = await fetch(URL + "&techUpgrade=" + Date.now(), {cache:"no-store"}); if (!res.ok) throw new Error(res.status); const base = montarBase(parseCSV(await res.text())); renderRanking(base); setupMulti(base); renderCompare(base); } catch (e) { console.error("Erro no upgrade visual:", e); } }
  setTimeout(init, 1000); setInterval(init, 300000);
})();
