/**
 * src/utils/date.js
 *
 * RESPONSABILIDADE: Utilitários puros de data.
 *
 * REGRA DE OURO deste arquivo:
 * - Nenhuma função aqui pode tocar no DOM
 * - Nenhuma função aqui pode chamar o Supabase
 * - Nenhuma função aqui pode ler variáveis globais (window.*)
 * - Toda função recebe o que precisa por parâmetro e retorna um valor
 *
 * Isso se chama "função pura" — dado o mesmo input, sempre retorna
 * o mesmo output. É o tipo de código mais fácil de testar e reutilizar.
 *
 * Quando você migrar para React/TypeScript, este arquivo vem junto
 * sem nenhuma alteração.
 */

// =============================================================
// FORMATAÇÃO
// =============================================================

/**
 * Converte um objeto Date para string no formato "YYYY-MM-DD"
 * (formato usado nas consultas ao Supabase e como chave do bancoDados)
 *
 * @param {Date} data
 * @returns {string} Ex: "2026-05-21"
 */
export function formatarDataParaBusca(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

/**
 * Converte uma string "YYYY-MM-DD" para exibição "DD/MM/YYYY"
 * (formato legível para o usuário brasileiro)
 *
 * @param {string} dataStr Ex: "2026-05-21"
 * @returns {string} Ex: "21/05/2026"
 */
export function formatarDataParaExibicao(dataStr) {
    const partes = dataStr.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// =============================================================
// CÁLCULOS DE DATA
// =============================================================

/**
 * Retorna o último dia real do mês no formato "YYYY-MM-DD"
 * Isso corrige o bug antigo de usar "-31" fixo em meses com menos dias.
 *
 * Exemplo: ultimoDiaDoMes("2026-02") → "2026-02-28"
 *          ultimoDiaDoMes("2026-01") → "2026-01-31"
 *
 * @param {string} anoMesStr Ex: "2026-05"
 * @returns {string} Ex: "2026-05-31"
 */
export function ultimoDiaDoMes(anoMesStr) {
    const [ano, mes] = anoMesStr.split('-').map(Number);
    // O "dia 0" do mês seguinte é o último dia do mês atual — truque nativo do JS
    const ultimoDia = new Date(ano, mes, 0).getDate();
    return `${anoMesStr}-${String(ultimoDia).padStart(2, '0')}`;
}

/**
 * Retorna o ano-mês atual no formato "YYYY-MM",
 * já ajustado para o fuso horário local do usuário.
 *
 * Sem esse ajuste, usuários no GMT-3 às 23h veriam o mês errado.
 *
 * @returns {string} Ex: "2026-05"
 */
export function getAnoMesAtual() {
    const dataHoje = new Date();
    const offset = dataHoje.getTimezoneOffset() * 60000;
    const dataLocal = new Date(dataHoje.getTime() - offset);
    return dataLocal.toISOString().substring(0, 7);
}

/**
 * Retorna a data de hoje no formato "YYYY-MM-DD",
 * ajustada para o fuso horário local.
 *
 * @returns {string} Ex: "2026-05-21"
 */
export function getHojeStr() {
    const dataHoje = new Date();
    const offset = dataHoje.getTimezoneOffset() * 60000;
    const dataLocal = new Date(dataHoje.getTime() - offset);
    return dataLocal.toISOString().split('T')[0];
}

/**
 * Retorna a data do primeiro dia do mês no formato "YYYY-MM-DD"
 *
 * @param {string} anoMesStr Ex: "2026-05"
 * @returns {string} Ex: "2026-05-01"
 */
export function primeiroDiaDoMes(anoMesStr) {
    return `${anoMesStr}-01`;
}

/**
 * Verifica se uma data (string "YYYY-MM-DD") pertence a um determinado mês.
 *
 * @param {string} dataStr Ex: "2026-05-15"
 * @param {string} anoMesStr Ex: "2026-05"
 * @returns {boolean}
 */
export function dataEstaNoMes(dataStr, anoMesStr) {
    return dataStr.startsWith(anoMesStr);
}

/**
 * Verifica se uma data está dentro de um intervalo (inclusivo).
 *
 * @param {string} dataStr     Ex: "2026-05-15"
 * @param {string} inicio      Ex: "2026-05-01"
 * @param {string} fim         Ex: "2026-05-31"
 * @returns {boolean}
 */
export function dataEstaNoIntervalo(dataStr, inicio, fim) {
    return dataStr >= inicio && dataStr <= fim;
}