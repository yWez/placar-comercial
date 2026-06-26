const URL_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmVbNM2gBp5BzWLEVmp4gXvXLX9B-Lv62vqXiTLfN1IJ26uhe8M9fbudwtJVP4WVCQVdW7qd_NnewY/pub?gid=1499943774&single=true&output=csv";
const LINHAS_RESUMO = [
  "Total Vendido/dia",
  "Total Vendido/mes",
  "Meta",
  "Faltando",
  "Meta Diária"
];

let receitaChart = null;

async function carregarDados() {
  try {
    const response = await fetch(`${URL}?t=${Date.now()}`, { cache: "no-store" });
    const dados = await response.json();

    const dias = Object.keys(dados[0]).filter(coluna => /^\d{2}\/\d{2}$/.test(coluna));

    const buscarLinha = nome => dados.find(item => (item.Closer || "").trim() === nome);

    const linhaTotalDia = buscarLinha("Total Vendido/dia") || {};
    const linhaMeta = buscarLinha("Meta") || {};
    const linhaMetaDia = buscarLinha("Meta Diária") || {};

    const vendedores = dados.filter(item => {
      const nome = (item.Closer || "").trim();
      return nome && !LINHAS_RESUMO.includes(nome);
    });

    const ranking = vendedores.map(vendedor => {
      const nome = vendedor.Closer;
      const total = dias.reduce((acc, dia) => acc + parseValorBR(vendedor[dia]), 0);
      return { nome, total };
    }).sort((a, b) => b.total - a.total);

    const totalVendido = ranking.reduce((acc, item) => acc + item.total, 0);
    const meta = parseValorBR(linhaMeta[dias[0]]);
    const falta = Math.max(meta - totalVendido, 0);
    const metaDia = parseValorBR(linhaMetaDia[dias[0]]);
    const percentual = meta > 0 ? (totalVendido / meta) * 100 : 0;

    let ultimoDiaComVenda = null;

    dias.forEach(dia => {
      if (parseValorBR(linhaTotalDia[dia]) > 0) {
        ultimoDiaComVenda = dia;
      }
    });

    const valorUltimoDia = ultimoDiaComVenda ? parseValorBR(linhaTotalDia[ultimoDiaComVenda]) : 0;

    setTexto("meta", formatarMoeda(meta));
    setTexto("vendido", formatarMoeda(totalVendido));
    setTexto("falta", formatarMoeda(falta));
    setTexto("percentual", `${percentual.toFixed(2)}%`);
    setTexto("percentualBarra", `${percentual.toFixed(2)}%`);
    setTexto("hoje", formatarMoeda(valorUltimoDia));
    setTexto("metaDia", formatarMoeda(metaDia));

    const barra = document.getElementById("barra");
    if (barra) barra.style.width = `${Math.min(percentual, 100)}%`;

    atualizarTopo();
    renderizarLider(ranking);
    renderizarRanking(ranking);
    renderizarTabela(vendedores, dias, linhaTotalDia);
    renderizarGrafico(dias, linhaTotalDia, meta);

  } catch (erro) {
    console.error("Erro ao carregar dashboard:", erro);
  }
}

function parseValorBR(valor) {
  if (!valor) return 0;

  return Number(
    String(valor)
      .replace(/[R$\s]/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
  ) || 0;
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function setTexto(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = valor;
}

function atualizarTopo() {
  const agora = new Date();

  const mes = agora.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });

  const ultimoDia = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  const diasRestantes = Math.max(ultimoDia - agora.getDate(), 0);

  setTexto("mesAtual", mes.charAt(0).toUpperCase() + mes.slice(1));
  setTexto("diasRestantes", diasRestantes);
  setTexto("ultimaAtualizacao", agora.toLocaleString("pt-BR"));
}

function renderizarLider(ranking) {
  const box = document.getElementById("liderMes");
  if (!box) return;

  const lider = ranking[0];

  if (!lider) {
    box.innerHTML = "Nenhum dado disponível.";
    return;
  }

  box.innerHTML = `
    <div class="leader-sub">Melhor closer acumulado até agora</div>
    <div class="leader-main">🥇 ${lider.nome} - ${formatarMoeda(lider.total)}</div>
  `;
}

