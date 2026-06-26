const PREDICTIVE_URL_VENDAS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmVbNM2gBp5BzWLEVmp4gXvXLX9B-Lv62vqXiTLfN1IJ26uhe8M9fbudwtJVP4WVCQVdW7qd_NnewY/pub?gid=1899560077&single=true&output=csv";
const PREDICTIVE_META = 250000;
const PREDICTIVE_MAX = 1000000;

function pBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pSet(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function pNorm(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function pValor(value) {
  const number = Number(String(value || "").replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
  return number > PREDICTIVE_MAX ? 0 : number;
}

function pParseCSV(text) {
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

  const clean = rows.filter(rowItem => rowItem.some(cell => String(cell).trim() !== ""));
  const header = clean.shift() || [];

  return clean.map(rowItem => {
    const obj = {};
    header.forEach((col, index) => obj[String(col || "").trim()] = rowItem[index] || "");
    return obj;
  });
}

function pOrdenarData(a, b) {
  const [da, ma] = a.split("/").map(Number);
  const [db, mb] = b.split("/").map(Number);
  if (ma !== mb) return ma - mb;
  return da - db;
}

function pDiaSemana(label) {
  const [day, month] = label.split("/").map(Number);
  const date = new Date(2026, month - 1, day);
  return ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][date.getDay()];
}

function pMontarBase(rows) {
  const ignorar = new Set(["total vendido/dia", "total vendido/mes", "total vendido/mês", "meta", "faltando", "meta diaria", "meta diária"]);
  const dias = Object.keys(rows[0] || {}).filter(c => /^\d{2}\/\d{2}$/.test(c)).sort(pOrdenarData);
  const vendedores = rows.filter(row => row.Closer && !ignorar.has(pNorm(row.Closer)));

  const totalDia = {};
  dias.forEach(day => {
    totalDia[day] = vendedores.reduce((sum, row) => sum + pValor(row[day]), 0);
  });

  const ranking = vendedores.map(row => ({
    nome: String(row.Closer).trim(),
    total: dias.reduce((sum, day) => sum + pValor(row[day]), 0),
    row
  })).sort((a, b) => b.total - a.total);

  return { dias, vendedores, totalDia, ranking };
}

function pCalcular(base) {
  const hoje = new Date();
  const mesAtual = String(hoje.getMonth() + 1).padStart(2, "0");
  const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const diaAtual = Math.min(hoje.getDate(), ultimoDiaMes);
  const diasMes = base.dias.filter(day => day.endsWith(`/${mesAtual}`));
  const diasComVenda = diasMes.filter(day => base.totalDia[day] > 0);
  const realizado = diasMes.reduce((sum, day) => sum + base.totalDia[day], 0);
  const ultimos7 = diasComVenda.slice(-7);
  const mediaMes = realizado / Math.max(diaAtual, 1);
  const mediaUltimos7 = ultimos7.length ? ultimos7.reduce((sum, day) => sum + base.totalDia[day], 0) / ultimos7.length : mediaMes;
  const diasRestantes = Math.max(ultimoDiaMes - diaAtual, 0);
  const ritmoIdealHoje = (PREDICTIVE_META / ultimoDiaMes) * diaAtual;
  const desvioIdeal = realizado - ritmoIdealHoje;
  const projecaoAtual = realizado + (mediaMes * diasRestantes);
  const projecaoRecente = realizado + (mediaUltimos7 * diasRestantes);

  let chance = 50;
  chance += ((projecaoAtual / PREDICTIVE_META) - 1) * 55;
  chance += ((projecaoRecente / PREDICTIVE_META) - 1) * 30;
  chance += (desvioIdeal / Math.max(ritmoIdealHoje, 1)) * 25;
  chance = Math.max(3, Math.min(97, chance));

  const status = chance >= 75 ? "high" : chance >= 50 ? "medium" : "low";
  const statusText = chance >= 75 ? "Alta chance de bater" : chance >= 50 ? "Atenção ao ritmo" : "Risco alto de não bater";
  const detail = `Projeção atual em ${pBRL(projecaoAtual)} e média dos últimos 7 dias em ${pBRL(mediaUltimos7)}.`;

  const conservador = realizado + (Math.min(mediaMes, mediaUltimos7) * 0.85 * diasRestantes);
  const atual = projecaoAtual;
  const acelerado = realizado + (Math.max(mediaMes, mediaUltimos7) * 1.18 * diasRestantes);

  return {
    realizado,
    diaAtual,
    diasRestantes,
    mediaMes,
    mediaUltimos7,
    projecaoAtual,
    chance,
    status,
    statusText,
    detail,
    cenarios: { conservador, atual, acelerado }
  };
}

function pTopPerformers(base) {
  const ranking = base.ranking;
  const diasComVenda = base.dias.filter(day => base.totalDia[day] > 0);
  const ultimoDia = diasComVenda[diasComVenda.length - 1];
  const penultimoDia = diasComVenda[diasComVenda.length - 2];

  const maiorFaturamento = ranking[0] || null;

  const maiorMedia = [...ranking].map(item => {
    const diasAtivos = base.dias.filter(day => pValor(item.row[day]) > 0).length || 1;
    return { nome: item.nome, valor: item.total / diasAtivos };
  }).sort((a, b) => b.valor - a.valor)[0];

  const melhorDia = [];
  base.vendedores.forEach(row => {
    base.dias.forEach(day => {
      melhorDia.push({ nome: String(row.Closer).trim(), day, valor: pValor(row[day]) });
    });
  });
  const maiorDia = melhorDia.sort((a, b) => b.valor - a.valor)[0];

  const evolucao = ranking.map(item => {
    const atual = ultimoDia ? pValor(item.row[ultimoDia]) : 0;
    const anterior = penultimoDia ? pValor(item.row[penultimoDia]) : 0;
    return { nome: item.nome, valor: atual - anterior };
  }).sort((a, b) => b.valor - a.valor)[0];

  return {
    maiorFaturamento,
    maiorMedia,
    maiorDia,
    evolucao
  };
}

function pRender(base, calc) {
  pSet("riskChance", `${Math.round(calc.chance)}%`);
  pSet("riskStatus", calc.statusText);
  pSet("riskDetail", calc.detail);

  const riskStatus = document.getElementById("riskStatus");
  if (riskStatus) {
    riskStatus.className = `risk-status ${calc.status}`;
  }

  const riskBar = document.getElementById("riskBar");
  if (riskBar) riskBar.style.width = `${calc.chance}%`;

  pSet("scenarioSafe", pBRL(calc.cenarios.conservador));
  pSet("scenarioCurrent", pBRL(calc.cenarios.atual));
  pSet("scenarioFast", pBRL(calc.cenarios.acelerado));
  pSet("scenarioSafeSub", "Ritmo reduzido e comportamento defensivo");
  pSet("scenarioCurrentSub", "Mantendo a média atual do mês");
  pSet("scenarioFastSub", "Aceleração baseada nos melhores dias recentes");

  const tops = pTopPerformers(base);
  pSet("topRevenueName", tops.maiorFaturamento ? tops.maiorFaturamento.nome : "-");
  pSet("topRevenueValue", tops.maiorFaturamento ? pBRL(tops.maiorFaturamento.total) : "-");
  pSet("topAverageName", tops.maiorMedia ? tops.maiorMedia.nome : "-");
  pSet("topAverageValue", tops.maiorMedia ? pBRL(tops.maiorMedia.valor) : "-");
  pSet("topDayName", tops.maiorDia ? `${tops.maiorDia.nome} • ${tops.maiorDia.day}` : "-");
  pSet("topDayValue", tops.maiorDia ? pBRL(tops.maiorDia.valor) : "-");
  pSet("topGrowthName", tops.evolucao ? tops.evolucao.nome : "-");
  pSet("topGrowthValue", tops.evolucao ? `${tops.evolucao.valor >= 0 ? "+" : "-"}${pBRL(Math.abs(tops.evolucao.valor))}` : "-");
}

async function predictiveInit() {
  try {
    const response = await fetch(`${PREDICTIVE_URL_VENDAS}&predictive=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Erro ao buscar vendas: ${response.status}`);
    const csv = await response.text();
    const rows = pParseCSV(csv);
    const base = pMontarBase(rows);
    const calc = pCalcular(base);
    pRender(base, calc);
  } catch (error) {
    console.error("Erro na análise preditiva:", error);
    pSet("riskDetail", "Não foi possível carregar a análise preditiva neste momento.");
  }
}

predictiveInit();
setInterval(predictiveInit, 300000);
