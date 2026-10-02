import test from 'node:test';
import assert from 'node:assert/strict';

const tabelas = {
    lancamentos: [{ data: '2026-08-03', motorista_nome: 'ANA', valor_faturamento: 500, valor_extra: 100, quantidade_servicos: 10, tipo_veiculo: 'poliguindaste', status_servico: 'normal' }],
    pagamentos_motoristas: [{ id: 'p1', data_pagamento: '2026-08-05', motorista_nome: 'ANA', valor: 50 }],
    adiantamentos_motoristas: [{ id: 'a1', data: '2026-08-03', motorista_nome: 'ANA', valor: 200 }],
};
function elemento(value = '') {
    return { value, style: {}, children: [], textContent: '', innerText: '', innerHTML: '',
        appendChild(child) { this.children.push(child); }, replaceChildren() { this.children = []; },
        setAttribute() {}, addEventListener() {},
    };
}
const elementos = new Map();
const el = id => {
    if (!elementos.has(id)) elementos.set(id, elemento());
    return elementos.get(id);
};
globalThis.document = { getElementById: el, createElement: () => elemento() };
globalThis.window = {
    _apenasUteis: true, bancoDadosCloud: {}, todosMotoristasCloud: [],
    carregarDiasUteis: () => 22, calcularSlaMotorista: () => 22, getMetaDiaria: () => 4,
    calcularPontosMotorista: (_nome, qtd) => qtd,
    supabaseClient: { from(tabela) {
        let rows = [...tabelas[tabela]];
        const q = {
            select() { return q; }, order() { return q; },
            is(key) { rows = rows.filter(r => r[key] == null); return q; },
            gte(key, value) { rows = rows.filter(r => r[key] >= value); return q; },
            lte(key, value) { rows = rows.filter(r => r[key] <= value); return q; },
            range(a, b) { rows = rows.slice(a, b + 1); return q; },
            then(resolve) { resolve({ data: rows, error: null }); },
        };
        return q;
    } },
};
await import('../src/business/financeiro.js');
await new Promise(resolve => queueMicrotask(resolve));

test('ranking por período não desconta pagamentos agora controlados no Financeiro', async () => {
    el('dataRankingInicio').value = '2026-08-01';
    el('dataRankingFim').value = '2026-08-31';
    await window.gerarRankingPeriodo();
    assert.equal(el('totalFatPeriodo').innerText, 'R$ 400,00');
    assert.equal(el('totalQtdPeriodo').innerText, '10 cx | 0 vg');
    assert.doesNotMatch(el('listaRankingDiario').children[0].innerHTML, /Adiantamento restante/);
    assert.equal(el('listaPagamentos').children.length, 0, 'histórico de pagamentos não é carregado no ranking');
});

test('ranking parcial não repete desconto do fechamento; ranking geral continua bruto', async () => {
    el('dataRankingFim').value = '2026-08-30';
    await window.gerarRankingPeriodo();
    assert.equal(el('totalFatPeriodo').innerText, 'R$ 400,00');
    window._apenasUteis = false;
    await window.gerarRankingPeriodo();
    assert.equal(el('totalFatPeriodo').innerText, 'R$ 500,00');
});

test('exclusão de adiantamento não altera a meta nem o pagamento normal', async () => {
    window._apenasUteis = true;
    el('dataRankingFim').value = '2026-08-31';
    tabelas.adiantamentos_motoristas[0].cancelado_em = '2026-09-01';
    await window.gerarRankingPeriodo();
    assert.equal(el('totalFatPeriodo').innerText, 'R$ 400,00');
});
