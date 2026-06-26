const URL_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmVbNM2gBp5BzWLEVmp4gXvXLX9B-Lv62vqXiTLfN1IJ26uhe8M9fbudwtJVP4WVCQVdW7qd_NnewY/pub?gid=1499943774&single=true&output=csv";

const META_PADRAO = 250000;

const LINHAS_RESUMO = [
  "total vendido/dia",
  "total vendido/mes",
  "total vendido/mês",
  "total vendido mes",
  "total vendido mês",
  "meta",
  "faltando",
  "meta diária",
  "meta diaria",
  "geral",
  "total",
  "total geral"
];

let receitaChart = null;

async function carregarDados() {
  try {
    const response = await fetch(`${URL_CSV}&t=${Date.now()}`, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Erro ao buscar CSV: ${response.status}`);
    }

    const texto = await response.text();
    const dadosBrutos = parseCSV(texto);

    if (!Array.isArray(dadosBrutos) || !dadosBrutos.length) {
      throw new Error("CSV vazio ou inválido.");
    }

    const modelo = prepararModeloDados(dadosBrutos);
    const { vendedores, dias, linhaTotalDia, meta, metaDia } = modelo;

    const ranking = vendedores.map(vendedor => {
      const nome = String(vendedor.Closer || "").trim();
      const total = dias.reduce((acc, dia) => acc + parseValorBR(vendedor[dia]), 0);
      return { nome, total };
    }).sort((a, b) => b.total - a.total);

    const totalVendido = ranking.reduce((acc, item) => acc + item.total, 0);
    const falta = Math.max(meta - totalVendido, 0);
    const percentual = meta > 0 ? (totalVendido / meta) * 100 : 0;

    let ultimoDiaComVenda = null;

    dias.forEach(dia => {
      if (parseValorBR(linhaTotalDia[dia]) > 0) {
        ultimoDiaComVenda = dia;
      }
    });

    const valorUltimoDia = ultimoDiaComVenda ? parseValorBR(linhaTotalDia[ultimoDiaComVenda]) : 0;

    atualizarTopo();

    setTexto("meta", formatarMoeda(meta));
    setTexto("vendido", formatarMoeda(totalVendido));
    setTexto("falta", formatarMoeda(falta));
    setTexto("percentual", `${percentual.toFixed(2)}%`);
    setTexto("percentualBarra", `${percentual.toFixed(2)}%`);
    setTexto("hoje", formatarMoeda(valorUltimoDia));
    setTexto("metaDia", formatarMoeda(metaDia));

    const barra = document.getElementById("barra");
    if (barra) barra.style.width = `${Math.min(percentual, 100)}%`;

    renderizarLider(ranking);
    renderizarRanking(ranking);
    renderizarTabela(vendedores, dias, linhaTotalDia);
    renderizarGrafico(dias, linhaTotalDia, meta);
  } catch (erro) {
    console.error("Erro ao carregar dashboard:", erro);
    setTexto("liderMes", "Erro ao carregar dados. Abra o Console para ver o detalhe.");
  }
}

function prepararModeloDados(dadosBrutos) {
  const chaves = Object.keys(dadosBrutos[0] || {});
  const colunaCloser = encontrarColuna(chaves, ["closer", "vendedor", "responsavel", "responsável"]);
  const colunasDia = chaves
    .map(chave => ({ chave, label: normalizarData(chave) }))
    .filter(item => item.label)
    .sort((a, b) => ordenarData(a.label, b.label));

  if (colunasDia.length) {
    return prepararModeloAberto(dadosBrutos, colunaCloser || "Closer", colunasDia);
  }

  return prepararModeloLongo(dadosBrutos, chaves, colunaCloser || "Closer");
}

function prepararModeloAberto(dados, colunaCloser, colunasDia) {
  const dias = colunasDia.map(item => item.label);
  const mapaColunaPorDia = Object.fromEntries(colunasDia.map(item => [item.label, item.chave]));

  const buscarLinha = nome => dados.find(item => normalizarTexto(item[colunaCloser]) === normalizarTexto(nome));

  const linhaMeta = buscarLinha("Meta") || {};
  const linhaMetaDia = buscarLinha("Meta Diária") || buscarLinha("Meta Diaria") || {};
  const linhaTotalOriginal = buscarLinha("Total Vendido/dia") || buscarLinha("Total") || buscarLinha("Geral") || {};

  const vendedores = dados
    .filter(item => {
      const nome = String(item[colunaCloser] || "").trim();
      return nome && !LINHAS_RESUMO.includes(normalizarTexto(nome));
    })
    .map(item => {
      const vendedor = { Closer: String(item[colunaCloser] || "").trim() };
      dias.forEach(dia => {
        vendedor[dia] = item[mapaColunaPorDia[dia]] || "";
      });
      return vendedor;
    });

  const linhaTotalDia = {};
  dias.forEach(dia => {
    const chaveOriginal = mapaColunaPorDia[dia];
    const totalOriginal = parseValorBR(linhaTotalOriginal[chaveOriginal]);
    linhaTotalDia[dia] = totalOriginal > 0
      ? totalOriginal
      : vendedores.reduce((acc, vendedor) => acc + parseValorBR(vendedor[dia]), 0);
  });

  const primeiroDiaOriginal = mapaColunaPorDia[dias[0]];
  const meta = parseValorBR(linhaMeta[primeiroDiaOriginal]) || META_PADRAO;
  const metaDia = parseValorBR(linhaMetaDia[primeiroDiaOriginal]) || (dias.length ? meta / dias.length : 0);

  return { vendedores, dias, linhaTotalDia, meta, metaDia };
}

function prepararModeloLongo(dados, chaves, colunaCloser) {
  const colunaData = encontrarColuna(chaves, ["data", "dia", "date"])
    || encontrarColunaPorValor(dados, chaves, valor => Boolean(normalizarData(valor)));

  const colunaValor = encontrarColuna(chaves, ["valor venda", "valor_venda", "valor", "venda", "vendido", "receita", "valor líquido", "valor liquido"])
    || encontrarColunaNumerica(dados, chaves.filter(chave => chave !== colunaCloser && chave !== colunaData));

  if (!colunaCloser || !colunaData || !colunaValor) {
    console.warn("Colunas detectadas:", { colunaCloser, colunaData, colunaValor, chaves });
    return {
      vendedores: [],
      dias: [],
      linhaTotalDia: {},
      meta: META_PADRAO,
      metaDia: 0
    };
  }

  const mapaVendedores = new Map();
  const linhaTotalDia = {};
  const diasSet = new Set();

  dados.forEach(item => {
    const nome = String(item[colunaCloser] || "").trim();
    const nomeNormalizado = normalizarTexto(nome);
    const dia = normalizarData(item[colunaData]);
    const valor = parseValorBR(item[colunaValor]);

    if (!nome || !dia || valor <= 0 || LINHAS_RESUMO.includes(nomeNormalizado)) return;

    diasSet.add(dia);

    if (!mapaVendedores.has(nome)) {
      mapaVendedores.set(nome, { Closer: nome });
    }

    const vendedor = mapaVendedores.get(nome);
    vendedor[dia] = (parseValorBR(vendedor[dia]) + valor).toString();
    linhaTotalDia[dia] = (parseValorBR(linhaTotalDia[dia]) + valor).toString();
  });

  const dias = [...diasSet].sort(ordenarData);
  const vendedores = [...mapaVendedores.values()];
  const meta = META_PADRAO;
  const metaDia = dias.length ? meta / dias.length : 0;

  return { vendedores, dias, linhaTotalDia, meta, metaDia };
}

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

  const linhasValidas = linhas.filter(l => l.some(c => String(c).trim() !== ""));
  const indiceCabecalho = Math.max(0, linhasValidas.findIndex(linhaAtual => {
    return linhaAtual.some(celula => normalizarTexto(celula) === "closer")
      || linhaAtual.some(celula => normalizarTexto(celula).includes("vendedor"));
  }));

  const cabecalho = linhasValidas[indiceCabecalho];
  const corpo = linhasValidas.slice(indiceCabecalho + 1);

  return corpo.map(linhaAtual => {
    const item = {};
    cabecalho.forEach((coluna, index) => {
      item[String(coluna || "").trim()] = linhaAtual[index] || "";
    });
    return item;
  });
}

function encontrarColuna(chaves, opcoes) {
  return chaves.find(chave => {
    const chaveNormalizada = normalizarTexto(chave);
    return opcoes.some(opcao => chaveNormalizada === normalizarTexto(opcao) || chaveNormalizada.includes(normalizarTexto(opcao)));
  });
}

function encontrarColunaPorValor(dados, chaves, teste) {
  return chaves.find(chave => {
    const amostra = dados.slice(0, 20).map(item => item[chave]).filter(Boolean);
    if (!amostra.length) return false;
    return amostra.filter(teste).length >= Math.ceil(amostra.length * 0.5);
  });
}

function encontrarColunaNumerica(dados, chaves) {
  return chaves.find(chave => {
    const amostra = dados.slice(0, 30).map(item => item[chave]).filter(Boolean);
    if (!amostra.length) return false;
    return amostra.filter(valor => parseValorBR(valor) > 0).length >= Math.ceil(amostra.length * 0.4);
  });
}

function normalizarData(valor) {
  const texto = String(valor || "").trim();
  if (!texto) return null;

  let match = texto.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (match) {
    const dia = String(Number(match[1])).padStart(2, "0");
    const mes = String(Number(match[2])).padStart(2, "0");
    return `${dia}/${mes}`;
  }

  match = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const dia = String(Number(match[3])).padStart(2, "0");
    const mes = String(Number(match[2])).padStart(2, "0");
    return `${dia}/${mes}`;
  }

  return null;
}

function ordenarData(a, b) {
  const [diaA, mesA] = a.split("/").map(Number);
  const [diaB, mesB] = b.split("/").map(Number);
  if (mesA !== mesB) return mesA - mesB;
  return diaA - diaB;
}

function normalizarTexto(texto) {
  return String(texto || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

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

  const metaDia = dias.length ? meta / dias.length : 0;
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
            label: context => `${context.dataset.label}: ${formatarMoeda(context.raw)}`
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
