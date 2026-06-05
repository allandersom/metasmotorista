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
    return nome === 'ROBERTO CARLOS PESSOA' ? 4 : 8;
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

        if (lancDia) {
    if (lancDia.isFeriado) {
        qtdFeriadosSemana++;
    } else if (!lancDia.status || lancDia.status === 'normal') {
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