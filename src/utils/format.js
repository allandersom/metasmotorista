/**
 * src/utils/format.js
 *
 * RESPONSABILIDADE: Formatação de valores para exibição.
 *
 * Toda vez que você exibe um número como "R$ 1.250,00" ou "8 cx",
 * essa lógica vive aqui — não espalhada pelo app.
 *
 * Por que isso importa?
 * Imagine que o cliente pede para exibir "R$ 1.250,00" em vez de
 * "R$ 1250,00". Se a formatação estiver em 20 lugares, você muda em 20.
 * Se estiver aqui, você muda em 1.
 */

// =============================================================
// MOEDA
// =============================================================

/**
 * Formata um número para moeda brasileira.
 * Ex: 1250.5 → "R$ 1.250,50"
 *
 * @param {number} valor
 * @returns {string}
 */
export function formatarMoeda(valor) {
    if (isNaN(valor) || valor === null || valor === undefined) return 'R$ 0,00';
    return `R$ ${valor.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/**
 * Versão compacta sem "R$ " — útil para tabelas onde o símbolo
 * já está no cabeçalho.
 * Ex: 1250.5 → "1.250,50"
 *
 * @param {number} valor
 * @returns {string}
 */
export function formatarValorNumerico(valor) {
    if (isNaN(valor) || valor === null || valor === undefined) return '0,00';
    return valor.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// =============================================================
// QUANTIDADES DE SERVIÇO
// =============================================================

/**
 * Formata a quantidade de serviços com o sufixo correto
 * baseado no tipo de veículo.
 *
 * "cx" = caixas (poliguindaste)
 * "vg" = viagens (caçamba)
 *
 * @param {number} quantidade
 * @param {string} tipoVeiculo
 * @returns {string} Ex: "8 cx" ou "4 vg"
 */
export function formatarQuantidade(quantidade, tipoVeiculo) {
    const sufixo = tipoVeiculo === 'cacamba' ? 'vg' : 'cx';
    return `${quantidade} ${sufixo}`;
}

/**
 * Formata a exibição combinada de caixas e viagens
 * para motoristas com tipo misto ou especial.
 *
 * @param {number} caixas
 * @param {number} viagens
 * @param {boolean} isEspecial  — true se o motorista é da lista motOutros
 * @returns {string} Ex: "8 cx" ou "0 cx | 4 vg"
 */
export function formatarQuantidadeMista(caixas, viagens, isEspecial) {
    if (!isEspecial) return `${caixas} cx`;
    if (caixas > 0 && viagens > 0) return `${caixas} cx | ${viagens} vg`;
    if (caixas > 0) return `${caixas} cx | 0 vg`;
    return `0 cx | ${viagens} vg`;
}

// =============================================================
// PERCENTUAIS
// =============================================================

/**
 * Formata um número como percentual com 2 casas decimais.
 * Ex: 87.5 → "87,50%"
 *
 * @param {number} valor
 * @returns {string}
 */
export function formatarPercentual(valor) {
    if (isNaN(valor)) return '0,00%';
    return `${valor.toFixed(2).replace('.', ',')}%`;
}

// =============================================================
// NÚMEROS GENÉRICOS
// =============================================================

/**
 * Formata um número inteiro ou decimal de forma inteligente:
 * - Se for inteiro exato, não mostra casas decimais
 * - Se tiver decimal, mostra 1 casa
 *
 * Útil para exibir metas e previsões que podem ser 160 ou 142.5
 *
 * @param {number} valor
 * @returns {string} Ex: 160 → "160" | 142.5 → "142.5"
 */
export function formatarNumeroInteligente(valor) {
    if (Number.isInteger(valor)) return String(valor);
    return valor.toFixed(1);
}