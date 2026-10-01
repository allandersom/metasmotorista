import test from 'node:test';
import assert from 'node:assert/strict';
import { motoristasComMovimento, textoPesquisa, pagamentosPorMotorista, excluirMovimentoFinanceiro } from '../src/business/financeiro-controles.js';
test('pesquisa sem acentos e lista apenas movimentos no mês, inclusive pagamento sem serviço',()=>{
 const acerto={motoristas:[{nome:'JOÃO'},{nome:'ANA'},{nome:'BIA'},{nome:'CADASTRO'}],lancamentos:[{motorista_nome:'JOÃO',data:'2026-10-01'},{motorista_nome:'ANA',data:'2026-09-01'}],adiantamentos:[],pagamentosMeta:[{motorista_nome:'BIA',data_pagamento:'2026-10-02'}]};
 assert.deepEqual(motoristasComMovimento(acerto,'2026-10-01','2026-10-31').map(m=>m.nome),['JOÃO','BIA']);
 assert.equal(textoPesquisa('João').includes(textoPesquisa('joao')),true);
});
test('pagamentos da meta somados uma vez por motorista em centavos',()=>{
 const p=pagamentosPorMotorista([{motorista_nome:'ana',valor:100.10},{motorista_nome:'ANA',valor:49.90},{motorista_nome:'BIA',valor:20}]);
 assert.equal(p.get('ANA'),15000);assert.equal(p.get('BIA'),2000);
});
test('exclusão de adiantamento cancela somente o ID escolhido mesmo com motorista e data iguais',async()=>{
 const registros=[{id:'a',motorista_nome:'ANA',data:'2026-10-01'},{id:'b',motorista_nome:'ANA',data:'2026-10-01'}];
 const client={async rpc(fn,args){assert.equal(fn,'cancelar_adiantamento');assert.deepEqual(args,{p_id:'a'});registros.find(r=>r.id===args.p_id).cancelado_em='agora';return {data:args.p_id,error:null};}};
 await excluirMovimentoFinanceiro(client,{...registros[0],destino:'extra'});
 assert.equal(registros[0].cancelado_em,'agora');assert.equal(registros[1].cancelado_em,undefined);assert.equal(registros.length,2);
});
test('exclusão da meta exige ID, motorista e data e preserva outro lançamento',async()=>{
 let registros=[{id:'a',motorista_nome:'ANA',data_pagamento:'2026-10-01'},{id:'b',motorista_nome:'ANA',data_pagamento:'2026-10-01'}];
 const client={from(t){assert.equal(t,'pagamentos_motoristas');const filtros=[];const q={delete(){return q},eq(k,v){filtros.push([k,v]);return q},async select(){assert.deepEqual(filtros,[['id','a'],['motorista_nome','ANA'],['data_pagamento','2026-10-01']]);const removidos=registros.filter(r=>filtros.every(([k,v])=>r[k]===v));registros=registros.filter(r=>!removidos.includes(r));return {data:removidos,error:null}}};return q;}};
 await excluirMovimentoFinanceiro(client,{id:'a',motorista_nome:'ANA',data:'2026-10-01',destino:'meta'});
 assert.deepEqual(registros.map(r=>r.id),['b']);
 await assert.rejects(()=>excluirMovimentoFinanceiro(client,{motorista_nome:'ANA',data:'2026-10-01',destino:'meta'}),/inválido/);
});
