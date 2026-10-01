const normalizar = nome => String(nome || '').trim().toUpperCase();
export const textoPesquisa = texto => normalizar(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function motoristasComMovimento(acerto, inicio, fim) {
    const nomes = new Set();
    const adicionar = (registros, campo, ignorarCancelados) => {
        for (const r of registros || []) {
            if (r[campo] >= inicio && r[campo] <= fim && (!ignorarCancelados || !r.cancelado_em)) nomes.add(normalizar(r.motorista_nome));
        }
    };
    adicionar(acerto.lancamentos, 'data', true);
    // Mantém no histórico registros excluídos no mês, sem contabilizá-los no saldo.
    adicionar(acerto.adiantamentos, 'data', false);
    adicionar(acerto.pagamentosMeta, 'data_pagamento', false);
    return acerto.motoristas.filter(m => nomes.has(normalizar(m.nome)));
}

export function pagamentosPorMotorista(pagamentos) {
    const totais = new Map();
    for (const p of pagamentos) {
        const nome = normalizar(p.motorista_nome);
        totais.set(nome, (totais.get(nome) || 0) + Math.round(Number(p.valor) * 100));
    }
    return totais;
}

export async function excluirMovimentoFinanceiro(client, item) {
    if (!item?.id || !item.motorista_nome || !item.data) throw new Error('Registro inválido para exclusão.');
    if (item.destino === 'meta') {
        const { data, error } = await client.from('pagamentos_motoristas').delete()
            .eq('id', item.id).eq('motorista_nome', item.motorista_nome).eq('data_pagamento', item.data).select('id');
        if (error) throw error;
        if (data?.length !== 1 || data[0].id !== item.id) throw new Error('Pagamento não encontrado ou exclusão não permitida.');
    } else {
        const { data, error } = await client.rpc('cancelar_adiantamento', { p_id: item.id });
        if (error) throw error;
        if (data !== item.id) throw new Error('A exclusão do registro não foi confirmada.');
    }
}
