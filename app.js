
const CSV_URL =
"https://docs.google.com/spreadsheets/d/e/2PACX-1vQmVbNM2gBp5BzWLEVmp4gXvXLX9B-Lv62vqXiTLfN1IJ26uhe8M9fbudwtJVP4WVCQVdW7qd_NnewY/pub?gid=1536459638&single=true&output=csv";

const META = 250000;

async function carregarDados() {

    const response = await fetch(CSV_URL);
    const csv = await response.text();

    const linhas = csv.trim().split("\n");

    const cabecalho = linhas[0].split(",");

    const dias = cabecalho.slice(1);

    let vendedores = {};
    let totalVendido = 0;

    let tabela = `
    <table>
        <tr>
            <th>Closer</th>
            ${dias.map(d => `<th>${d}</th>`).join("")}
        </tr>
    `;

    for(let i = 1; i < linhas.length; i++){

        const colunas = linhas[i].split(",");

        const nome = colunas[0];

        vendedores[nome] = 0;

        tabela += `<tr><td>${nome}</td>`;

        for(let j = 1; j < colunas.length; j++){

            let valor = parseFloat(
                colunas[j]
                .replace(/\./g,"")
                .replace(",",".")
            ) || 0;

            vendedores[nome] += valor;
            totalVendido += valor;

            tabela += `
                <td>
                    ${valor.toLocaleString("pt-BR",{
                        style:"currency",
                        currency:"BRL"
                    })}
                </td>
            `;
        }

        tabela += "</tr>";
    }

    tabela += "</table>";

    document.getElementById("tabela").innerHTML = tabela;

    const falta = META - totalVendido;
    const percentual = ((totalVendido / META) * 100).toFixed(2);

    document.getElementById("vendido").innerHTML =
        totalVendido.toLocaleString("pt-BR",{
            style:"currency",
            currency:"BRL"
        });

    document.getElementById("falta").innerHTML =
        falta.toLocaleString("pt-BR",{
            style:"currency",
            currency:"BRL"
        });

    document.getElementById("percentual").innerHTML =
        percentual + "%";

    document.getElementById("barra").style.width =
        percentual + "%";

    const ranking = Object.entries(vendedores)
        .sort((a,b)=>b[1]-a[1]);

    let rankingHtml = "";

    ranking.forEach((v,index)=>{

        const medalha =
            index === 0 ? "🥇" :
            index === 1 ? "🥈" :
            index === 2 ? "🥉" : "🏅";

        rankingHtml += `
            <p>
                ${medalha}
                ${v[0]}
                -
                ${v[1].toLocaleString("pt-BR",{
                    style:"currency",
                    currency:"BRL"
                })}
            </p>
        `;
    });

    document.getElementById("ranking").innerHTML =
        rankingHtml;

    const agora = new Date();

    let ultimaAtualizacao =
        agora.toLocaleString("pt-BR");

    const el = document.getElementById("ultimaAtualizacao");

    if(el){
        el.innerHTML =
        "Última atualização: " + ultimaAtualizacao;
    }
}

carregarDados();

setInterval(carregarDados, 300000);
```
