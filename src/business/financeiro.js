import {
    dataEstaNoMes,
    dataEstaNoIntervalo,
} from '../utils/date.js';

import {
    formatarMoeda,
    formatarQuantidadeMista,
    formatarPercentual,
    formatarNumeroInteligente,
} from '../utils/format.js';

/**
 * src/business/financeiro.js
 *
 * RESPONSABILIDADE ÚNICA: Cálculo de remuneração dos motoristas.
 *
 * REGRA DE OURO deste arquivo:
 * - Nenhuma função aqui toca no DOM
 * - Nenhuma função aqui chama o Supabase
 * - Nenhuma função aqui lê window.*
 * - TUDO que precisa vem por parâmetro e retorna um valor
 *
 * Isso é chamado de "função pura" — mesmos parâmetros = mesmo resultado,
 * sempre. É o tipo de código mais fácil de testar e de confiar.
 *
 * QUANDO O CLIENTE PEDIR UMA MUDANÇA DE REGRA:
 * Você abre ESTE arquivo, muda EM UM LUGAR, e pronto.
 * Não precisa caçar em app.js inteiro.
 */

// =============================================================
// CONFIGURAÇÃO DOS VEÍCULOS
// A única fonte de verdade sobre metas e valores por veículo.
// =============================================================

const VEICULOS_CONFIG = {
    poliguindaste: {
        metaFinanceira: 4,
        valorExtraPorUnidade: 10,
        tipoUnidade: 'cx',
    },
    poli_duplo: {
        metaFinanceira: 8,
        valorExtraPorUnidade: 10,
        tipoUnidade: 'cx',
    },
    cacamba: {
        metaFinanceira: 4,
        valorExtraPorUnidade: 20,
        tipoUnidade: 'vg',
    },
    misto: {
        metaFinanceira: 6,
        valorExtraPorUnidade: 10,
        tipoUnidade: 'cx',
    },
};

/**
 * Retorna a configuração de um veículo.
 * Se o tipo não existir, retorna poliguindaste como padrão.
 */
export function getConfigVeiculo(tipoVeiculo) {
    return VEICULOS_CONFIG[tipoVeiculo] || VEICULOS_CONFIG.poliguindaste;
}

// =============================================================
// CÁLCULO DE PONTOS
// =============================================================

/**
 * Retorna a meta diária de pontos de um motorista.
 */
export function getMetaDiaria(nome) {
    return nome === 'ROBERTO CARLOS' ? 4 : 8;
}

/**
 * Calcula os pontos de produtividade de um motorista em um dia.
 * Pontos normalizam a comparação entre tipos de veículo diferentes.
 */
export function calcularPontos(nome, servicos, tipoVeiculo) {
    const meta = getMetaDiaria(nome);
    if (tipoVeiculo === 'cacamba')    return servicos * (meta / 4);
    if (tipoVeiculo === 'poli_duplo') return servicos / 2;
    if (tipoVeiculo === 'misto')      return servicos * (meta / 6);
    return servicos;
}

// =============================================================
// CÁLCULO DE VALOR — DIA NORMAL
// =============================================================

function calcularValorDiaNormal(servicos, config) {
    if (servicos < config.metaFinanceira) return 0;
    return 50 + ((servicos - config.metaFinanceira) * config.valorExtraPorUnidade);
}

// =============================================================
// CÁLCULO DE VALOR — DOMINGO E FERIADO
// =============================================================

function calcularValorDomingoFeriado(servicos) {
    return servicos * 30;
}

// =============================================================
// CÁLCULO DE VALOR — SÁBADO
// =============================================================

function calcularValorSabado({ motoristaNome, dataObj, servicos, tipoVeiculo, bancoDados, formatarData }) {
    const config = getConfigVeiculo(tipoVeiculo);
    const metaDiaria = getMetaDiaria(motoristaNome);

    let pontosFeitosSemana = 0;
    let qtdFeriadosSemana = 0;

    for (let i = 1; i <= 5; i++) {
        const d = new Date(dataObj);
        d.setDate(dataObj.getDate() - (6 - i));
        const dStr = formatarData(d);
        const lancDia = bancoDados[dStr]?.[motoristaNome];

        if (lancDia && (!lancDia.status || lancDia.status === 'normal')) {
            if (lancDia.isFeriado) {
                qtdFeriadosSemana++;
            } else {
                const srv = isNaN(lancDia.servicos) ? 0 : lancDia.servicos;
                pontosFeitosSemana += calcularPontos(motoristaNome, srv, lancDia.tipoVeiculo);
            }
        }
    }

    const metaSemanalPontos = (5 - qtdFeriadosSemana) * metaDiaria;
    const pontosFaltantes = Math.max(0, metaSemanalPontos - pontosFeitosSemana);

    let divisorParaFisico = 1;
    if (tipoVeiculo === 'poli_duplo') divisorParaFisico = 0.5;
    else if (tipoVeiculo === 'cacamba') divisorParaFisico = metaDiaria / 4;
    else if (tipoVeiculo === 'misto')   divisorParaFisico = metaDiaria / 6;

    const servicosFaltantesFisicos = divisorParaFisico > 0 ? pontosFaltantes / divisorParaFisico : 0;
    const servicosParaMeta = Math.min(servicos, servicosFaltantesFisicos);
    const servicosBonus    = Math.max(0, servicos - servicosFaltantesFisicos);

    const valorParaMeta = servicosParaMeta >= config.metaFinanceira
        ? 50 + ((servicosParaMeta - config.metaFinanceira) * config.valorExtraPorUnidade)
        : 0;

    const valorBonus = servicosBonus * (config.valorExtraPorUnidade * 2);

    return {
        valorBase: valorParaMeta + valorBonus,
        bateuMetaSemana: servicosBonus > 0,
    };
}