function renderizarRanking(ranking) {
  const box = document.getElementById("ranking");
  if (!box) return;

  const medalhas = ["🥇", "🥈", "🥉", "🏅"];

  box.innerHTML = ranking.map((item, index) => `
    <div class="rank-card">
      <div class="rank-top">${medalhas[index] || "🏅"} ${item.nome}</div>
      <div class="rank-value">${formatarMoeda(item.total)}</div>
      <div class="rank-meta">${index + 1}º lugar no mês</div>
    </div>
  `).join("");
}

function renderizarTabela(vendedores, dias, linhaTotalDia) {
  const box = document.getElementById("tabela");
  if (!box) return;

  let html = `
    <table>
      <thead>
        <tr>
          <th>Closer</th>
          ${dias.map(dia => `<th>${dia}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
  `;

  vendedores.forEach(vendedor => {
    html += `
      <tr>
        <td>${vendedor.Closer}</td>
        ${dias.map(dia => `<td>${formatarMoeda(parseValorBR(vendedor[dia]))}</td>`).join("")}
      </tr>
    `;
  });

  html += `
      <tr class="total-row">
        <td>Total vendido/dia</td>
        ${dias.map(dia => `<td>${formatarMoeda(parseValorBR(linhaTotalDia[dia]))}</td>`).join("")}
      </tr>
    </tbody>
  </table>
  `;

  box.innerHTML = html;
}

function renderizarGrafico(dias, linhaTotalDia, meta) {
  const canvas = document.getElementById("receitaChart");
  if (!canvas || typeof Chart === "undefined") return;

  const ctx = canvas.getContext("2d");

  let acumulado = 0;

  const realizado = dias.map(dia => {
    acumulado += parseValorBR(linhaTotalDia[dia]);
    return acumulado;
  });

  const metaDia = meta / dias.length;
  const metaIdeal = dias.map((_, index) => metaDia * (index + 1));

  if (receitaChart) receitaChart.destroy();

  const gradient = ctx.createLinearGradient(0, 0, 0, 420);
  gradient.addColorStop(0, "rgba(59,130,246,.34)");
  gradient.addColorStop(1, "rgba(59,130,246,.03)");

  receitaChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: dias,
      datasets: [
        {
          label: "Realizado",
          data: realizado,
          borderColor: "#3b82f6",
          backgroundColor: gradient,
          fill: true,
          borderWidth: 4,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: "#fff",
          pointBorderColor: "#3b82f6",
          pointBorderWidth: 4
        },
        {
          label: "Meta ideal",
          data: metaIdeal,
          borderColor: "#ef4444",
          borderWidth: 3,
          borderDash: [10, 8],
          pointRadius: 0,
          fill: false,
          tension: 0.25
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          labels: {
            color: "#334155",
            font: {
              size: 13,
              weight: "700"
            }
          }
        },
        tooltip: {
          backgroundColor: "#0f172a",
          titleColor: "#fff",
          bodyColor: "#e2e8f0",
          padding: 12,
          cornerRadius: 12,
          callbacks: {
            label: context => {
              return `${context.dataset.label}: ${formatarMoeda(context.raw)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: "#64748b",
            maxRotation: 45,
            minRotation: 45
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(148,163,184,.18)"
          },
          ticks: {
            color: "#64748b",
            callback: value => formatarMoeda(value)
          }
        }
      }
    }
  });
}

function configurarTabs() {
  const botoes = document.querySelectorAll(".tab-btn");
  const vendasAreas = document.querySelectorAll(".vendas-area");
  const disparosAreas = document.querySelectorAll(".disparos-area");

  vendasAreas.forEach(area => area.style.display = "");
  disparosAreas.forEach(area => area.style.display = "none");

  botoes.forEach(botao => {
    botao.addEventListener("click", () => {
      const aba = botao.dataset.tab;

      botoes.forEach(b => b.classList.remove("active"));
      botao.classList.add("active");

      if (aba === "vendas") {
        vendasAreas.forEach(area => area.style.display = "");
        disparosAreas.forEach(area => area.style.display = "none");
      }

      if (aba === "disparos") {
        vendasAreas.forEach(area => area.style.display = "none");
        disparosAreas.forEach(area => area.style.display = "block");
      }
    });
  });
}

configurarTabs();
carregarDados();
setInterval(carregarDados, 300000);
