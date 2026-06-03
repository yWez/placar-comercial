const URL =
"https://opensheet.elk.sh/1rx8Nd0koxXdCJ4_pZj26TiEwtnD1un4l8j1hqE2Fs3I/DASHBOARD";

function moeda(valor) {
    return valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function numero(valor) {

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

        const response = await fetch(URL);

        const dados = await response.json();

        console.log("JSON carregado:", dados);

        if (!dados.length) return;

        let vendedores = {};

        let totalMes = 0;
        let meta = 0;
        let faltando = 0;
        let metaDia = 0;
        let vendidoHoje = 0;

        const hoje = new Date().getDate();
        const colunaHoje =
            hoje.toString().padStart(2, "0") + "/06";

        let tabelaHtml = `
        <table>
            <tr>
                <th>Closer</th>
        `;

        const dias = Object.keys(dados[0])
            .filter(k => k !== "Closer");

        dias.forEach(d => {
            tabelaHtml += `<th>${d}</th>`;
        });

        tabelaHtml += `</tr>`;

        dados.forEach(linha => {

            const nome = linha.Closer?.trim();

            if (!nome) return;

            if (
                nome === "Total Vendido/dia" ||
                nome === "Total Vendido/mes" ||
                nome === "Meta" ||
                nome === "Faltando" ||
                nome === "Meta Diária"
            ) {

                if (nome === "Total Vendido/mes") {
                    totalMes = numero(linha["01/06"]);
                }

                if (nome === "Meta") {
                    meta = numero(linha["01/06"]);
                }

                if (nome === "Faltando") {
                    faltando = numero(linha["01/06"]);
                }

                if (nome === "Meta Diária") {
                    metaDia = numero(linha["01/06"]);
                }

                if (
                    nome === "Total Vendido/dia" &&
                    linha[colunaHoje]
                ) {
                    vendidoHoje =
                        numero(linha[colunaHoje]);
                }

                return;
            }

            vendedores[nome] = 0;

            tabelaHtml += `<tr><td>${nome}</td>`;

            dias.forEach(dia => {

                const valor =
                    numero(linha[dia]);

                vendedores[nome] += valor;

                tabelaHtml += `
                    <td>${moeda(valor)}</td>
                `;
            });

            tabelaHtml += `</tr>`;
        });

        tabelaHtml += `</table>`;

        document.getElementById("tabela").innerHTML =
            tabelaHtml;

        document.getElementById("meta").innerHTML =
            moeda(meta);

        document.getElementById("vendido").innerHTML =
            moeda(totalMes);

        document.getElementById("falta").innerHTML =
            moeda(faltando);

        const percentual =
            meta > 0
                ? ((totalMes / meta) * 100).toFixed(2)
                : 0;

        document.getElementById("percentual").innerHTML =
            percentual + "%";

        document.getElementById("barra").style.width =
            percentual + "%";

        const cardHoje =
            document.getElementById("hoje");

        if (cardHoje) {
            cardHoje.innerHTML =
                moeda(vendidoHoje);
        }

        const cardMetaDia =
            document.getElementById("metaDia");

        if (cardMetaDia) {
            cardMetaDia.innerHTML =
                moeda(metaDia);
        }

        const ranking = Object.entries(vendedores)
            .sort((a, b) => b[1] - a[1]);

        if (ranking.length > 0) {

            const lider = ranking[0];

            const liderEl =
                document.getElementById("lider");

            if (liderEl) {
                liderEl.innerHTML =
                    `🥇 ${lider[0]} - ${moeda(lider[1])}`;
            }
        }

        let rankingHtml = "";

        ranking.forEach((v, index) => {

            const medalha =
                index === 0 ? "🥇" :
                index === 1 ? "🥈" :
                index === 2 ? "🥉" :
                "🏅";

            rankingHtml += `
                <div class="ranking-card">
                    <h3>${medalha} ${v[0]}</h3>
                    <p>${moeda(v[1])}</p>
                </div>
            `;
        });

        document.getElementById("ranking").innerHTML =
            rankingHtml;

        const qtdVendas =
            document.getElementById("qtdVendas");

        if (qtdVendas) {
            qtdVendas.innerHTML = "-";
        }

        const ultimaAtualizacao =
            document.getElementById(
                "ultimaAtualizacao"
            );

        if (ultimaAtualizacao) {

            ultimaAtualizacao.innerHTML =
                "Última atualização: " +
                new Date().toLocaleString(
                    "pt-BR"
                );
        }

    } catch (erro) {

        console.error(
            "ERRO AO CARREGAR DASHBOARD:",
            erro
        );
    }
}

carregarDados();

setInterval(
    carregarDados,
    300000
);
