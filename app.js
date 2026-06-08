const URL = "https://opensheet.elk.sh/1rx8Nd0koxXdCJ4_pZj26TiEwtnD1un4l8j1hqE2Fs3I/DASHBOARD";

const LINHAS_RESUMO = [
  "Total Vendido/dia",
  "Total Vendido/mes",
  "Meta",
  "Faltando",
  "Meta Diária"
];

let receitaChart = null;

function parseValorBR(valor) {
  if (valor === null || valor === undefined) return 0;

  const texto = String(valor).trim();

  if (!texto) return 0;

  return Number(
    texto
      .replace(/[R$\s]/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
  ) || 0;
}

function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function capitalizar(texto) {
  if (!texto) return "";
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function pegarDiasRestantes() {
  const hoje = new Date();
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  return Math.max(ultimoDia - hoje.getDate(), 0);
}

function atualizarTopo() {
  const agora = new Date();

  const mesAtual = capitalizar(
    agora.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric"
    })
  );

  document.getElementById("mesAtual").textContent = mesAtual;
  document.getElementById("diasRestantes").textContent = pegarDiasRestantes();
  document.getElementById("ultimaAtualizacao").textContent =
    agora.toLocaleString("pt-BR");
}

async function carregarDados() {
  try {
    const response = await fetch(URL);
    const dados = await response.json();

    if (!Array.isArray(dados) || !dados.length) {
      console.error("Nenhum dado encontrado.");
      return;
    }

    atualizarTopo();

    const dias = [...new Set(
  dados.flatMap(item => Object.keys(item))
)]
  .filter(coluna => /^\d{2}\/\d{2}$/.test(coluna))
  .sort((a, b) => {
    const [diaA, mesA] = a.split("/").map(Number);
    const [diaB, mesB] = b.split("/").map(Number);

    if (mesA !== mesB) return mesA - mesB;
    return diaA - diaB;
  });

    const buscarLinha = nome =>
      dados.find(item => (item.Closer || "").trim() === nome);

    const linhaTotalDia = buscarLinha("Total Vendido/dia") || {};
    const linhaMeta = buscarLinha("Meta") || {};
    const linhaMetaDia = buscarLinha("Meta Diária") || {};

    const vendedores = dados.filter(item => {
      const nome = (item.Closer || "").trim();
      return nome && !LINHAS_RESUMO.includes(nome);
    });

    const ranking = vendedores.map(vendedor => {
      const nome = (vendedor.Closer || "").trim();

      let total = 0;

      dias.forEach(dia => {
        total += parseValorBR(vendedor[dia]);
      });

      return { nome, total };
    }).sort((a, b) => b.total - a.total);

    const totalVendido = ranking.reduce((acc, item) => acc + item.total, 0);

    const meta = parseValorBR(linhaMeta[dias[0]]);
    const falta = Math.max(meta - totalVendido, 0);
    const metaDia = parseValorBR(linhaMetaDia[dias[0]]);
    const percentual = meta > 0 ? (totalVendido / meta) * 100 : 0;

    let ultimoDiaComVenda = null;

    dias.forEach(dia => {
      const valorDia = parseValorBR(linhaTotalDia[dia]);

      if (valorDia > 0) {
        ultimoDiaComVenda = dia;
      }
    });

    const valorUltimoDia = ultimoDiaComVenda
      ? parseValorBR(linhaTotalDia[ultimoDiaComVenda])
      : 0;

    document.getElementById("meta").textContent = formatarMoeda(meta);
    document.getElementById("vendido").textContent = formatarMoeda(totalVendido);
    document.getElementById("falta").textContent = formatarMoeda(falta);
    document.getElementById("percentual").textContent = `${percentual.toFixed(2)}%`;
    document.getElementById("percentualBarra").textContent = `${percentual.toFixed(2)}%`;
    document.getElementById("hoje").textContent = formatarMoeda(valorUltimoDia);
    document.getElementById("metaDia").textContent = formatarMoeda(metaDia);
    document.getElementById("barra").style.width = `${Math.min(percentual, 100)}%`;

    renderizarLider(ranking);
    renderizarRanking(ranking);
    renderizarTabela(vendedores, dias, linhaTotalDia);
    renderizarGrafico(dias, linhaTotalDia, meta);

  } catch (erro) {
    console.error("Erro ao carregar dashboard:", erro);
  }
}

function renderizarLider(ranking) {
  const box = document.getElementById("liderMes");
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
  const rankingBox = document.getElementById("ranking");

  const medalhas = ["🥇", "🥈", "🥉", "🏅"];

  rankingBox.innerHTML = ranking.map((item, index) => {
    const medalha = medalhas[index] || "🏅";

    return `
      <div class="rank-card">
        <div class="rank-top">${medalha} ${item.nome}</div>
        <div class="rank-value">${formatarMoeda(item.total)}</div>
        <div class="rank-meta">${index + 1}º lugar no mês</div>
      </div>
    `;
  }).join("");
}

function renderizarTabela(vendedores, dias, linhaTotalDia) {
  const tabelaBox = document.getElementById("tabela");

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
        ${dias.map(dia => `
          <td>${formatarMoeda(parseValorBR(vendedor[dia]))}</td>
        `).join("")}
      </tr>
    `;
  });

  html += `
    <tr class="total-row">
      <td>Total vendido/dia</td>
      ${dias.map(dia => `
        <td>${formatarMoeda(parseValorBR(linhaTotalDia[dia]))}</td>
      `).join("")}
    </tr>
  `;

  html += `
      </tbody>
    </table>
  `;

  tabelaBox.innerHTML = html;
}

function renderizarGrafico(dias, linhaTotalDia, meta) {
  const canvas = document.getElementById("receitaChart");

  if (!canvas || typeof Chart === "undefined") return;

  let acumulado = 0;

  const realizadoAcumulado = dias.map(dia => {
    acumulado += parseValorBR(linhaTotalDia[dia]);
    return acumulado;
  });

  const metaDiariaIdeal = meta / dias.length;

  const metaIdeal = dias.map((_, index) => {
    return metaDiariaIdeal * (index + 1);
  });

  if (receitaChart) {
    receitaChart.destroy();
  }

  receitaChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: dias,
      datasets: [
        {
          label: "Realizado",
          data: realizadoAcumulado,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59,130,246,.12)",
          borderWidth: 3,
          tension: .35,
          fill: true,
          pointRadius: 4
        },
        {
          label: "Meta ideal",
          data: metaIdeal,
          borderColor: "#ef4444",
          borderWidth: 2,
          borderDash: [8, 6],
          tension: .25,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#334155",
            font: {
              size: 12,
              weight: "700"
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: "#64748b",
            maxRotation: 45,
            minRotation: 45
          },
          grid: {
            color: "rgba(148,163,184,.18)"
          }
        },
        y: {
          ticks: {
            color: "#64748b",
            callback: value => {
              return "R$ " + Number(value).toLocaleString("pt-BR");
            }
          },
          grid: {
            color: "rgba(148,163,184,.22)"
          }
        }
      }
    }
  });
}

carregarDados();
setInterval(carregarDados, 300000);
