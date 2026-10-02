// Pagamentos de meta já existentes, agora consultados pelo Financeiro.
export async function buscarPagamentos(inicio, fim) {
    const pagamentos = [];
    for (let offset = 0; ; offset += 1000) {
        const { data, error } = await window.supabaseClient.from('pagamentos_motoristas')
            .select('id,motorista_nome,valor,data_pagamento').gte('data_pagamento', inicio)
            .lte('data_pagamento', fim).order('data_pagamento', { ascending: false }).order('id')
            .range(offset, offset + 999);
        if (error) throw new Error('Não foi possível carregar os pagamentos da meta. Verifique a conexão e os SQLs 03 e 04.');
        pagamentos.push(...(data || []));
        if (!data || data.length < 1000) return pagamentos;
    }
}
