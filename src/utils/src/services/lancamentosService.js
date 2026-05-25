/**
 * src/services/lancamentosService.js
 *
 * RESPONSABILIDADE: Comunicação exclusiva com o Supabase para a tabela de 'lancamentos'.
 * Nenhuma função aqui deve dar 'alert' ou mexer no HTML. Elas apenas recebem dados, 
 * falam com o banco e retornam sucesso (ou jogam um erro).
 */

/**
 * Apaga todos os lançamentos de um motorista em um mês específico.
 * * @param {Object} supabase - O cliente Supabase.
 * @param {string} motoristaNome - Nome exato do motorista.
 * @param {string} mesStr - Mês no formato "YYYY-MM".
 */
export async function apagarMesMotorista(supabase, motoristaNome, mesStr) {
    const { error } = await supabase
        .from('lancamentos')
        .delete()
        .eq('motorista_nome', motoristaNome)
        .like('data', `${mesStr}%`); // O % funciona como um coringa para pegar todos os dias

    if (error) throw error;
    return true;
}

/**
 * Salva ou atualiza (Upsert) um lançamento diário.
 * * @param {Object} supabase - O cliente Supabase.
 * @param {Object} payload - Os dados do lançamento montados.
 */
export async function salvarLancamentoDb(supabase, payload) {
    const { error } = await supabase
        .from('lancamentos')
        .upsert(payload);

    if (error) throw error;
    return true;
}

/**
 * Exclui o lançamento de um único dia específico.
 * * @param {Object} supabase - O cliente Supabase.
 * @param {string} motoristaNome - Nome do motorista.
 * @param {string} dataStr - Data exata "YYYY-MM-DD".
 */
export async function excluirLancamentoDia(supabase, motoristaNome, dataStr) {
    const { error } = await supabase
        .from('lancamentos')
        .delete()
        .eq('motorista_nome', motoristaNome)
        .eq('data', dataStr);

    if (error) throw error;
    return true;
}