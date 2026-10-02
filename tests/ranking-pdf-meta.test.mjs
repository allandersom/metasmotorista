import { ehDiaEspecialRanking } from '../src/business/meta-financeiro.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pagamentosPorMotorista } from '../src/business/financeiro-controles.js';
import { formatarMoeda } from '../src/utils/format.js';
function row(){const attrs={'data-perc':'100','data-motorista':'ANA','data-valor':'500'};const nome={innerText:'#1 - ANA (10 cx)'},fat={innerText:'R$ 500,00'};return {getAttribute:k=>attrs[k],hasAttribute:k=>k in attrs,setAttribute:(k,v)=>{attrs[k]=v},querySelector:s=>s==='.diario-nome'?nome:fat,cloneNode:()=>row()};}
test('PDF do ranking consulta meta atualizada, desconta uma vez e preserva a tela',async()=>{
 const original=row();let html='',pago=100;
 const document={getElementById:id=>({value:id==='dataRankingInicio'?'2026-10-01':id==='dataRankingFim'?'2026-10-31':'',innerText:id==='totalQtdPeriodo'?'10 cx | 0 vg':''}),querySelectorAll:()=>[original]};
 const window={_apenasUteis:true,todosMotoristasCloud:[],bancoDadosCloud:{'2026-10-02':{ANA:{valor:700}},'2026-10-04':{ANA:{valor:250}}},open:()=>({document:{write:s=>{html=s},close(){}}})};
 const fonte=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');const a=fonte.indexOf('window.exportarRankingPeriodoPDF = async function()');const b=fonte.indexOf('window.obterRankElo',a);
 new Function('window','document','buscarPagamentos','pagamentosPorMotorista','formatarMoeda','ehDiaEspecialRanking','alert',fonte.slice(a,b))(window,document,async()=>[{motorista_nome:'ANA',valor:pago}],pagamentosPorMotorista,formatarMoeda,ehDiaEspecialRanking,m=>{throw new Error(m)});
 await window.exportarRankingPeriodoPDF();assert.match(html,/R\$ 400,00/);assert.match(html,/Adiantamento descontado: R\$ 100,00/);
 assert.match(html,/Total da meta mensal \(10\/2026\): <strong>R\$ 700,00/);
 assert.match(html,/Faturamento total da meta/);
 assert.match(html,/Valor que falta pagar/);
 assert.doesNotMatch(html,/Meta abatida|Saldo após pagamentos da meta/);
 pago=150;await window.exportarRankingPeriodoPDF();assert.match(html,/R\$ 350,00/);assert.equal(original.querySelector('.diario-faturamento').innerText,'R$ 500,00');
});
