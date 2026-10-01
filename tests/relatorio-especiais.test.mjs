import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularSaldosPorDestino } from '../src/business/adiantamentos-calculo.js';
import { gerarRelatorioEspeciais } from '../src/business/relatorio-especiais.js';
const lancamentos=[{motorista_nome:'PAULO',data:'2026-09-13',valor_faturamento:250},{motorista_nome:'PAULO',data:'2026-09-09',valor_faturamento:180,valor_extra:80}];
const adiantamentos=[{motorista_nome:'PAULO',data:'2026-09-07',valor:100,destino:'domingo'},{motorista_nome:'BIA',data:'2026-09-07',valor:50,destino:'domingo'},{motorista_nome:'PAULO',data:'2026-09-20',valor:999,destino:'extra'}];
test('PDF mostra saldo líquido por destino e não compensa dívidas entre motoristas',()=>{
 const motoristas=calcularSaldosPorDestino(lancamentos,adiantamentos,'2026-09-01','2026-09-14');
 const html=gerarRelatorioEspeciais({motoristas,lancamentos},'2026-09-01','2026-09-14',[]).replaceAll('\u00a0',' ');
 assert.match(html,/class="money payable">R\$ 150,00/);
 assert.match(html,/Adiantamento pendente: R\$ 50,00/);
 assert.match(html,/class="money payable">R\$ 0,00<small>Sem pagamento/);
 assert.match(html,/<h2>Domingos/);
 assert.match(html,/<h2>Feriados/);
 assert.doesNotMatch(html,/landscape|999,00|class="abatimento"/);
 assert.match(html,/class="money payable">R\$ 80,00/);
 assert.match(html,/class="money deduction">R\$ 100,00/);
 assert.match(html,/Valor bruto<\/span><strong>R\$ 330,00/);
 assert.match(html,/Adiantamento descontado<\/span><strong>R\$ 100,00/);
 assert.match(html,/Valor que falta pagar<\/span><strong>R\$ 230,00/);

});
test('período parcial transporta somente pendência e respeita início e fim',()=>{
 const resumo=calcularSaldosPorDestino(lancamentos,adiantamentos,'2026-09-10','2026-09-14');
 const p=resumo.find(m=>m.nome==='PAULO');
 assert.equal(p.domingo.anterior,-10000); assert.equal(p.domingo.produzido,25000); assert.equal(p.domingo.saldo,15000); assert.equal(p.extra.produzido,0);
});
test('intervalo com dois meses inclui serviços de ambos sem reaplicar dívida',()=>{
 const resumo=calcularSaldosPorDestino([...lancamentos,{motorista_nome:'PAULO',data:'2026-10-04',valor_faturamento:100}],adiantamentos.slice(0,1),'2026-09-01','2026-10-10');
 assert.equal(resumo[0].domingo.produzido,35000);assert.equal(resumo[0].domingo.saldo,25000);
});

test('sem adiantamento omite coluna de desconto e mantém o líquido integral',()=>{
 const motoristas=calcularSaldosPorDestino(lancamentos,[],'2026-09-01','2026-09-14');
 const html=gerarRelatorioEspeciais({motoristas,lancamentos},'2026-09-01','2026-09-14').replaceAll('\u00a0',' ');
 assert.doesNotMatch(html,/Adiantamento descontado<\/span>|Adiantamento<br>descontado|class="money deduction"|class="pending-note"/);
 assert.match(html,/Valor que falta pagar<\/span><strong>R\$ 330,00/);
});
