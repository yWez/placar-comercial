const URL = "https://opensheet.elk.sh/1rx8Nd0koxXdCJ4_pZj26TiEwtnD1un4l8j1hqE2Fs3I/DASHBOARD";
const META = 250000;
const MAX = 1000000;
let receitaChart = null;

const resumo = new Set(["total vendido/dia", "total vendido/mes", "total vendido/mês", "meta", "faltando", "meta diaria", "meta diária"]);
const brl = n => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const txt = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
const norm = s => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const valor = x => {
  const n = Number(String(x || "").replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
  return n > MAX ? 0 : n;
};

async function carregarDados() {
  try {
    const dados = await fetch(`${URL}?t=${Date.now()}`, { cache: "no-store" }).then(r => r.json());
    const dias = Object.keys(dados[0] || {}).filter(c => /^\d{2}\/\d{2}$/.test(c)).sort((a,b) => {
      const [da, ma] = a.split("/").map(Number), [db, mb] = b.split("/").map(Number);
      return ma === mb ? da - db : ma - mb;
    });

    const vendedores = dados.filter(l => l.Closer && !resumo.has(norm(l.Closer)));
    const totalDia = {};
    dias.forEach(d => totalDia[d] = vendedores.reduce((s, v) => s + valor(v[d]), 0));

    const ranking = vendedores.map(v => ({ nome: String(v.Closer).trim(), total: dias.reduce((s,d) => s + valor(v[d]), 0) })).sort((a,b) => b.total - a.total);
    const vendido = ranking.reduce((s,r) => s + r.total, 0);
    const pct = META ? vendido / META * 100 : 0;
    let ultimo = null; dias.forEach(d => { if (totalDia[d] > 0) ultimo = d; });

    topo();
    txt("meta", brl(META)); txt("vendido", brl(vendido)); txt("falta", brl(Math.max(META - vendido, 0)));
    txt("percentual", `${pct.toFixed(2)}%`); txt("percentualBarra", `${pct.toFixed(2)}%`);
    txt("hoje", brl(ultimo ? totalDia[ultimo] : 0)); txt("metaDia", brl(META / 30));
    const barra = document.getElementById("barra"); if (barra) barra.style.width = `${Math.min(pct, 100)}%`;

    lider(ranking); rankingHtml(ranking); tabela(vendedores, dias, totalDia); grafico(dias, totalDia);
  } catch(e) { console.error("Erro ao carregar dashboard:", e); txt("liderMes", "Erro ao carregar dados."); }
}

function topo() {
  const a = new Date();
  const mes = a.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const fim = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate();
  txt("mesAtual", mes.charAt(0).toUpperCase() + mes.slice(1)); txt("diasRestantes", Math.max(fim - a.getDate(), 0)); txt("ultimaAtualizacao", a.toLocaleString("pt-BR"));
}

function lider(r) {
  const e = document.getElementById("liderMes"); if (!e) return;
  e.innerHTML = r[0]?.total > 0 ? `<div class="leader-sub">Melhor closer acumulado até agora</div><div class="leader-main">🥇 ${r[0].nome} - ${brl(r[0].total)}</div>` : "Nenhum dado disponível.";
}

function rankingHtml(r) {
  const e = document.getElementById("ranking"); if (!e) return;
  const m = ["🥇", "🥈", "🥉", "🏅"];
  e.innerHTML = r.map((x,i) => `<div class="rank-card"><div class="rank-top">${m[i] || "🏅"} ${x.nome}</div><div class="rank-value">${brl(x.total)}</div><div class="rank-meta">${i+1}º lugar no mês</div></div>`).join("");
}

function tabela(vendedores, dias, totalDia) {
  const e = document.getElementById("tabela"); if (!e) return;
  e.innerHTML = `<table><thead><tr><th>Closer</th>${dias.map(d => `<th>${d}</th>`).join("")}</tr></thead><tbody>${vendedores.map(v => `<tr><td>${v.Closer}</td>${dias.map(d => `<td>${brl(valor(v[d]))}</td>`).join("")}</tr>`).join("")}<tr class="total-row"><td>Total vendido/dia</td>${dias.map(d => `<td>${brl(totalDia[d])}</td>`).join("")}</tr></tbody></table>`;
}

function grafico(dias, totalDia) {
  const c = document.getElementById("receitaChart"); if (!c || typeof Chart === "undefined") return;
  if (receitaChart) receitaChart.destroy();
  let acc = 0; const real = dias.map(d => acc += totalDia[d]); const meta = dias.map((_,i) => META / dias.length * (i + 1));
  receitaChart = new Chart(c, { type: "line", data: { labels: dias, datasets: [{ label: "Realizado", data: real, borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,.12)", fill: true, tension: .35 }, { label: "Meta ideal", data: meta, borderColor: "#ef4444", borderDash: [8,6], pointRadius: 0 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { callback: brl } } } } });
}

function tabs() {
  const b = document.querySelectorAll(".tab-btn"), v = document.querySelectorAll(".vendas-area"), d = document.querySelectorAll(".disparos-area");
  v.forEach(x => x.style.display = ""); d.forEach(x => x.style.display = "none");
  b.forEach(btn => btn.onclick = () => { b.forEach(x => x.classList.remove("active")); btn.classList.add("active"); const isV = btn.dataset.tab === "vendas"; v.forEach(x => x.style.display = isV ? "" : "none"); d.forEach(x => x.style.display = isV ? "none" : "block"); });
}

tabs(); carregarDados(); setInterval(carregarDados, 300000);
