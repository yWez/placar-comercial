const META = 250000;

const vendedores = {
  "Analu": 0,
  "Esterzinha": 0,
  "Julesco": 0,
  "Wes": 0
};

const dados = [
  {
    dia:"01/06",
    valores:[6544.30,6507.78,4847.56,4560.28]
  },
  {
    dia:"02/06",
    valores:[1747.55,4168.44,4879.54,3829.45]
  }
];

let totalVendido = 0;

dados.forEach(dia => {
  vendedores["Analu"] += dia.valores[0];
  vendedores["Esterzinha"] += dia.valores[1];
  vendedores["Julesco"] += dia.valores[2];
  vendedores["Wes"] += dia.valores[3];

  totalVendido += dia.valores.reduce((a,b)=>a+b,0);
});

const falta = META - totalVendido;
const percentual = ((totalVendido/META)*100).toFixed(2);

document.getElementById("vendido").innerHTML =
totalVendido.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

document.getElementById("falta").innerHTML =
falta.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

document.getElementById("percentual").innerHTML =
percentual + "%";

document.getElementById("barra").style.width =
percentual + "%";

const ranking = Object.entries(vendedores)
.sort((a,b)=>b[1]-a[1]);

let rankingHtml = "";

ranking.forEach((v,index)=>{
rankingHtml += `
<p>${index+1}º ${v[0]} - ${v[1].toLocaleString('pt-BR',{
style:'currency',
currency:'BRL'
})}</p>
`;
});

document.getElementById("ranking").innerHTML =
rankingHtml;

let tabela = `
<table>
<tr>
<th>Closer</th>
`;

dados.forEach(d=>{
tabela += `<th>${d.dia}</th>`;
});

tabela += "</tr>";

const nomes = ["Analu","Esterzinha","Julesco","Wes"];

nomes.forEach((nome,linha)=>{
tabela += `<tr><td>${nome}</td>`;

dados.forEach(d=>{
tabela += `<td>${d.valores[linha].toLocaleString('pt-BR',{
style:'currency',
currency:'BRL'
})}</td>`;
});

tabela += "</tr>";
});

tabela += "</table>";

document.getElementById("tabela").innerHTML =
tabela;
