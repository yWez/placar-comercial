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

function pParseMatrix(text) {
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

  return rows.filter(rowItem => rowItem.some(cell => String(cell).trim() !== ""));
}

function pInfoData(value) {
  const s = String(value || "").trim();
  let m = s.match(/^(\d{2})\/(\d{2})$/);
  if (m) return { label: `${m[1]}/${m[2]}`, mes: m[2], dia: Number(m[1]) };

  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+.*)?$/);
  if (m) return { label: `${m[3]}/${m[2]}`, mes: m[2], dia: Number(m[3]) };

  return null;
}

function pMontarBase(matriz) {
  const mesAtual = String(new Date().getMonth() + 1).padStart(2, "0");
  const ignorar = new Set(["total vendido/dia", "total vendido/mes", "total vendido/mês", "meta", "faltando", "meta diaria", "meta diária", "falta para meta", "total para meta"]);

  let melhorHeader = -1;
  let melhorQtdDatas = 0;

  matriz.forEach((linha, idx) => {
    const closerIndex = linha.findIndex(c => pNorm(c) === "closer");
    if (closerIndex === -1) return;
    const qtdDatas = linha.filter(c => pInfoData(c)?.mes === mesAtual).length;
    if (qtdDatas > melhorQtdDatas) {
      melhorQtdDatas = qtdDatas;
      melhorHeader = idx;
    }
  });

  if (melhorHeader === -1) return { dias: [], vendedores: [], totalDia: {}, ranking: [] };

  const header = matriz[melhorHeader];
  const closerCol = header.findIndex(c => pNorm(c) === "closer");
  const dateCols = header
    .map((cell, index) => ({ ...pInfoData(cell), index }))
    .filter(item => item.label && item.mes === mesAtual)
    .sort((a, b) => a.dia - b.dia);

  const dias = dateCols.map(item => item.label);
  const vendedores = [];

  for (let i = melhorHeader + 1; i < matriz.length; i++) {
    const linha = matriz[i];
    const nome = String(linha[closerCol] || "").trim();
    const nomeNorm = pNorm(nome);
    if (!nome) continue;
    if (linhasInvalidas(nomeNorm, ignorar)) break;

    const row = { Closer: nome };
    dateCols.forEach(col => row[col.label] = linha[col.index] || "");
    vendedores.push(row);
  }

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

function linhasInvalidas(nomeNorm, ignorar) {
  return ignorar.has(nomeNorm) || nomeNorm.includes("total") || nomeNorm.includes("meta") || nomeNorm.includes("falta");
}

function pCalcular(base) {
  const hoje = new Date();
  const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const diaAtual = Math.min(hoje.getDate(), ultimoDiaMes);
  const diasComVenda = base.dias.filter(day => base.totalDia[day] > 0);
  const realizado = base.dias.reduce((sum, day) => sum + base.totalDia[day], 0);
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

  return { realizado, diaAtual, diasRestantes, mediaMes, mediaUltimos7, projecaoAtual, chance, status, statusText, detail, cenarios: { conservador, atual, acelerado } };
}

function pRender(base, calc) {
  pSet("riskChance", `${Math.round(calc.chance)}%`);
  pSet("riskStatus", calc.statusText);
  pSet("riskDetail", calc.detail);

  const riskStatus = document.getElementById("riskStatus");
  if (riskStatus) riskStatus.className = `risk-status ${calc.status}`;

  const riskBar = document.getElementById("riskBar");
  if (riskBar) riskBar.style.width = `${calc.chance}%`;

  pSet("scenarioSafe", pBRL(calc.cenarios.conservador));
  pSet("scenarioCurrent", pBRL(calc.cenarios.atual));
  pSet("scenarioFast", pBRL(calc.cenarios.acelerado));
  pSet("scenarioSafeSub", "Ritmo reduzido e comportamento defensivo");
  pSet("scenarioCurrentSub", "Mantendo a média atual do mês");
  pSet("scenarioFastSub", "Aceleração baseada nos melhores dias recentes");
}

async function predictiveInit() {
  try {
    const response = await fetch(`${PREDICTIVE_URL_VENDAS}&predictive=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Erro ao buscar vendas: ${response.status}`);
    const csv = await response.text();
    const matriz = pParseMatrix(csv);
    const base = pMontarBase(matriz);
    const calc = pCalcular(base);
    pRender(base, calc);
  } catch (error) {
    console.error("Erro na análise preditiva:", error);
    pSet("riskDetail", "Não foi possível carregar a análise preditiva neste momento.");
  }
}

predictiveInit();
setInterval(predictiveInit, 300000);
