const URL = "https://opensheet.elk.sh/1rx8Nd0koxXdCJ4_pZj26TiEwtnD1un4l8j1hqE2Fs3I/DASHBOARD";

const LINHAS_RESUMO = [
  "Total Vendido/dia",
  "Total Vendido/mes",
  "Meta",
  "Faltando",
  "Meta Diária"
];

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

function pegarDiasDoMes() {
  const hoje = new Date();
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  return ultimoDia;
}

function pegarDiasRestantes() {
  const hoje = new Date();
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  return ultimoDia - hoje.getDate();
}

function atualizarInfosTopo() {
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
      console.error("Sem dados na planilha.");
      return;
    }

    atualizarInfosTopo();

    const todasColunas = Object.keys(dados[0]);
    const dias = todasColunas.filter(coluna => /^\d{2}\/\d{2}$/.test(coluna));

    const buscarLinha = (nome) => {
      return dados.find(item => (item.Closer || "").trim() === nome);
    };

    const linhaTotalDia = buscarLinha("Total Vendido/dia") || {};
    const linhaMeta = buscarLinha("Meta") || {};
    const linhaFaltando = buscarLinha("Faltando") || {};
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

      return {
        nome,
        total
      };
    }).sort((a, b) => b.total - a.total);

    const totalVendido = ranking.reduce((acc, item) => acc + item.total, 0);
    const meta = parseValorBR(linhaMeta[dias[0]]);
    const falta = meta > 0 ? meta - totalVendido : parseValorBR(linhaFaltando[dias[0]]);
    const metaDia = parseValorBR(linhaMetaDia[dias[0]]);
    const percentual = meta > 0 ? (totalVendido / meta) * 100 : 0;

    let ultimoDiaComVenda = null;

    dias.forEach(dia => {
      const valor = parseValorBR(linhaTotalDia[dia]);
      if (valor > 0) {
        ultimoDiaComVenda = dia;
      }
    });

    const valorHoje = ultimoDiaComVenda
      ? parseValorBR(linhaTotalDia[ultimoDiaComVenda])
      : 0;

    document.getElementById("meta").textContent = formatarMoeda(meta);
    document.getElementById("vendido").textContent = formatarMoeda(totalVendido);
    document.getElementById("falta").textContent = formatarMoeda(falta);
    document.getElementById("percentual").textContent = `${percentual.toFixed(2)}%`;
    document.getElementById("percentualBarra").textContent = `${percentual.toFixed(2)}%`;
    document.getElementById("hoje").textContent = formatarMoeda(valorHoje);
    document.getElementById("metaDia").textContent = formatarMoeda(metaDia);
    document.getElementById("barra").style.width = `${Math.min(percentual, 100)}%`;

    renderizarLider(ranking);
    renderizarRanking(ranking);
    renderizarTabela(vendedores, dias, linhaTotalDia);

  } catch (erro) {
    console.error("Erro ao carregar dados:", erro);
  }
}

function renderizarLider(ranking) {
  const lider = ranking[0];
  const box = document.getElementById("liderMes");

  if (!lider) {
    box.innerHTML = `<span>Nenhum dado disponível.</span>`;
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

carregarDados();
setInterval(carregarDados, 300000);