// =============================================================
// FUNÇÃO PRINCIPAL PÚBLICA
// =============================================================

/**
 * Calcula o valor a pagar para um motorista em um determinado dia.
 * Esta é a ÚNICA função que o app.js precisa chamar.
 *
 * @param {Object} params
 * @param {string}   params.motoristaNome
 * @param {string}   params.dataStr        - formato "YYYY-MM-DD"
 * @param {number}   params.servicos
 * @param {string}   params.tipoVeiculo
 * @param {boolean}  params.isFeriado
 * @param {string}   params.status         - 'normal' | 'falta' | 'folga' | ...
 * @param {Object}   params.bancoDados     - window.bancoDadosCloud
 * @param {Function} params.formatarData   - formatarDataParaBusca(date) => string
 *
 * @returns {{ valorBase: number, bateuMetaSemana: boolean }}
 */
export function calcularValorDia({
    motoristaNome,
    dataStr,
    servicos,
    tipoVeiculo,
    isFeriado,
    status,
    bancoDados,
    formatarData,
}) {
    if (status !== 'normal') {
        return { valorBase: 0, bateuMetaSemana: false };
    }

    const dataObj = new Date(dataStr + 'T00:00:00');
    const diaSemana = dataObj.getDay();

    if (diaSemana === 0 || isFeriado) {
        return {
            valorBase: calcularValorDomingoFeriado(servicos),
            bateuMetaSemana: false,
        };
    }

    if (diaSemana === 6) {
        return calcularValorSabado({
            motoristaNome,
            dataObj,
            servicos,
            tipoVeiculo,
            bancoDados,
            formatarData,
        });
    }

    return {
        valorBase: calcularValorDiaNormal(servicos, getConfigVeiculo(tipoVeiculo)),
        bateuMetaSemana: false,
    };
}

// =============================================================
// PATCH TEMPORÁRIO DOS RANKINGS
// =============================================================

function ehDiaEspecialRanking(dataStr, dados) {
    const diaDaSemana = new Date(dataStr + 'T00:00:00').getDay();
    return diaDaSemana === 0 || dados.isFeriado === true;
}

