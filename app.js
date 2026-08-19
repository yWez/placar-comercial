const URL_VENDAS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmVbNM2gBp5BzWLEVmp4gXvXLX9B-Lv62vqXiTLfN1IJ26uhe8M9fbudwtJVP4WVCQVdW7qd_NnewY/pub?gid=1899560077&single=true&output=csv";
const URL_DISPAROS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmVbNM2gBp5BzWLEVmp4gXvXLX9B-Lv62vqXiTLfN1IJ26uhe8M9fbudwtJVP4WVCQVdW7qd_NnewY/pub?gid=277336476&single=true&output=csv";

const META = 250000;
const MAX = 1000000;
let receitaChart = null;
let comparativoMesesChart = null;
let dadosDisparosCache = null;

const resumo = new Set([
  "total vendido/dia",
  "total vendido/mes",
  "total vendido/mês",
  "meta",
  "faltando",
  "meta diaria",
  "meta diária"
]);

const brl = n => Number(n || 0).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const txt = (id, v) => {
  const e = document.getElementById(id);
  if (e) e.textContent = v;
};

const norm = s => String(s || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

const valor = x => {
  const n = Number(
    String(x || "")
      .replace(/[R$\s]/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
  ) || 0;

  return n > MAX ? 0 : n;
};

const num = x => Number(
  String(x || "")
    .replace(/[\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
) || 0;

function parseCSV(texto) {
  const linhas = [];
  let linha = [];
  let campo = "";
  let dentroAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const char = texto[i];
    const proximo = texto[i + 1];

    if (char === '"') {
      if (dentroAspas && proximo === '"') {
        campo += '"';
        i++;
      } else {
        dentroAspas = !dentroAspas;
      }
      continue;
    }

    if (char === "," && !dentroAspas) {
      linha.push(campo.trim());
      campo = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !dentroAspas) {
      if (char === "\r" && proximo === "\n") i++;
      linha.push(campo.trim());
      linhas.push(linha);
      linha = [];
      campo = "";
      continue;
    }

    campo += char;
  }

  if (campo || linha.length) {
    linha.push(campo.trim());
    linhas.push(linha);
  }

  const linhasValidas = linhas.filter(l =>
    l.some(c => String(c).trim() !== "")
  );

  const cabecalho = linhasValidas.shift() || [];

  return linhasValidas.map(linhaAtual => {
    const item = {};

    cabecalho.forEach((coluna, index) => {
      item[String(coluna || "").trim()] = linhaAtual[index] || "";
    });

    return item;
  });
}

async function lerCSV(url) {
  const response = await fetch(`${url}&t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Erro ao buscar CSV: ${response.status}`);
  const csv = await response.text();
  return parseCSV(csv);
}

async function carregarDados() {
  try {
    const dados = await lerCSV(URL_VENDAS);

    const dias = Object.keys(dados[0] || {})
      .filter(c => /^\d{2}\/\d{2}$/.test(c))
      .sort((a, b) => {
        const [da, ma] = a.split("/").map(Number);
        const [db, mb] = b.split("/").map(Number);
        return ma === mb ? da - db : ma - mb;
      });

    const vendedores = dados.filter(l =>
      l.Closer && !resumo.has(norm(l.Closer))
    );

    const totalDia = {};
    dias.forEach(d => {
      totalDia[d] = vendedores.reduce((s, v) => s + valor(v[d]), 0);
    });

    const ranking = vendedores
      .map(v => ({
        nome: String(v.Closer).trim(),
        total: dias.reduce((s, d) => s + valor(v[d]), 0)
      }))
      .sort((a, b) => b.total - a.total);

    const vendido = ranking.reduce((s, r) => s + r.total, 0);
    const pct = META ? (vendido / META) * 100 : 0;

    let ultimo = null;
    dias.forEach(d => {
      if (totalDia[d] > 0) ultimo = d;
    });

    topo();

    txt("meta", brl(META));
    txt("vendido", brl(vendido));
    txt("falta", brl(Math.max(META - vendido, 0)));
    txt("percentual", `${pct.toFixed(2)}%`);
    txt("percentualBarra", `${pct.toFixed(2)}%`);
    txt("hoje", brl(ultimo ? totalDia[ultimo] : 0));
    txt("metaDia", brl(META / 30));

    const barra = document.getElementById("barra");
    if (barra) barra.style.width = `${Math.min(pct, 100)}%`;

    lider(ranking);
    rankingHtml(ranking);
    tabela(vendedores, dias, totalDia);
    grafico(dias, totalDia);

  } catch (e) {
    console.error("Erro ao carregar dashboard:", e);
    txt("liderMes", "Erro ao carregar dados.");
  }
}

function topo() {
  const a = new Date();

  const mes = a.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });

  const fim = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate();

  txt("mesAtual", mes.charAt(0).toUpperCase() + mes.slice(1));
  txt("diasRestantes", Math.max(fim - a.getDate(), 0));
  txt("ultimaAtualizacao", a.toLocaleString("pt-BR"));
}

function lider(r) {
  const e = document.getElementById("liderMes");
  if (!e) return;

  e.innerHTML = r[0]?.total > 0
    ? `<div class="leader-sub">Melhor closer acumulado até agora</div><div class="leader-main">🥇 ${r[0].nome} - ${brl(r[0].total)}</div>`
    : "Nenhum dado disponível.";
}

function rankingHtml(r) {
  const e = document.getElementById("ranking");
  if (!e) return;

  const m = ["🥇", "🥈", "🥉", "🏅"];

  e.innerHTML = r.map((x, i) => `
    <div class="rank-card">
      <div class="rank-top">${m[i] || "🏅"} ${x.nome}</div>
      <div class="rank-value">${brl(x.total)}</div>
      <div class="rank-meta">${i + 1}º lugar no mês</div>
    </div>
  `).join("");
}

function tabela(vendedores, dias, totalDia) {
  const e = document.getElementById("tabela");
  if (!e) return;

  e.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Closer</th>
          ${dias.map(d => `<th>${d}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${vendedores.map(v => `
          <tr>
            <td>${v.Closer}</td>
            ${dias.map(d => `<td>${brl(valor(v[d]))}</td>`).join("")}
          </tr>
        `).join("")}

        <tr class="total-row">
          <td>Total vendido/dia</td>
          ${dias.map(d => `<td>${brl(totalDia[d])}</td>`).join("")}
        </tr>
      </tbody>
    </table>
  `;
}

function grafico(dias, totalDia) {
  const c = document.getElementById("receitaChart");
  if (!c || typeof Chart === "undefined") return;

  if (receitaChart) receitaChart.destroy();

  let acc = 0;
  const real = dias.map(d => acc += totalDia[d]);
  const meta = dias.map((_, i) => META / dias.length * (i + 1));

  receitaChart = new Chart(c, {
    type: "line",
    data: {
      labels: dias,
      datasets: [
        {
          label: "Realizado",
          data: real,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59,130,246,.12)",
          fill: true,
          tension: .35
        },
        {
          label: "Meta ideal",
          data: meta,
          borderColor: "#ef4444",
          borderDash: [8, 6],
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: brl
          }
        }
      }
    }
  });
}

function getCampo(linha, nomes) {
  const keys = Object.keys(linha || {});
  const alvo = keys.find(k => nomes.some(n => norm(k) === norm(n)));
  return alvo ? linha[alvo] : "";
}

function mesDisparo(linha) {
  return String(getCampo(linha, ["Mês", "Mes", "mês", "mes"]) || "Sem mês").trim();
}

function semanaDisparo(linha) {
  return String(getCampo(linha, ["Semana"]) || "").trim();
}

function closerDisparo(linha) {
  return String(getCampo(linha, ["Closer"]) || "").trim();
}

function positivoDisparo(linha) {
  return num(getCampo(linha, ["Positivo", "Positivos"]));
}

function negativoDisparo(linha) {
  return num(getCampo(linha, ["Negativo", "Negativos"]));
}

function conectadosDisparo(linha) {
  return num(getCampo(linha, ["Conectados"]));
}

function vendasDisparo(linha) {
  return num(getCampo(linha, ["Vendas"]));
}

function conversaoDisparo(linha) {
  const conectados = conectadosDisparo(linha);
  const vendas = vendasDisparo(linha);
  return conectados > 0 ? (vendas / conectados) * 100 : 0;
}

function ehTotalDisparos(linha) {
  const nome = norm(closerDisparo(linha));
  return nome.includes("time") || nome.includes("total");
}

function resumoDisparos(linhas) {
  const totais = linhas.filter(ehTotalDisparos);
  const closers = linhas.filter(l => closerDisparo(l) && !ehTotalDisparos(l));
  const base = totais.length ? totais : closers;

  const conectados = base.reduce((s, l) => s + conectadosDisparo(l), 0);
  const vendas = base.reduce((s, l) => s + vendasDisparo(l), 0);
  const positivos = base.reduce((s, l) => s + positivoDisparo(l), 0);
  const negativos = base.reduce((s, l) => s + negativoDisparo(l), 0);
  const conversao = conectados > 0 ? (vendas / conectados) * 100 : 0;

  return { positivos, negativos, conectados, vendas, conversao };
}

async function carregarDisparos() {
  try {
    const dados = dadosDisparosCache || await lerCSV(URL_DISPAROS);
    dadosDisparosCache = dados;

    const semanas = [...new Set(dados.map(semanaDisparo).filter(Boolean))]
      .sort((a, b) => Number(a) - Number(b));

    const select = document.getElementById("filtroSemanaDisparos");

    if (select) {
      const atual = select.value || "TODOS";
      select.innerHTML = `
        <option value="TODOS">Todos</option>
        ${semanas.map(s => `<option value="${s}">Semana ${s}</option>`).join("")}
      `;
      select.value = atual === "TODOS" || semanas.includes(atual) ? atual : "TODOS";
      select.onchange = carregarDisparos;
    }

    const semanaSelecionada = select?.value || "TODOS";
    const filtrados = semanaSelecionada === "TODOS"
      ? dados
      : dados.filter(l => semanaDisparo(l) === semanaSelecionada);

    const closers = filtrados.filter(l => closerDisparo(l) && !ehTotalDisparos(l));
    const resumoAtual = resumoDisparos(filtrados);

    const melhor = [...closers].sort((a, b) => {
      const diff = conversaoDisparo(b) - conversaoDisparo(a);
      if (diff !== 0) return diff;
      return vendasDisparo(b) - vendasDisparo(a);
    })[0];

    txt("disparosConectados", resumoAtual.conectados.toLocaleString("pt-BR"));
    txt("disparosVendas", resumoAtual.vendas.toLocaleString("pt-BR"));
    txt("disparosConversao", `${resumoAtual.conversao.toFixed(2)}%`);
    txt("disparosMelhor", melhor ? `${closerDisparo(melhor)} • ${conversaoDisparo(melhor).toFixed(2)}%` : "-");

    renderizarTabelaDisparos(filtrados, semanaSelecionada);
    renderizarComparativoSemanas(dados, semanas);
    renderizarMelhoresSemanas(dados);
    renderizarComparativoMeses(dados);
  } catch (e) {
    console.error("Erro ao carregar disparos:", e);
    txt("disparosConectados", "0");
    txt("disparosVendas", "0");
    txt("disparosConversao", "0%");
    txt("disparosMelhor", "-");
  }
}

function renderizarTabelaDisparos(linhas, semana) {
  const box = document.getElementById("tabelaDisparos");
  if (!box) return;

  const closers = linhas.filter(l => closerDisparo(l) && !ehTotalDisparos(l));
  const total = linhas.find(ehTotalDisparos);

  let html = `
    <table class="disparos-table">
      <thead>
        <tr>
          <th>Semana</th>
          <th>Closer</th>
          <th>Positivos</th>
          <th>Negativos</th>
          <th>Conectados</th>
          <th>Vendas</th>
          <th>Conversão</th>
        </tr>
      </thead>
      <tbody>
  `;

  closers.forEach(l => {
    html += `
      <tr>
        <td>Semana ${semanaDisparo(l) || "-"}</td>
        <td><strong>${closerDisparo(l)}</strong></td>
        <td>${positivoDisparo(l).toLocaleString("pt-BR")}</td>
        <td>${negativoDisparo(l).toLocaleString("pt-BR")}</td>
        <td>${conectadosDisparo(l).toLocaleString("pt-BR")}</td>
        <td>${vendasDisparo(l).toLocaleString("pt-BR")}</td>
        <td>${conversaoDisparo(l).toFixed(2)}%</td>
      </tr>
    `;
  });

  if (total) {
    html += `
      <tr class="total-row">
        <td>Semana ${semanaDisparo(total) || semana}</td>
        <td><strong>${closerDisparo(total)}</strong></td>
        <td>${positivoDisparo(total).toLocaleString("pt-BR")}</td>
        <td>${negativoDisparo(total).toLocaleString("pt-BR")}</td>
        <td>${conectadosDisparo(total).toLocaleString("pt-BR")}</td>
        <td>${vendasDisparo(total).toLocaleString("pt-BR")}</td>
        <td>${conversaoDisparo(total).toFixed(2)}%</td>
      </tr>
    `;
  }

  html += `</tbody></table>`;
  box.innerHTML = html;
}

function renderizarComparativoSemanas(dados, semanas) {
  const box = document.getElementById("comparativoSemanas");
  if (!box) return;

  box.innerHTML = `
    <div class="comparativo-box">
      <h3>📈 Comparativo entre semanas</h3>
      <div class="comparativo-grid">
        ${semanas.map(s => {
          const r = resumoDisparos(dados.filter(l => semanaDisparo(l) === s));
          return `
            <div class="comparativo-card">
              <span>Semana ${s}</span>
              <strong>${r.vendas.toLocaleString("pt-BR")} vendas</strong>
              <small>${r.conectados.toLocaleString("pt-BR")} conectados</small>
              <small>${r.conversao.toFixed(2)}% conversão</small>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderizarMelhoresSemanas(dados) {
  const box = document.getElementById("melhoresSemanas");
  if (!box) return;

  const closers = [...new Set(dados.filter(l => !ehTotalDisparos(l)).map(closerDisparo).filter(Boolean))];

  box.innerHTML = `
    <div class="melhores-box">
      <h3>🏆 Melhor semana de cada closer</h3>
      <div class="melhores-grid">
        ${closers.map(nome => {
          const melhor = dados
            .filter(l => closerDisparo(l) === nome)
            .sort((a, b) => {
              const diff = conversaoDisparo(b) - conversaoDisparo(a);
              if (diff !== 0) return diff;
              return vendasDisparo(b) - vendasDisparo(a);
            })[0];

          return `
            <div class="melhor-card">
              <span>${nome}</span>
              <strong>Semana ${semanaDisparo(melhor)}</strong>
              <small>${vendasDisparo(melhor).toLocaleString("pt-BR")} vendas</small>
              <small>${conversaoDisparo(melhor).toFixed(2)}% conversão</small>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderizarComparativoMeses(dados) {
  const selectA = document.getElementById("mesComparativoA");
  const selectB = document.getElementById("mesComparativoB");
  if (!selectA || !selectB) return;

  const meses = [...new Set(dados.map(mesDisparo).filter(Boolean))];
  if (!meses.length) return;

  const atualA = selectA.value;
  const atualB = selectB.value;

  selectA.innerHTML = meses.map(m => `<option value="${m}">${m}</option>`).join("");
  selectB.innerHTML = meses.map(m => `<option value="${m}">${m}</option>`).join("");

  selectA.value = meses.includes(atualA) ? atualA : meses[0];
  selectB.value = meses.includes(atualB) ? atualB : meses[meses.length - 1];

  selectA.onchange = () => renderizarComparativoMeses(dados);
  selectB.onchange = () => renderizarComparativoMeses(dados);

  const mesA = selectA.value;
  const mesB = selectB.value;
  const resumoA = resumoDisparos(dados.filter(l => mesDisparo(l) === mesA));
  const resumoB = resumoDisparos(dados.filter(l => mesDisparo(l) === mesB));
  const dif = resumoB.vendas - resumoA.vendas;
  const perc = resumoA.vendas > 0 ? (dif / resumoA.vendas) * 100 : 0;

  txt("labelMesA", mesA);
  txt("labelMesB", mesB);
  txt("vendasMesA", resumoA.vendas.toLocaleString("pt-BR"));
  txt("vendasMesB", resumoB.vendas.toLocaleString("pt-BR"));
  txt("diferencaMeses", dif.toLocaleString("pt-BR"));
  txt("percentualDiferencaMeses", `${perc.toFixed(2)}%`);
  txt("melhorMesComparativo", resumoB.vendas >= resumoA.vendas ? mesB : mesA);

  const canvas = document.getElementById("comparativoMesesChart");
  if (!canvas || typeof Chart === "undefined") return;
  if (comparativoMesesChart) comparativoMesesChart.destroy();

  comparativoMesesChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["Conectados", "Vendas", "Conversão %"],
      datasets: [
        { label: mesA, data: [resumoA.conectados, resumoA.vendas, Number(resumoA.conversao.toFixed(2))] },
        { label: mesB, data: [resumoB.conectados, resumoB.vendas, Number(resumoB.conversao.toFixed(2))] }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function tabs() {
  const b = document.querySelectorAll(".tab-btn");
  const v = document.querySelectorAll(".vendas-area");
  const d = document.querySelectorAll(".disparos-area");

  v.forEach(x => x.style.display = "");
  d.forEach(x => x.style.display = "none");

  b.forEach(btn => {
    btn.onclick = () => {
      b.forEach(x => x.classList.remove("active"));
      btn.classList.add("active");

      const isV = btn.dataset.tab === "vendas";

      v.forEach(x => x.style.display = isV ? "" : "none");
      d.forEach(x => x.style.display = isV ? "none" : "block");

      if (!isV) carregarDisparos();
    };
  });
}

tabs();
carregarDados();
setInterval(carregarDados, 300000);
