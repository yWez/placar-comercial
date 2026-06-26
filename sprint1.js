(() => {
  const URL_VENDAS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmVbNM2gBp5BzWLEVmp4gXvXLX9B-Lv62vqXiTLfN1IJ26uhe8M9fbudwtJVP4WVCQVdW7qd_NnewY/pub?gid=1899560077&single=true&output=csv";
  const META = 250000;
  const MAX = 1000000;
  let mesChart = null;

  const brl = n => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  const setClass = (id, cls) => {
    const el = document.getElementById(id);
    if (el) el.className = cls;
  };
  const norm = s => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const moneyValue = raw => {
    const n = Number(String(raw || "").replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
    return n > MAX ? 0 : n;
  };

  const linhasIgnoradas = new Set([
    "total vendido/dia",
    "total vendido/mes",
    "total vendido/mês",
    "meta",
    "faltando",
    "meta diaria",
    "meta diária"
  ]);

  function parseCSV(texto) {
    const linhas = [];
    let linha = [];
    let campo = "";
    let aspas = false;

    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      const p = texto[i + 1];

      if (c === '"') {
        if (aspas && p === '"') {
          campo += '"';
          i++;
        } else {
          aspas = !aspas;
        }
        continue;
      }

      if (c === "," && !aspas) {
        linha.push(campo.trim());
        campo = "";
        continue;
      }

      if ((c === "\n" || c === "\r") && !aspas) {
        if (c === "\r" && p === "\n") i++;
        linha.push(campo.trim());
        linhas.push(linha);
        linha = [];
        campo = "";
        continue;
      }

      campo += c;
    }

    if (campo || linha.length) {
      linha.push(campo.trim());
      linhas.push(linha);
    }

    const validas = linhas.filter(l => l.some(c => String(c).trim() !== ""));
    const header = validas.shift() || [];

    return validas.map(l => {
      const item = {};
      header.forEach((h, i) => item[String(h || "").trim()] = l[i] || "");
      return item;
    });
  }

  function ordenarDatas(a, b) {
    const [da, ma] = a.split("/").map(Number);
    const [db, mb] = b.split("/").map(Number);
    return ma === mb ? da - db : ma - mb;
  }

  function montarBase(dados) {
    const dias = Object.keys(dados[0] || {})
      .filter(c => /^\d{2}\/\d{2}$/.test(c))
      .sort(ordenarDatas);

    const vendedores = dados.filter(l => l.Closer && !linhasIgnoradas.has(norm(l.Closer)));
    const totalDia = {};

    dias.forEach(dia => {
      totalDia[dia] = vendedores.reduce((s, vendedor) => s + moneyValue(vendedor[dia]), 0);
    });

    const diasComVenda = dias.filter(d => totalDia[d] > 0);
    const vendido = dias.reduce((s, d) => s + totalDia[d], 0);

    return { dias, vendedores, totalDia, diasComVenda, vendido };
  }

  function calcularSprint(base) {
    const hoje = new Date();
    const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    const diaAtual = Math.min(hoje.getDate(), diasNoMes);
    const diasPassados = Math.max(base.diasComVenda.length, 1);
    const diasRestantes = Math.max(diasNoMes - diaAtual, 0);

    const mediaDiasComVenda = base.vendido / diasPassados;
    const mediaCalendario = base.vendido / Math.max(diaAtual, 1);
    const mediaNecessaria = Math.max(META - base.vendido, 0) / Math.max(diasRestantes, 1);
    const projecao = base.vendido + (mediaCalendario * diasRestantes);
    const ritmoIdealHoje = META / diasNoMes * diaAtual;
    const desvio = base.vendido - ritmoIdealHoje;
    const pctProjetado = META > 0 ? (projecao / META) * 100 : 0;

    let status = {
      tipo: "ok",
      titulo: "No ritmo da meta",
      texto: "O time está dentro do ritmo esperado para bater a meta."
    };

    if (desvio < 0) {
      const atrasoPct = Math.abs(desvio) / Math.max(ritmoIdealHoje, 1);
      if (atrasoPct > 0.10) {
        status = {
          tipo: "danger",
          titulo: "Risco alto",
          texto: `O time está ${brl(Math.abs(desvio))} abaixo da meta ideal de hoje.`
        };
      } else {
        status = {
          tipo: "warning",
          titulo: "Atenção no ritmo",
          texto: `O time está ${brl(Math.abs(desvio))} abaixo da meta ideal de hoje.`
        };
      }
    } else if (desvio > 0) {
      status = {
        tipo: "ok",
        titulo: "Acima do ritmo",
        texto: `O time está ${brl(desvio)} acima da meta ideal de hoje.`
      };
    }

    let dataBatimento = "Não previsto";
    if (base.vendido >= META) {
      dataBatimento = "Meta já batida";
    } else if (mediaCalendario > 0) {
      const diasParaBater = Math.ceil((META - base.vendido) / mediaCalendario);
      const data = new Date(hoje);
      data.setDate(hoje.getDate() + diasParaBater);
      dataBatimento = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    }

    return {
      diasNoMes,
      diaAtual,
      diasRestantes,
      mediaDiasComVenda,
      mediaCalendario,
      mediaNecessaria,
      projecao,
      ritmoIdealHoje,
      desvio,
      pctProjetado,
      status,
      dataBatimento
    };
  }

  function renderizarSprint(base, sprint) {
    setText("projecaoFinal", brl(sprint.projecao));
    setText("projecaoPercentual", `${sprint.pctProjetado.toFixed(2)}% da meta projetada`);
    setText("ritmoIdealHoje", brl(sprint.ritmoIdealHoje));
    setText("ritmoIdealLegenda", `Ideal acumulado até o dia ${sprint.diaAtual}`);
    setText("desvioMeta", brl(sprint.desvio));
    setText("desvioMetaLegenda", sprint.desvio >= 0 ? "Acima da meta ideal" : "Abaixo da meta ideal");
    setText("mediaNecessaria", brl(sprint.mediaNecessaria));
    setText("mediaNecessariaLegenda", "Média diária necessária até fechar o mês");
    setText("previsaoMeta", sprint.dataBatimento);
    setText("previsaoMetaLegenda", "Previsão de batimento mantendo o ritmo atual");
    setText("alertaTitulo", sprint.status.titulo);
    setText("alertaTexto", sprint.status.texto);
    setClass("alertaMeta", `alerta-meta ${sprint.status.tipo}`);

    const metaProjetada = document.getElementById("metaProjetadaBarra");
    if (metaProjetada) metaProjetada.style.width = `${Math.min(sprint.pctProjetado, 100)}%`;
  }

  function agruparMeses(base) {
    const grupos = new Map();

    base.dias.forEach(dia => {
      const [, mes] = dia.split("/");
      const label = `${mes}/2026`;
      grupos.set(label, (grupos.get(label) || 0) + base.totalDia[dia]);
    });

    return [...grupos.entries()].map(([mes, valor]) => ({ mes, valor }));
  }

  function renderizarComparativoMesesVendas(base) {
    const canvas = document.getElementById("comparativoVendasMesChart");
    const legenda = document.getElementById("comparativoVendasMesLegenda");
    if (!canvas || typeof Chart === "undefined") return;

    const meses = agruparMeses(base);

    if (legenda) {
      if (meses.length < 2) {
        legenda.textContent = "Assim que existir mais de um mês na base, o comparativo mês vs mês aparece aqui automaticamente.";
      } else {
        const penultimo = meses[meses.length - 2];
        const ultimo = meses[meses.length - 1];
        const dif = ultimo.valor - penultimo.valor;
        const pct = penultimo.valor > 0 ? (dif / penultimo.valor) * 100 : 0;
        legenda.textContent = `${ultimo.mes} ${dif >= 0 ? "cresceu" : "caiu"} ${pct.toFixed(2)}% vs ${penultimo.mes}.`;
      }
    }

    if (mesChart) mesChart.destroy();

    mesChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: meses.map(m => m.mes),
        datasets: [{
          label: "Vendas por mês",
          data: meses.map(m => m.valor),
          backgroundColor: "rgba(59,130,246,.35)",
          borderColor: "#3b82f6",
          borderWidth: 2,
          borderRadius: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: brl }
          }
        }
      }
    });
  }

  async function iniciarSprint1() {
    try {
      const response = await fetch(`${URL_VENDAS}&sprint=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Erro ao buscar vendas sprint 1: ${response.status}`);
      const csv = await response.text();
      const dados = parseCSV(csv);
      const base = montarBase(dados);
      const sprint = calcularSprint(base);

      renderizarSprint(base, sprint);
      renderizarComparativoMesesVendas(base);
    } catch (err) {
      console.error("Erro no sprint 1:", err);
      setText("alertaTitulo", "Erro ao carregar Sprint 1");
      setText("alertaTexto", "A base principal carregou, mas os cards de inteligência não conseguiram atualizar.");
      setClass("alertaMeta", "alerta-meta danger");
    }
  }

  window.addEventListener("DOMContentLoaded", iniciarSprint1);
  setInterval(iniciarSprint1, 300000);
})();
