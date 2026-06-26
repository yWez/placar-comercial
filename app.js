const URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmVbNM2gBp5BzWLEVmp4gXvXLX9B-Lv62vqXiTLfN1IJ26uhe8M9fbudwtJVP4WVCQVdW7qd_NnewY/pub?gid=1899560077&single=true&output=csv";

const META = 250000;
const MAX = 1000000;
let receitaChart = null;

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

async function carregarDados() {
  try {
    const csv = await fetch(`${URL}&t=${Date.now()}`, {
      cache: "no-store"
    }).then(r => r.text());

    const dados = parseCSV(csv);

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
    };
  });
}

const URL_DISPAROS = "https://opensheet.elk.sh/1rx8Nd0koxXdCJ4_pZj26TiEwtnD1un4l8j1hqE2Fs3I/DISPAROS_DASH";

function num(x) {
  return Number(String(x || "").replace(/\./g, "").replace(",", ".")) || 0;
}

function pct(x) {
  return Number(String(x || "").replace("%", "").replace(",", ".")) || 0;
}

function ehTotalDisparos(linha) {
  const nome = norm(linha.Closer);
  return nome.includes("time") || nome.includes("total");
}

async function carregarDisparos() {
  try {
    const dados = await fetch(`${URL_DISPAROS}?t=${Date.now()}`, {
      cache: "no-store"
    }).then(r => r.json());

    if (!Array.isArray(dados)) throw new Error("Disparos não retornou lista");

    const semanas = [...new Set(
      dados.map(l => String(l.Semana || "").trim()).filter(Boolean)
    )].sort((a, b) => Number(a) - Number(b));

    const select = document.getElementById("filtroSemanaDisparos");

    if (select) {
      const atual = select.value || "TODOS";

      select.innerHTML = `
        <option value="TODOS">Todos</option>
        ${semanas.map(s => `<option value="${s}">Semana ${s}</option>`).join("")}
      `;

      select.value = atual === "TODOS" || semanas.includes(atual)
        ? atual
        : "TODOS";

      select.onchange = carregarDisparos;
    }

    const semana = select?.value || "TODOS";

    const filtrados = semana === "TODOS"
      ? dados
      : dados.filter(l => String(l.Semana || "").trim() === semana);

    const closers = filtrados.filter(l => l.Closer && !ehTotalDisparos(l));
    const totais = filtrados.filter(ehTotalDisparos);

    const baseResumo = totais.length ? totais : closers;

    const positivos = baseResumo.reduce((s, l) => s + num(l.Positivo), 0);
    const negativos = baseResumo.reduce((s, l) => s + num(l.Negativo), 0);
    const conectados = baseResumo.reduce((s, l) => s + num(l.Conectados), 0);
    const vendas = baseResumo.reduce((s, l) => s + num(l.Vendas), 0);
    const conversao = conectados > 0 ? (vendas / conectados) * 100 : 0;

    const melhor = [...closers].sort((a, b) => {
      const convB = pct(b.Conversao);
      const convA = pct(a.Conversao);
      if (convB !== convA) return convB - convA;
      return num(b.Vendas) - num(a.Vendas);
    })[0];

    txt("disparosConectados", conectados.toLocaleString("pt-BR"));
    txt("disparosVendas", vendas.toLocaleString("pt-BR"));
    txt("disparosConversao", `${conversao.toFixed(2)}%`);
    txt(
      "disparosMelhor",
      melhor ? `${melhor.Closer} • ${pct(melhor.Conversao).toFixed(2)}%` : "-"
    );

    renderizarTabelaDisparos(filtrados, semana);

  } catch (e) {
    console.error("Erro ao carregar disparos:", e);
  }
}

function renderizarTabelaDisparos(linhas, semana) {
  const box = document.getElementById("tabelaDisparos");
  if (!box) return;

  const closers = linhas.filter(l => l.Closer && !ehTotalDisparos(l));
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
        <td>Semana ${l.Semana || "-"}</td>
        <td><strong>${l.Closer}</strong></td>
        <td>${num(l.Positivo)}</td>
        <td>${num(l.Negativo)}</td>
        <td>${num(l.Conectados)}</td>
        <td>${num(l.Vendas)}</td>
        <td>${pct(l.Conversao).toFixed(2)}%</td>
      </tr>
    `;
  });

  if (total) {
    html += `
      <tr class="total-row">
        <td>Semana ${total.Semana || semana}</td>
        <td><strong>${total.Closer}</strong></td>
        <td>${num(total.Positivo)}</td>
        <td>${num(total.Negativo)}</td>
        <td>${num(total.Conectados)}</td>
        <td>${num(total.Vendas)}</td>
        <td>${pct(total.Conversao).toFixed(2)}%</td>
      </tr>
    `;
  }

  html += `
      </tbody>
    </table>
  `;

  box.innerHTML = html;
}

tabs();
carregarDados();
setInterval(carregarDados, 300000);
