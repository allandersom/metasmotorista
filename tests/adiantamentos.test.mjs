import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularSaldosPorDestino } from '../src/business/adiantamentos-calculo.js';
const a = (valor, destino, data='2026-09-07') => ({ motorista_nome:'PAULO', valor, destino, data });
const l = (valor, data='2026-09-13', extra=0) => ({motorista_nome:'PAULO',valor_faturamento:valor,valor_extra:extra,data});
const calc = (lancs, adv, mes='2026-09') => calcularSaldosPorDestino(lancs,adv,mes+'-01',mes+'-30')[0];
test('adiantamento negativo vira saldo positivo após domingo trabalhado',()=>{
 assert.equal(calc([], [a(100,'domingo')]).domingo.saldo,-10000);
 assert.equal(calc([l(250)], [a(100,'domingo')]).domingo.saldo,15000);
});
test('categorias independentes e extra não duplicado',()=>{
 const g=calc([l(250),l(180,'2026-09-08',80)],[a(100,'extra')]);
 assert.equal(g.domingo.saldo,25000); assert.equal(g.extra.saldo,-2000);
});
test('pendência continua no mês seguinte e nunca vai para meta',()=>{
 const g=calc([l(250,'2026-10-04')],[a(100,'domingo')],'2026-10');
 assert.equal(g.domingo.anterior,-10000);assert.equal(g.domingo.saldo,15000);assert.equal(g.meta,undefined);
});
test('exclusão devolve saldo e antigos aguardam classificação',()=>{
 const g=calc([l(250)],[{...a(100,'domingo'),cancelado_em:'2026-09-08'},a(50,null)]);
 assert.equal(g.domingo.saldo,25000);assert.equal(g.semDestino,5000);
});
test('feriado no domingo conta uma vez, cancelados não entram, centavos exatos',()=>{
 const g=calc([{...l(.3),is_feriado:true},{...l(99),cancelado_em:'2026-09-14'}],[a(.1,'domingo'),a(.2,'domingo')]);
 assert.equal(g.domingo.saldo,0);assert.equal(g.extra.saldo,0);
});
