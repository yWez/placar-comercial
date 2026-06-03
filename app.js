const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmVbNM2gBp5BzWLEVmp4gXvXLX9B-Lv62vqXiTLfN1IJ26uhe8M9fbudwtJVP4WVCQVdW7qd_NnewY/pub?gid=1899560077&single=true&output=csv";

async function carregarDados() {

    try {

        const response = await fetch(CSV_URL);
        const texto = await response.text();

        const linhas = texto.trim().split("\n");

        console.log(linhas);

        if (linhas.length < 2) return;

        const cabecalho = linhas[0].split(",");

        const dias = cabecalho.slice(1);

        let vendedores = {};

        let tabelaHtml = `
        <table>
            <tr>
                <th>Closer</th>
                ${dias.map(d => `<th>${d}</th>`).join("")}
            </tr>
        `;

        let totalMes = 0;
        let totalHoje = 0;

        for (let i = 1; i < linhas.length; i++) {

            const colunas = linhas[i].split(",");

            const nome = colunas[0]?.trim();

            if (!nome) continue;

            if (
                nome === "Total Vendido/dia" ||
                nome === "Total Vendido/mes" ||
                nome === "Meta" ||
                nome === "Faltando" ||
                nome === "Dias Corridos" ||
                nome === "Meta Diária"
            ) {
                continue;
            }

            vendedores[nome] = 0;

            tabelaHtml += `<tr><td>${nome}</td>`;

            for (let j = 1; j < colunas.length; j++) {

                let valor =
                    Number(
                        (colunas[j] || "0")
                            .replace(/\./g, "")
                            .replace(",", ".")
                    ) || 0;

                vendedores[nome] += valor;

                tabelaHtml += `
                    <td>
                        ${valor.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL"
                        })}
                    </td>
                `;
            }

            tabelaHtml += "</tr>";
        }

        tabelaHtml += "</table>";

        document.getElementById("tabela").innerHTML = tabelaHtml;

        // LOCALIZA AS LINHAS ESPECIAIS

        const linhaTotalDia =
            linhas.find(l => l.startsWith("Total Vendido/dia"));

        const linhaTotalMes =
            linhas.find(l => l.startsWith("Total Vendido/mes"));

        const linhaMeta =
            linhas.find(l => l.startsWith("Meta"));

        const linhaFaltando =
            linhas.find(l => l.startsWith("Faltando"));

        const linhaMetaDia =
            linhas.find(l => l.startsWith("Meta Diária"));

        function pegarPrimeiroNumero(linha) {

            if (!linha) return 0;

            const partes = linha.split(",");

            const valor =
                (partes[1] || "0") +
                "," +
                (partes[2] || "00");

            return Number(
                valor
                    .replace(/\./g, "")
                    .replace(",", ".")
            ) || 0;
        }

        totalMes = pegarPrimeiroNumero(linhaTotalMes);

        const meta = pegarPrimeiroNumero(linhaMeta);

        const faltando = pegarPrimeiroNumero(linhaFaltando);

        const metaDia = pegarPrimeiroNumero(linhaMetaDia);

        // TOTAL DE HOJE

        if (linhaTotalDia) {

            const partes = linhaTotalDia.split(",");

            const hojeColuna = new Date().getDate();

            const indice = hojeColuna * 2 - 1;

            const valorHoje =
                (partes[indice] || "0") +
                "," +
                (partes[indice + 1] || "00");

            totalHoje =
                Number(
                    valorHoje
                        .replace(/\./g, "")
                        .replace(",", ".")
                ) || 0;
        }

        // CARDS

        document.getElementById("meta").innerHTML =
            meta.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL"
            });

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

        const percentual =
            ((totalMes / meta) * 100).toFixed(2);

        document.getElementById("percentual").innerHTML =
            percentual + "%";

        document.getElementById("barra").style.width =
            percentual + "%";

        document.getElementById("hoje").innerHTML =
            totalHoje.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL"
            });

        document.getElementById("metaDia").innerHTML =
            metaDia.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL"
            });

        // LIDER

        const ranking = Object.entries(vendedores)
            .sort((a, b) => b[1] - a[1]);

        const lider = ranking[0];

        document.getElementById("lider").innerHTML =
            `🥇 ${lider[0]} - ${lider[1].toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL"
            })}`;

        // RANKING

        let rankingHtml = "";

        ranking.forEach((v, index) => {

            const medalha =
                index === 0 ? "🥇" :
                index === 1 ? "🥈" :
                index === 2 ? "🥉" : "🏅";

            rankingHtml += `
                <div class="ranking-card">
                    <h3>${medalha} ${v[0]}</h3>
                    <p>
                    ${v[1].toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL"
                    })}
                    </p>
                </div>
            `;
        });

        document.getElementById("ranking").innerHTML =
            rankingHtml;

        document.getElementById("qtdVendas").innerHTML =
            "-";

        document.getElementById("ultimaAtualizacao").innerHTML =
            "Última atualização: " +
            new Date().toLocaleString("pt-BR");

    } catch (erro) {

        console.error("ERRO:", erro);

    }

}

carregarDados();

setInterval(carregarDados, 300000);
