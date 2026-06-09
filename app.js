const URL = "https://opensheet.elk.sh/1rx8Nd0koxXdCJ4_pZj26TiEwtnD1un4l8j1hqE2Fs3I/DASHBOARD";
const URL_DISPAROS = "https://opensheet.elk.sh/1rx8Nd0koxXdCJ4_pZj26TiEwtnD1un4l8j1hqE2Fs3I/DISPAROS_DASH";

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
    await carregarDisparos();

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
function parsePercentual(valor) {
  if (valor === null || valor === undefined) return 0;

  return Number(
    String(valor)
      .replace("%", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  ) || 0;
}

function parseInteiro(valor) {
  if (valor === null || valor === undefined) return 0;

  return Number(
    String(valor)
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  ) || 0;
}

async function carregarDisparos() {
  try {
    const response = await fetch(URL_DISPAROS);
    const dados = await response.json();

    if (!Array.isArray(dados) || !dados.length) {
      console.warn("Nenhum dado de disparos encontrado.");
      return;
    }

    const linhaTotal = dados.find(item => {
      const nome = (item.Closer || "").trim().toLowerCase();
      return nome.includes("time") || nome === "total";
    });

    const closers = dados.filter(item => {
      const nome = (item.Closer || "").trim().toLowerCase();
      return nome && !nome.includes("time") && nome !== "total";
    });

    const totalConectados = linhaTotal
      ? parseInteiro(linhaTotal.Conectados)
      : closers.reduce((acc, item) => acc + parseInteiro(item.Conectados), 0);

    const totalVendas = linhaTotal
      ? parseInteiro(linhaTotal.Vendas)
      : closers.reduce((acc, item) => acc + parseInteiro(item.Vendas), 0);

    const conversaoGeral = totalConectados > 0
      ? (totalVendas / totalConectados) * 100
      : 0;

    const melhor = [...closers].sort((a,b) => {
      return parsePercentual(b.Conversao) - parsePercentual(a.Conversao);
    })[0];

    const melhorTexto = melhor
      ? `${melhor.Closer} • ${parsePercentual(melhor.Conversao).toFixed(2)}%`
      : "-";

    document.getElementById("disparosConectados").textContent =
      totalConectados.toLocaleString("pt-BR");

    document.getElementById("disparosVendas").textContent =
      totalVendas.toLocaleString("pt-BR");

    document.getElementById("disparosConversao").textContent =
      `${conversaoGeral.toFixed(2)}%`;

    document.getElementById("disparosMelhor").textContent =
      melhorTexto;

    renderizarTabelaDisparos(closers, linhaTotal);

  } catch (erro) {
    console.error("Erro ao carregar disparos:", erro);
  }
}

function renderizarTabelaDisparos(closers, linhaTotal) {
  const box = document.getElementById("tabelaDisparos");

  if (!box) return;

  let html = `
    <table class="disparos-table">
      <thead>
        <tr>
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

  closers.forEach(item => {
    html += `
      <tr>
        <td>${item.Closer}</td>
        <td>${parseInteiro(item.Positivo)}</td>
        <td>${parseInteiro(item.Negativo)}</td>
        <td>${parseInteiro(item.Conectados)}</td>
        <td>${parseInteiro(item.Vendas)}</td>
        <td>${parsePercentual(item.Conversao).toFixed(2)}%</td>
      </tr>
    `;
  });

  if (linhaTotal) {
    html += `
      <tr class="total-disparos">
        <td>${linhaTotal.Closer}</td>
        <td>${parseInteiro(linhaTotal.Positivo)}</td>
        <td>${parseInteiro(linhaTotal.Negativo)}</td>
        <td>${parseInteiro(linhaTotal.Conectados)}</td>
        <td>${parseInteiro(linhaTotal.Vendas)}</td>
        <td>${parsePercentual(linhaTotal.Conversao).toFixed(2)}%</td>
      </tr>
    `;
  }

  html += `
      </tbody>
    </table>
  `;

  box.innerHTML = html;
}
function configurarTabs() {
  const botoes = document.querySelectorAll(".tab-btn");
  const vendasAreas = document.querySelectorAll(".vendas-area");
  const disparosAreas = document.querySelectorAll(".disparos-area");

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
        carregarDisparos();
      }
    });
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
        carregarDisparos();
      }
    });
  });
}

function parsePercentual(valor) {
  if (valor === null || valor === undefined) return 0;

  return Number(
    String(valor)
      .replace("%", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  ) || 0;
}

function parseInteiro(valor) {
  if (valor === null || valor === undefined) return 0;

  return Number(
    String(valor)
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  ) || 0;
}

function ehLinhaTotalDisparos(item) {
  const nome = (item.Closer || "").trim().toLowerCase();
  return nome.includes("time") || nome === "total";
}

function resumirDadosDisparos(lista) {
  const linhasTotal = lista.filter(ehLinhaTotalDisparos);

  const closers = lista.filter(item => {
    const nome = (item.Closer || "").trim();
    return nome && !ehLinhaTotalDisparos(item);
  });

  const base = linhasTotal.length ? linhasTotal : closers;

  const positivo = base.reduce((acc, item) => acc + parseInteiro(item.Positivo), 0);
  const negativo = base.reduce((acc, item) => acc + parseInteiro(item.Negativo), 0);
  const conectados = base.reduce((acc, item) => acc + parseInteiro(item.Conectados), 0);
  const vendas = base.reduce((acc, item) => acc + parseInteiro(item.Vendas), 0);

  const conversao = conectados > 0
    ? (vendas / conectados) * 100
    : 0;

  return {
    positivo,
    negativo,
    conectados,
    vendas,
    conversao
  };
}

async function carregarDisparos() {
  try {
    const response = await fetch(URL_DISPAROS);
    const dados = await response.json();

    if (!Array.isArray(dados) || !dados.length) {
      console.warn("Nenhum dado de disparos encontrado.");
      return;
    }

    const semanas = [...new Set(
      dados
        .map(item => String(item.Semana || "").trim())
        .filter(Boolean)
    )].sort((a, b) => Number(a) - Number(b));

    const selectSemana = document.getElementById("filtroSemanaDisparos");

    if (selectSemana && semanas.length) {
      const valorAtual = selectSemana.value || "TODOS";

      selectSemana.innerHTML = `
        <option value="TODOS">Todos</option>
        ${semanas.map(semana => {
          return `<option value="${semana}">Semana ${semana}</option>`;
        }).join("")}
      `;

      selectSemana.value =
        valorAtual === "TODOS" || semanas.includes(valorAtual)
          ? valorAtual
          : "TODOS";

      selectSemana.onchange = carregarDisparos;
    }

    const semanaSelecionada = selectSemana?.value || "TODOS";

    const dadosFiltrados = semanaSelecionada === "TODOS"
      ? dados
      : dados.filter(item => {
          return String(item.Semana || "").trim() === String(semanaSelecionada);
        });

    const closersFiltrados = dadosFiltrados.filter(item => {
      const nome = (item.Closer || "").trim();
      return nome && !ehLinhaTotalDisparos(item);
    });

    const resumo = resumirDadosDisparos(dadosFiltrados);

    const melhor = [...closersFiltrados].sort((a, b) => {
      const convA = parsePercentual(a.Conversao);
      const convB = parsePercentual(b.Conversao);

      if (convB !== convA) return convB - convA;

      return parseInteiro(b.Vendas) - parseInteiro(a.Vendas);
    })[0];

    const melhorTexto = melhor
      ? `${melhor.Closer} • ${parsePercentual(melhor.Conversao).toFixed(2)}%`
      : "-";

    document.getElementById("disparosConectados").textContent =
      resumo.conectados.toLocaleString("pt-BR");

    document.getElementById("disparosVendas").textContent =
      resumo.vendas.toLocaleString("pt-BR");

    document.getElementById("disparosConversao").textContent =
      `${resumo.conversao.toFixed(2)}%`;

    document.getElementById("disparosMelhor").textContent =
      melhorTexto;

    renderizarComparativoSemanas(dados, semanas, semanaSelecionada);
    renderizarMelhoresSemanasPorCloser(dados);
    renderizarTabelaDisparos(dadosFiltrados, semanaSelecionada);

  } catch (erro) {
    console.error("Erro ao carregar disparos:", erro);
  }
}

function renderizarTabelaDisparos(dadosFiltrados, semanaSelecionada) {
  const box = document.getElementById("tabelaDisparos");
  if (!box) return;

  // quando filtra uma semana só, mantém mais simples
  if (semanaSelecionada !== "TODOS") {
    const linhaTotal = dadosFiltrados.find(ehLinhaTotalDisparos);
    const closers = dadosFiltrados.filter(item => !ehLinhaTotalDisparos(item));

    let html = "";

    if (linhaTotal) {
      html += `
        <div class="resumo-semana-card">
          <div class="resumo-semana-topo">
            <h4>📊 Resumo geral da ${"Semana " + linhaTotal.Semana}</h4>
            <span class="badge-geral">Time Comercial</span>
          </div>

          <div class="resumo-semana-grid">
            <div class="mini-card">
              <span>Positivos</span>
              <strong>${parseInteiro(linhaTotal.Positivo).toLocaleString("pt-BR")}</strong>
            </div>

            <div class="mini-card">
              <span>Negativos</span>
              <strong>${parseInteiro(linhaTotal.Negativo).toLocaleString("pt-BR")}</strong>
            </div>

            <div class="mini-card">
              <span>Conectados</span>
              <strong>${parseInteiro(linhaTotal.Conectados).toLocaleString("pt-BR")}</strong>
            </div>

            <div class="mini-card destaque">
              <span>Vendas do Time</span>
              <strong>${parseInteiro(linhaTotal.Vendas).toLocaleString("pt-BR")}</strong>
            </div>

            <div class="mini-card destaque">
              <span>Conversão Geral</span>
              <strong>${parsePercentual(linhaTotal.Conversao).toFixed(2)}%</strong>
            </div>
          </div>
        </div>
      `;
    }

    html += `
      <table class="disparos-table">
        <thead>
          <tr>
            <th>Closer</th>
            <th>Positivos</th>
            <th>Negativos</th>
            <th>Conectados</th>
            <th>Vendas</th>
            <th>Conversão</th>
          </tr>
        </thead>
        <tbody>
          ${closers.map(item => `
            <tr>
              <td><strong>${item.Closer}</strong></td>
              <td>${parseInteiro(item.Positivo).toLocaleString("pt-BR")}</td>
              <td>${parseInteiro(item.Negativo).toLocaleString("pt-BR")}</td>
              <td>${parseInteiro(item.Conectados).toLocaleString("pt-BR")}</td>
              <td>${parseInteiro(item.Vendas).toLocaleString("pt-BR")}</td>
              <td>${parsePercentual(item.Conversao).toFixed(2)}%</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    box.innerHTML = html;
    return;
  }

  // MODO TODOS
  const semanas = [...new Set(dadosFiltrados.map(item => item.Semana))].sort((a, b) => Number(a) - Number(b));

  let html = `<div class="blocos-semanas">`;

  semanas.forEach(semana => {
    const dadosSemana = dadosFiltrados.filter(item => String(item.Semana) === String(semana));
    const linhaTotal = dadosSemana.find(ehLinhaTotalDisparos);
    const closers = dadosSemana.filter(item => !ehLinhaTotalDisparos(item));

    html += `
      <div class="semana-bloco">
        <div class="semana-header">
          <h3>Semana ${semana}</h3>
          <span class="badge-semana">Visão geral do time</span>
        </div>
    `;

    if (linhaTotal) {
      html += `
        <div class="resumo-semana-grid">
          <div class="mini-card">
            <span>Positivos</span>
            <strong>${parseInteiro(linhaTotal.Positivo).toLocaleString("pt-BR")}</strong>
          </div>

          <div class="mini-card">
            <span>Negativos</span>
            <strong>${parseInteiro(linhaTotal.Negativo).toLocaleString("pt-BR")}</strong>
          </div>

          <div class="mini-card">
            <span>Conectados</span>
            <strong>${parseInteiro(linhaTotal.Conectados).toLocaleString("pt-BR")}</strong>
          </div>

          <div class="mini-card destaque">
            <span>Vendas do Time</span>
            <strong>${parseInteiro(linhaTotal.Vendas).toLocaleString("pt-BR")}</strong>
          </div>

          <div class="mini-card destaque">
            <span>Conversão Geral</span>
            <strong>${parsePercentual(linhaTotal.Conversao).toFixed(2)}%</strong>
          </div>
        </div>
      `;
    }

    html += `
        <table class="disparos-table">
          <thead>
            <tr>
              <th>Closer</th>
              <th>Positivos</th>
              <th>Negativos</th>
              <th>Conectados</th>
              <th>Vendas</th>
              <th>Conversão</th>
            </tr>
          </thead>
          <tbody>
            ${closers.map(item => `
              <tr>
                <td><strong>${item.Closer}</strong></td>
                <td>${parseInteiro(item.Positivo).toLocaleString("pt-BR")}</td>
                <td>${parseInteiro(item.Negativo).toLocaleString("pt-BR")}</td>
                <td>${parseInteiro(item.Conectados).toLocaleString("pt-BR")}</td>
                <td>${parseInteiro(item.Vendas).toLocaleString("pt-BR")}</td>
                <td>${parsePercentual(item.Conversao).toFixed(2)}%</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  });

  html += `</div>`;

  box.innerHTML = html;
}

function formatarDeltaNumero(valor) {
  if (valor > 0) return `+${valor.toLocaleString("pt-BR")}`;
  if (valor < 0) return valor.toLocaleString("pt-BR");
  return "0";
}

function formatarDeltaPercentual(valor) {
  if (valor > 0) return `+${valor.toFixed(2)} p.p.`;
  if (valor < 0) return `${valor.toFixed(2)} p.p.`;
  return "0,00 p.p.";
}

function classeDelta(valor) {
  if (valor > 0) return "delta-up";
  if (valor < 0) return "delta-down";
  return "delta-neutral";
}

function renderizarComparativoSemanas(dados, semanas, semanaSelecionada) {
  const box = document.getElementById("comparativoSemanas");

  if (!box) return;

  if (!semanas.length || semanas.length < 2) {
    box.innerHTML = `
      <div class="comparativo-box">
        <h4>📊 Comparativo entre semanas</h4>
        <p style="color:var(--muted);font-weight:700;">
          Adicione pelo menos duas semanas para comparar.
        </p>
      </div>
    `;
    return;
  }

  let semanasParaComparar = [];

  if (semanaSelecionada === "TODOS") {
    semanasParaComparar = semanas;
  } else {
    const index = semanas.indexOf(String(semanaSelecionada));

    if (index > 0) {
      semanasParaComparar = [
        semanas[index - 1],
        semanas[index]
      ];
    } else {
      semanasParaComparar = [semanas[index]];
    }
  }

  let html = `
    <div class="comparativo-box">
      <h4>📊 Comparativo entre semanas</h4>
      <div class="comparativo-grid">
  `;

  semanasParaComparar.forEach(semana => {
    const dadosSemana = dados.filter(item => {
      return String(item.Semana || "").trim() === String(semana);
    });

    const resumoAtual = resumirDadosDisparos(dadosSemana);

    const semanaAnterior = semanas[semanas.indexOf(semana) - 1];

    let deltaVendas = 0;
    let deltaConectados = 0;
    let deltaConversao = 0;

    if (semanaAnterior) {
      const dadosAnterior = dados.filter(item => {
        return String(item.Semana || "").trim() === String(semanaAnterior);
      });

      const resumoAnterior = resumirDadosDisparos(dadosAnterior);

      deltaVendas = resumoAtual.vendas - resumoAnterior.vendas;
      deltaConectados = resumoAtual.conectados - resumoAnterior.conectados;
      deltaConversao = resumoAtual.conversao - resumoAnterior.conversao;
    }

    html += `
      <div class="comparativo-card">
        <span>Semana ${semana}</span>
        <strong>${resumoAtual.vendas} vendas</strong>
        <small>Conectados: ${resumoAtual.conectados}</small>
        <small>Conversão: ${resumoAtual.conversao.toFixed(2)}%</small>

        ${semanaAnterior ? `
          <small class="${classeDelta(deltaVendas)}">
            Vendas: ${formatarDeltaNumero(deltaVendas)}
          </small>
          <small class="${classeDelta(deltaConectados)}">
            Conectados: ${formatarDeltaNumero(deltaConectados)}
          </small>
          <small class="${classeDelta(deltaConversao)}">
            Conversão: ${formatarDeltaPercentual(deltaConversao)}
          </small>
        ` : `
          <small class="delta-neutral">Primeira semana registrada</small>
        `}
      </div>
    `;
  });

  html += `
      </div>
    </div>
  `;

  box.innerHTML = html;
}

function renderizarMelhoresSemanasPorCloser(dados) {
  const box = document.getElementById("melhoresSemanas");

  if (!box) return;

  const closers = dados.filter(item => {
    const nome = (item.Closer || "").trim();
    return nome && !ehLinhaTotalDisparos(item);
  });

  const nomesClosers = [...new Set(
    closers.map(item => item.Closer)
  )];

  let html = `
    <div class="melhores-box">
      <h4>🏆 Melhor semana de cada closer</h4>
      <div class="melhores-grid">
  `;

  nomesClosers.forEach(nome => {
    const semanasDoCloser = closers.filter(item => item.Closer === nome);

    const melhorSemana = semanasDoCloser.sort((a, b) => {
      const convA = parsePercentual(a.Conversao);
      const convB = parsePercentual(b.Conversao);

      if (convB !== convA) return convB - convA;

      return parseInteiro(b.Vendas) - parseInteiro(a.Vendas);
    })[0];

    if (!melhorSemana) return;

    html += `
      <div class="melhor-card">
        <span>${nome}</span>
        <strong>Semana ${melhorSemana.Semana}</strong>
        <small>Conversão: ${parsePercentual(melhorSemana.Conversao).toFixed(2)}%</small>
        <small>Vendas: ${parseInteiro(melhorSemana.Vendas)}</small>
        <small>Conectados: ${parseInteiro(melhorSemana.Conectados)}</small>
      </div>
    `;
  });

  html += `
      </div>
    </div>
  `;

  box.innerHTML = html;
}

configurarTabs();
carregarDados();
setInterval(carregarDados, 300000);
