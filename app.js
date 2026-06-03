const JSON_URL =
"https://opensheet.elk.sh/1rx8Nd0koxXdCJ4_pZj26TiEwtnD1un4l8j1hqE2Fs3I/DASHBOARD";

function converterNumero(valor) {
  if (!valor) return 0;

  return Number(
    valor
      .toString()
      .replace(/\./g, "")
      .replace(",", ".")
  ) || 0;
}

async function carregarDados() {

  try {

    const response = await fetch(JSON_URL);
    const dados = await response.json();

    const vendedores = dados.filter(item =>
      ["Analu","Esterzinha","Julesco","Wes"]
      .includes(item.Closer)
    );

    const totalMes =
      converterNumero(
        dados.find(x => x.Closer === "Total Vendido/mes")?.["01/06"]
      );

    const meta =
      converterNumero(
        dados.find(x => x.Closer === "Meta")?.["01/06"]
      );

    const faltando =
      converterNumero(
        dados.find(x => x.Closer === "Faltando")?.["01/06"]
      );

    const percentual =
      ((totalMes / meta) * 100).toFixed(2);

    document.getElementById("vendido").innerHTML =
      totalMes.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      });

    document.getElementById("falta").innerHTML =
      faltando.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      });

    document.getElementById("percentual").innerHTML =
      percentual + "%";

    document.getElementById("barra").style.width =
      percentual + "%";

    const dias = Object.keys(vendedores[0])
      .filter(k => k.includes("/"));

    let tabelaHtml = `
      <table>
        <tr>
          <th>Closer</th>
          ${dias.map(d => `<th>${d}</th>`).join("")}
        </tr>
    `;

    let ranking = [];

    vendedores.forEach(vendedor => {

      let totalCloser = 0;

      tabelaHtml += `<tr><td>${vendedor.Closer}</td>`;

      dias.forEach(dia => {

        const valor =
          converterNumero(vendedor[dia]);

        totalCloser += valor;

        tabelaHtml += `
          <td>
            ${valor.toLocaleString("pt-BR", {
              style:"currency",
              currency:"BRL"
            })}
          </td>
        `;
      });

      tabelaHtml += "</tr>";

      ranking.push({
        nome: vendedor.Closer,
        total: totalCloser
      });

    });

    tabelaHtml += "</table>";

    document.getElementById("tabela").innerHTML =
      tabelaHtml;

    ranking.sort((a,b) => b.total - a.total);

    let rankingHtml = "";

    ranking.forEach((v,index) => {

      const medalha =
        index === 0 ? "🥇" :
        index === 1 ? "🥈" :
        index === 2 ? "🥉" : "🏅";

      rankingHtml += `
        <p>
          ${medalha}
          ${v.nome}
          -
          ${v.total.toLocaleString("pt-BR", {
            style:"currency",
            currency:"BRL"
          })}
        </p>
      `;
    });

    document.getElementById("ranking").innerHTML =
      rankingHtml;

    const ultimaAtualizacao =
      document.getElementById("ultimaAtualizacao");

    if (ultimaAtualizacao) {
      ultimaAtualizacao.innerHTML =
        "Última atualização: " +
        new Date().toLocaleString("pt-BR");
    }

  } catch(err) {

    console.error(err);

  }

}

carregarDados();

setInterval(carregarDados, 300000);