function aplicarCorrecaoRankings() {
    if (typeof window === 'undefined') return;

    window.gerarRankingPeriodo = function() {
        const elInicio = document.getElementById('dataRankingInicio');
        const elFim = document.getElementById('dataRankingFim');
        if (!elInicio || !elFim) return;
        const inicio = elInicio.value;
        const fim = elFim.value;
        if (!inicio || !fim) return;

        const bancoDados = window.bancoDadosCloud;
        let rankPeriodo = {};

        for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
            if (dataEstaNoIntervalo(dataStr, inicio, fim)) {
                const diaDaSemana = new Date(dataStr + 'T00:00:00').getDay();
                for (const [mot, dados] of Object.entries(dadosDia)) {
                    if (!rankPeriodo[mot]) rankPeriodo[mot] = { caixas: 0, viagens: 0, valor: 0, extra: 0, diasTrab: 0, pontos: 0 };
                    rankPeriodo[mot].valor += dados.valor;
                    rankPeriodo[mot].extra += dados.valorExtra || 0;

                    const statusNormal = !dados.status || dados.status === 'normal';
                    const diaEspecial = ehDiaEspecialRanking(dataStr, dados);
                    if (statusNormal && !diaEspecial) {
                        if (dados.tipoVeiculo === 'cacamba') rankPeriodo[mot].viagens += (dados.servicos || 0);
                        else rankPeriodo[mot].caixas += (dados.servicos || 0);
                        rankPeriodo[mot].pontos += (dados.pontos !== undefined) ? dados.pontos : window.calcularPontosMotorista(mot, (dados.servicos || 0), dados.tipoVeiculo);
                        if (diaDaSemana !== 6) rankPeriodo[mot].diasTrab += 1;
                    }
                }
            }
        }

        const rankArray = Object.keys(rankPeriodo).map(mot => {
            const metaTotalPeriodo = window.getMetaDiaria(mot) * rankPeriodo[mot].diasTrab;
            const porcentagem = metaTotalPeriodo > 0 ? (rankPeriodo[mot].pontos / metaTotalPeriodo) * 100 : 0;
            return { nome: mot, ...rankPeriodo[mot], porcentagem };
        }).filter(item => item.pontos > 0 || item.valor > 0);

        rankArray.sort((a, b) => b.porcentagem - a.porcentagem);
        const divLista = document.getElementById('listaRankingDiario');
        if (!divLista) return;
        divLista.innerHTML = '';

        if (rankArray.length === 0) {
            divLista.innerHTML = '<div class="text-center text-slate-400 py-8 font-medium">Nenhum serviço normal no período.</div>';
            return;
        }

        rankArray.forEach((mot, index) => {
            const porcentagemStr = formatarPercentual(mot.porcentagem);
            const classeBarra = mot.porcentagem >= 100 ? 'meta-batida' : (mot.porcentagem >= 80 ? 'meta-excedida' : 'meta-ruim');
            const larguraBarra = Math.min(mot.porcentagem, 100);
            const extraBadge = mot.extra > 0 ? `<span class="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded ml-2">+ Extra ${formatarMoeda(mot.extra)}</span>` : '';
            const textoQtd = formatarQuantidadeMista(mot.caixas, mot.viagens, window.motOutros.includes(mot.nome));

            const linha = document.createElement('div');
            linha.className = 'diario-row';
            linha.innerHTML = `
                <div class="diario-top"><span class="diario-nome">#${index + 1} - ${mot.nome} <span class="text-blue-500 font-black">(${textoQtd})</span> ${extraBadge}</span><span class="diario-faturamento">${formatarMoeda(mot.valor)}</span></div>
                <div class="progress-wrapper"><div class="progress-bar-bg"><div class="progress-bar-fill ${classeBarra}" style="width: ${larguraBarra}%;"></div></div><span class="progress-text" title="Domingos e feriados não entram na meta normal; sábado conta como produção extra da semana.">${porcentagemStr}</span></div>
            `;
            divLista.appendChild(linha);
        });
    };

    window.gerarRankingMensal = function() {
        const elFiltro = document.getElementById('mesFiltro');
        if (!elFiltro) return;
        const mesFiltro = elFiltro.value;
        if (!mesFiltro) return;

        const diasUteisGlobais = window.carregarDiasUteis(mesFiltro);
        const bancoDados = window.bancoDadosCloud;
        let acumuladoMes = {};
        let totalCaixasFrota = 0, totalViagensFrota = 0, totalFatMesFrota = 0;

        window.motoristas.forEach(m => { acumuladoMes[m] = { caixas: 0, viagens: 0, valor: 0, pontos: 0 }; });

        for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
            if (dataEstaNoMes(dataStr, mesFiltro)) {
                for (const [mot, dados] of Object.entries(dadosDia)) {
                    if (acumuladoMes[mot]) {
                        const statusMot = (dados.status || 'normal').toLowerCase();
                        const diaEspecial = ehDiaEspecialRanking(dataStr, dados);
                        if (statusMot === 'normal' && !diaEspecial) {
                            if (dados.tipoVeiculo === 'cacamba') { acumuladoMes[mot].viagens += (dados.servicos || 0); totalViagensFrota += (dados.servicos || 0); }
                            else { acumuladoMes[mot].caixas += (dados.servicos || 0); totalCaixasFrota += (dados.servicos || 0); }
                            acumuladoMes[mot].pontos += (dados.pontos !== undefined) ? dados.pontos : window.calcularPontosMotorista(mot, (dados.servicos || 0), dados.tipoVeiculo);
                        }
                        acumuladoMes[mot].valor += dados.valor;
                        totalFatMesFrota += dados.valor;
                    }
                }
            }
        }

        function getMetaCalculadaMotorista(mot) {
            const slaMotorista = window.calcularSlaMotorista(mot, mesFiltro);
            const metaDiaria = window.getMetaDiaria(mot);
            const metaCheiaDoMes = metaDiaria * diasUteisGlobais;
            if (diasUteisGlobais === 0) return 0;
            return metaCheiaDoMes * (slaMotorista / diasUteisGlobais);
        }

        let ptsRayanna = 0, feitasRayanna = 0;
        window.motRayanna.forEach(mot => { ptsRayanna += getMetaCalculadaMotorista(mot); if (acumuladoMes[mot]) feitasRayanna += acumuladoMes[mot].pontos; });

        let ptsJulia = 0, feitasJulia = 0;
        window.motJulia.forEach(mot => { ptsJulia += getMetaCalculadaMotorista(mot); if (acumuladoMes[mot]) feitasJulia += acumuladoMes[mot].pontos; });

        const ptsGeral = ptsRayanna + ptsJulia;
        const feitasGeral = feitasRayanna + feitasJulia;

        if (document.getElementById('totalViagensMesGlobal')) document.getElementById('totalViagensMesGlobal').innerText = `${totalViagensFrota} vg`;
        if (document.getElementById('totalFatMensalLeaderboard')) document.getElementById('totalFatMensalLeaderboard').innerText = formatarMoeda(totalFatMesFrota);

        function renderizarMeta(feitas, meta, elValor, elFalta) {
            const perc = meta > 0 ? ((feitas / meta) * 100).toFixed(1) : 0;
            const faltam = Math.max(0, meta - feitas);
            const metaFormatada = formatarNumeroInteligente(meta);
            const faltamFormatado = formatarNumeroInteligente(faltam);
            if (document.getElementById(elValor)) document.getElementById(elValor).innerText = `${Math.round(feitas)} / ${metaFormatada} cx`;
            if (document.getElementById(elFalta)) document.getElementById(elFalta).innerText = `${perc}% | Faltam ${faltamFormatado} cx`;
        }

        renderizarMeta(feitasGeral, ptsGeral, 'metaGeralGlobal', 'faltaGeralGlobal');
        renderizarMeta(feitasRayanna, ptsRayanna, 'metaRayannaGlobal', 'faltaRayannaGlobal');
        renderizarMeta(feitasJulia, ptsJulia, 'metaJuliaGlobal', 'faltaJuliaGlobal');

        const rankFinal = Object.keys(acumuladoMes).map(mot => {
            const info = acumuladoMes[mot];
            const metaMensalPontos = getMetaCalculadaMotorista(mot);
            const percentualMeta = metaMensalPontos > 0 ? ((info.pontos / metaMensalPontos) * 100) : 0;
            return { nome: mot, caixas: info.caixas, viagens: info.viagens, valor: info.valor, pontos: info.pontos, percentual: percentualMeta, metaExata: metaMensalPontos };
        }).filter(item => item.pontos > 0 || item.valor > 0).sort((a, b) => b.percentual - a.percentual);

        const divLista = document.getElementById('listaLeaderboard');
        if (!divLista) return;
        divLista.innerHTML = '';

        if (rankFinal.length === 0) {
            divLista.innerHTML = '<div class="text-center text-slate-400 py-8 font-medium">Sem registros válidos.</div>';
            return;
        }

        rankFinal.forEach((mot, index) => {
            const eloInfo = window.obterRankElo(mot.percentual);
            const percentualStr = formatarPercentual(mot.percentual);
            let corPercent, bgPercent, borderPercent;
            if (mot.percentual >= 100)     { corPercent = '#10b981'; bgPercent = '#d1fae5'; borderPercent = '#a7f3d0'; }
            else if (mot.percentual >= 80) { corPercent = '#d97706'; bgPercent = '#fef3c7'; borderPercent = '#fde68a'; }
            else                           { corPercent = '#ef4444'; bgPercent = '#fee2e2'; borderPercent = '#fca5a5'; }

            const textoQtd = formatarQuantidadeMista(mot.caixas, mot.viagens, window.motOutros.includes(mot.nome));
            const faltam = mot.metaExata - mot.pontos;
            let htmlFaltam = '';
            if (faltam > 0) {
                const calcVisual = window.motOutros.includes(mot.nome) ? faltam / 2 : faltam;
                const txtFaltam = window.motOutros.includes(mot.nome) ? `Faltam ${formatarNumeroInteligente(calcVisual)} vg` : `Faltam ${formatarNumeroInteligente(calcVisual)} cx`;
                htmlFaltam = `<span class="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded ml-2 font-bold">${txtFaltam}</span>`;
            } else {
                htmlFaltam = `<span class="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded ml-2 font-bold">Meta OK!</span>`;
            }

            const linha = document.createElement('div');
            linha.className = 'elo-row';
            linha.innerHTML = `<div class="posicao">#${index + 1}</div><div class="nome-motorista-rank">${mot.nome}<span class="valor-sub">Fat: ${formatarMoeda(mot.valor)}</span></div><div><span class="badge-elo ${eloInfo.classe}">${eloInfo.nome}</span></div><div class="valor-destaque text-blue-500 flex items-center">${textoQtd}<span class="badge-percent text-[11px]" style="background:${bgPercent}; color:${corPercent}; border-color:${borderPercent};">${percentualStr}</span>${htmlFaltam}</div>`;
            divLista.appendChild(linha);
        });
    };
}

queueMicrotask(aplicarCorrecaoRankings);
