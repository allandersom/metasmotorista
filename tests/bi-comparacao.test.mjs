import test from 'node:test';
import assert from 'node:assert/strict';
import { resumirPeriodoBI } from '../src/business/bi-comparacao.js';
const linhas=[{data:'2026-09-01',motorista_nome:'ANA',quantidade_servicos:20},{data:'2026-09-02',motorista_nome:'ANA',quantidade_servicos:10},{data:'2026-09-02',motorista_nome:'BIA',tipo_veiculo:'cacamba',quantidade_servicos:5},{data:'2026-09-06',motorista_nome:'ANA',quantidade_servicos:100},{data:'2026-09-03',motorista_nome:'ANA',quantidade_servicos:99,is_feriado:true},{data:'2026-09-04',motorista_nome:'ANA',quantidade_servicos:88,observacao:'[EXTRA R$ 20]'}];
test('BI separa caixas e viagens e exclui domingos feriados extras e cancelados',()=>{
 const r=resumirPeriodoBI([...linhas,{data:'2026-09-01',quantidade_servicos:100,cancelado_em:'x'}],'2026-09-01','2026-09-06','2026-09-06');
 assert.equal(r.caixas,30);assert.equal(r.viagens,5);assert.equal(r.dias,4);assert.equal(r.media,7.5);assert.equal(r.projecao,30);
});
test('BI filtra turno, inclui dias zerados e projeta sem contar futuro como realizado',()=>{
 const r=resumirPeriodoBI(linhas,'2026-09-01','2026-09-06','2026-09-01',new Set(['ANA']));
 assert.equal(r.caixas,20);assert.equal(r.viagens,0);assert.equal(r.projecao,80);
});
test('BI não inventa projeção sem base',()=>{
 assert.equal(resumirPeriodoBI([],'2026-09-01','2026-09-06','2026-08-31').projecao,null);
 assert.equal(resumirPeriodoBI([],'2026-09-01','2026-09-06','2026-09-06').projecao,null);
});
import { compararMotoristasAtivosBI } from '../src/business/bi-comparacao.js';
test('comparação individual inclui ativos zerados e respeita turno e desligamento',()=>{
 const cadastro=[{nome:'ANA',turno:'dia',status:'ativo'},{nome:'BIA',turno:'noite',status:'ativo'},{nome:'ZERO',turno:'dia',status:'ativo'},{nome:'INATIVO',status:'inativo'},{nome:'SAIU',data_demissao:'2026-09-01'},{nome:'DESLIGADO',turno:'dia'}];
 const r=compararMotoristasAtivosBI(cadastro,linhas,['2026-09-01','2026-09-01'],['2026-09-02','2026-09-02'],'2026-09-06','dia',new Set(['DESLIGADO']));
 assert.deepEqual(r.map(m=>m.nome),['ANA','ZERO']);
 assert.equal(r[0].base.caixas,20);assert.equal(r[0].atual.caixas,10);assert.equal(r[1].atual.caixas,0);assert.equal(r[1].atual.projecao,null);
});

import { ultimosMesesCompletosBI } from '../src/business/bi-comparacao.js';
test('períodos padrão usam dois meses completos, inclusive virada do ano e fevereiro',()=>{
 assert.deepEqual(ultimosMesesCompletosBI('2026-10-02'),{a:['2026-08-01','2026-08-31'],b:['2026-09-01','2026-09-30']});
 assert.deepEqual(ultimosMesesCompletosBI('2026-01-01'),{a:['2025-11-01','2025-11-30'],b:['2025-12-01','2025-12-31']});
 assert.deepEqual(ultimosMesesCompletosBI('2024-03-31'),{a:['2024-01-01','2024-01-31'],b:['2024-02-01','2024-02-29']});
});
