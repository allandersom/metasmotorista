import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularMetasFinanceiro, ehDiaEspecialRanking } from '../src/business/meta-financeiro.js';
const lancamentos = [
 {motorista_nome:'ANA',data:'2026-09-01',valor_faturamento:500,valor_extra:100,quantidade_servicos:10},
 {motorista_nome:'ANA',data:'2026-09-06',valor_faturamento:250,quantidade_servicos:5},
 {motorista_nome:'ANA',data:'2026-09-07',valor_faturamento:300,is_feriado:true,quantidade_servicos:5},
 {motorista_nome:'ANA',data:'2026-09-08',valor_faturamento:80,observacao:'[EXTRA R$ 20]',quantidade_servicos:4},
 {motorista_nome:'ANA',data:'2026-09-09',valor_faturamento:999,cancelado_em:'2026-09-10'},
 {motorista_nome:'ANA',data:'2026-08-01',valor_faturamento:1000}
];
test('meta usa a mesma regra do Leaderboard e mantém o valor embutido de um dia normal',()=>{
 const r=calcularMetasFinanceiro(lancamentos,[{motorista_nome:'ANA',data_pagamento:'2026-09-02',valor:100}], '2026-09-01','2026-09-30').get('ANA');
 assert.equal(r.produzido,50000);assert.equal(r.adiantado,10000);assert.equal(r.saldo,40000);
 assert.equal(ehDiaEspecialRanking('2026-09-08',{observacao:'[EXTRA R$ 20]',pontos:0}),true);
});
test('preserva pagamentos antigos, centavos e motorista sem produção, sem incluir outro mês',()=>{
 const r=calcularMetasFinanceiro([], [{motorista_nome:'BIA',data_pagamento:'2026-09-02',valor:'10.15'},{motorista_nome:'BIA',data_pagamento:'2026-08-01',valor:99}], '2026-09-01','2026-09-30').get('BIA');
 assert.equal(r.saldo,-1015);
});
test('excluir pagamento restaura apenas o saldo da meta',()=>{
 const r=calcularMetasFinanceiro(lancamentos,[], '2026-09-01','2026-09-30').get('ANA');
 assert.equal(r.saldo,50000);
});
