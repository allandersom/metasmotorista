// =============================================================
// MÓDULO DE BUSINESS INTELLIGENCE (BI) E PROJEÇÕES
// =============================================================

/**
 * Descobre quantos dias úteis já se passaram e quantos faltam no mês
 */
export function calcularDiasCorridosERestantes(anoMesStr, diasUteisTotais) {
    const dataAtual = new Date();
    const anoAtual = dataAtual.getFullYear();
    const mesAtual = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const strAtual = `${anoAtual}-${mesAtual}`;

    let corridos = 0;
    let restantes = 0;

    if (anoMesStr < strAtual) {
        // Mês passado
        corridos = diasUteisTotais;
        restantes = 0;
    } else if (anoMesStr > strAtual) {
        // Mês futuro
        corridos = 0;
        restantes = diasUteisTotais;
    } else {
        // Mês atual: faz a proporção de acordo com o dia de hoje
        const diaHoje = dataAtual.getDate();
        const diasNoMes = new Date(anoAtual, parseInt(mesAtual), 0).getDate();
        const progresso = diaHoje / diasNoMes;
        
        corridos = Math.max(1, Math.round(diasUteisTotais * progresso));
        restantes = Math.max(1, diasUteisTotais - corridos);
    }

    return { corridos, restantes };
}

/**
 * Calcula a projeção de fechamento (Onde ele vai parar se continuar assim)
 */
export function calcularRunRate(pontosAtuais, diasCorridos, diasTotais) {
    if (diasCorridos <= 0) return 0;
    const projecao = (pontosAtuais / diasCorridos) * diasTotais;
    return Math.ceil(projecao);
}

/**
 * Calcula quanto ele tem que fazer POR DIA para bater a meta
 */
export function calcularGpsMeta(pontosAtuais, metaAlvo, diasRestantes) {
    if (pontosAtuais >= metaAlvo) return 0; // Já bateu
    if (diasRestantes <= 0) return Math.ceil(metaAlvo - pontosAtuais); // Último dia
    return Math.ceil((metaAlvo - pontosAtuais) / diasRestantes);
}