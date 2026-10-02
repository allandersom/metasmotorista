// A mesma regra usada pelo Leaderboard Mensal, inclusive seus extras embutidos.
export function ehDiaEspecialRanking(dataStr, dados) {
    if (new Date(dataStr + 'T00:00:00').getDay() === 0 || dados.isFeriado === true) return true;
    const extra = dados.observacao && (dados.observacao.includes('[EXTRA R$ 20]') || dados.observacao.includes('[EXTRA R$20]'));
    return Boolean(extra && dados.pontos === 0);
}

export function calcularMetasFinanceiro(lancamentos, pagamentos, inicio, fim) {
    const metas = new Map();
    const obter = nome => {
        nome = String(nome || '').trim().toUpperCase();
        if (!metas.has(nome)) metas.set(nome, { nome, produzido: 0, adiantado: 0, anterior: 0, saldo: 0 });
        return metas.get(nome);
    };
    for (const l of lancamentos) {
        if (l.cancelado_em || !l.motorista_nome || !l.data || l.data < inicio || l.data > fim) continue;
        const dados = {
            isFeriado: l.is_feriado, observacao: l.observacao,
            pontos: l.observacao?.includes('[EXTRA R$ 20]') ? 0 : l.quantidade_servicos,
        };
        if (!ehDiaEspecialRanking(l.data, dados)) obter(l.motorista_nome).produzido += Math.round((Number(l.valor_faturamento) || 0) * 100);
    }
    for (const p of pagamentos) {
        if (!p.motorista_nome || p.data_pagamento < inicio || p.data_pagamento > fim) continue;
        obter(p.motorista_nome).adiantado += Math.round((Number(p.valor) || 0) * 100);
    }
    for (const m of metas.values()) m.saldo = m.produzido - m.adiantado;
    return metas;
}
