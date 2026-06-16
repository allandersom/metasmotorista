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
    metaFinanceira: 4,  // meta em pontos, igual poliguindaste
    valorExtraPorUnidade: 10,
},
};

export function getConfigVeiculo(tipoVeiculo) {
    return VEICULOS_CONFIG[tipoVeiculo] || VEICULOS_CONFIG.poliguindaste;
}

export function getMetaDiaria(nome) {
    return nome === 'ROBERTO CARLOS PESSOA' ? 4 : 8;
}

export function calcularPontos(nome, servicos, tipoVeiculo) {
    const meta = getMetaDiaria(nome);
    if (tipoVeiculo === 'cacamba')    return servicos * 2; // CADA VG VALE 2 CXS AQUI
    if (tipoVeiculo === 'poli_duplo') return servicos / 2;
    if (tipoVeiculo === 'misto')      return servicos * (meta / 6);
    return servicos;
}

function calcularValorDiaNormal(servicos, config) {
    if (servicos < config.metaFinanceira) return 0;
    return 50 + ((servicos - config.metaFinanceira) * config.valorExtraPorUnidade);
}

function calcularValorDomingoFeriado(servicos) {
    return servicos * 30;
}

function getMetaFisicaDiariaSabado(nome, tipoVeiculo) {
    if (tipoVeiculo === 'cacamba') return 4;
if (tipoVeiculo === 'misto') return 6;
if (tipoVeiculo === 'poli_duplo') return getMetaDiaria(nome);
return getMetaDiaria(nome) * 2;
}

function calcularValorSabado({ motoristaNome, dataObj, servicos, tipoVeiculo, bancoDados, formatarData, servicosBrutos }) {
    const config = getConfigVeiculo(tipoVeiculo);

    let servicosFeitosSemana = 0;
    let qtdFeriadosSemana = 0;

    for (let i = 1; i <= 5; i++) {
        const d = new Date(dataObj);
        d.setDate(dataObj.getDate() - (6 - i));
        const dStr = formatarData(d);
        
        // Verifica de forma GLOBAL se o dia foi marcado como feriado para QUALQUER motorista
        let diaEhFeriado = false;
        if (bancoDados[dStr]) {
            diaEhFeriado = Object.values(bancoDados[dStr]).some(mot => mot.isFeriado);
        }

        if (diaEhFeriado) {
            qtdFeriadosSemana++;
        } else {
            const lancDia = bancoDados[dStr]?.[motoristaNome];
            if (lancDia && (!lancDia.status || lancDia.status === 'normal')) {
                const tipoVeiculoDia = lancDia.tipoVeiculo || 'poliguindaste';
                // Só conta dias do mesmo tipo de veículo do sábado
                if (tipoVeiculoDia === tipoVeiculo) {
                    const srv = isNaN(lancDia.servicos) ? 0 : lancDia.servicos;
                    const fatorDia = tipoVeiculoDia === 'poliguindaste' ? 2 : 1;
                    servicosFeitosSemana += srv * fatorDia;
                }
            }
        }
    }

    const metaSemanalFisica = (5 - qtdFeriadosSemana) * getMetaFisicaDiariaSabado(motoristaNome, tipoVeiculo);
    const servicosFaltantesFisicos = Math.max(0, metaSemanalFisica - servicosFeitosSemana);
    const servicosParaMeta = Math.min(servicos, servicosFaltantesFisicos);
    const servicosBonus = Math.max(0, servicos - servicosFaltantesFisicos);

let valorParaMeta, valorBonus;

if (servicosBonus > 0) {
    // Opção A: valor usando a lógica de dia normal (bate meta diária = R$50 + excedentes normais)
    const opcaoA = calcularValorDiaNormal(servicos, config);

    // Opção B: só o bônus das caixas excedentes (sem base de R$50)
    const proporcaoBonus = servicos > 0 ? servicosBonus / servicos : 0;
    const caixasBrutasBonus = Math.round(proporcaoBonus * (servicosBrutos || servicos));
    const opcaoB = caixasBrutasBonus * (config.valorExtraPorUnidade * 2);

    // Pega sempre o maior
    valorParaMeta = Math.max(opcaoA, opcaoB);
    valorBonus = 0; // já embutido no valorParaMeta
} else {
    valorParaMeta = calcularValorDiaNormal(servicosParaMeta, config);
    const proporcaoBonus = servicos > 0 ? servicosBonus / servicos : 0;
    const caixasBrutasBonus = Math.round(proporcaoBonus * (servicosBrutos || servicos));
    valorBonus = caixasBrutasBonus * (config.valorExtraPorUnidade * 2);
}

    return {
        valorBase: valorParaMeta + valorBonus,
        bateuMetaSemana: servicosBonus > 0,
    };
}

// DEPOIS:
export function calcularValorDia({
    motoristaNome,
    dataStr,
    servicos,
    servicosBrutos,   // ← ADICIONAR
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
            servicosBrutos,   // ← ADICIONAR
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

function ehDiaEspecialRanking(dataStr, dados) {
    const diaDaSemana = new Date(dataStr + 'T00:00:00').getDay();
    if (diaDaSemana === 0 || dados.isFeriado === true) return true;
    
    // Dia exclusivamente extra = não conta pra meta, igual domingo/feriado
    const isExtra = dados.observacao &&
        (dados.observacao.includes('[EXTRA R$ 20]') ||
         dados.observacao.includes('[EXTRA R$20]'));
    if (isExtra && dados.pontos === 0) return true;
    
    return false;
}

function aplicarCorrecaoRankings() {
    if (typeof window === 'undefined') return;

  window.gerarRankingPeriodo = async function() {
        const elInicio = document.getElementById('dataRankingInicio');
        const elFim = document.getElementById('dataRankingFim');
        if (!elInicio || !elFim) return;
        const inicio = elInicio.value;
        const fim = elFim.value;
        if (!inicio || !fim) return;

        const elTotalQtd = document.getElementById('totalQtdPeriodo');
        if (elTotalQtd) elTotalQtd.innerText = "Carregando...";

        let bancoDados = {};
        try {
            const { data: lancs, error } = await window.supabaseClient
                .from('lancamentos')
                .select('*')
                .is('cancelado_em', null)
                .gte('data', inicio)
                .lte('data', fim);

            if (error) throw error;

            (lancs || []).forEach(l => {
                const nomeMotorista = (l.motorista_nome || '').toUpperCase().trim();
                if (!nomeMotorista || !l.data) return;
                if (!bancoDados[l.data]) bancoDados[l.data] = {};
                bancoDados[l.data][nomeMotorista] = {
                    servicos: l.quantidade_servicos,
                    valor: parseFloat(l.valor_faturamento) || 0,
                    isFeriado: l.is_feriado,
                    tipoVeiculo: l.tipo_veiculo,
                    valorExtra: parseFloat(l.valor_extra) || 0,
                    status: l.status_servico,
                    pontos: l.tipo_veiculo === 'cacamba' ? l.quantidade_servicos * 2 : l.quantidade_servicos
                };
            });
        } catch (err) {
            console.error("Erro ao buscar período no banco:", err);
            return;
        }

        let rankPeriodo = {};
        let totalCaixasPeriodo = 0, totalViagensPeriodo = 0, totalFatPeriodo = 0;

        for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
            if (dataEstaNoIntervalo(dataStr, inicio, fim)) {
                const diaDaSemana = new Date(dataStr + 'T00:00:00').getDay();
                if (window._apenasUteis && diaDaSemana === 0) continue;

               for (const [mot, dados] of Object.entries(dadosDia)) {
                    const isExtra = dados.observacao && (dados.observacao.includes('[EXTRA R$ 20]') || dados.observacao.includes('[EXTRA R$20]'));

                    // Se "Dias Úteis" estiver ativado, o Extra some completamente do ranking
                    if (window._apenasUteis && (dados.isFeriado || isExtra)) continue;

                    if (!rankPeriodo[mot]) rankPeriodo[mot] = { caixas: 0, viagens: 0, valor: 0, extra: 0, pontos: 0 };

                    // O dinheiro continua entrando para o ranking geral (se não foi bloqueado pelos Dias Úteis)
                    rankPeriodo[mot].valor += dados.valor || 0;
                    rankPeriodo[mot].extra += dados.valorExtra || 0;
                    totalFatPeriodo += dados.valor || 0;

                    const statusNormal = (!dados.status || dados.status === 'normal');

                    // Caixas e pontos só vão para o Ranking se NÃO for Extra
                    if (statusNormal && !isExtra) {
                        if (dados.tipoVeiculo === 'cacamba') {
                            rankPeriodo[mot].viagens += (dados.servicos || 0);
                            totalViagensPeriodo += (dados.servicos || 0);
                        } else {
                            rankPeriodo[mot].caixas += (dados.servicos || 0);
                            totalCaixasPeriodo += (dados.servicos || 0);
                        }
                        rankPeriodo[mot].pontos += (dados.pontos !== undefined) ? dados.pontos : window.calcularPontosMotorista(mot, (dados.servicos || 0), dados.tipoVeiculo);
                    }
                }
            }
        }

        const elTotalFat = document.getElementById('totalFatPeriodo');
        if (elTotalQtd) elTotalQtd.innerText = `${totalCaixasPeriodo} cx | ${totalViagensPeriodo} vg`;
        if (elTotalFat) elTotalFat.innerText = formatarMoeda(totalFatPeriodo);

        // Nenhuma variável duplicada a partir daqui
        const mesRef = inicio.substring(0, 7);
        const diasUteisGlobaisMes = window.carregarDiasUteis(mesRef) || 22;

        let diasUteisNoPeriodo = 0;
        let dAtual = new Date(inicio + 'T00:00:00');
        const dLimite = new Date(fim + 'T00:00:00');
        
        while (dAtual <= dLimite) {
            const ano = dAtual.getFullYear();
            const mes = String(dAtual.getMonth() + 1).padStart(2, '0');
            const dia = String(dAtual.getDate()).padStart(2, '0');
            const dStr = `${ano}-${mes}-${dia}`;
            
            const dw = dAtual.getDay();
            let isFeriado = false;
            if (window.bancoDadosCloud[dStr]) {
                const firstMot = Object.keys(window.bancoDadosCloud[dStr])[0];
                if (firstMot && window.bancoDadosCloud[dStr][firstMot].isFeriado) isFeriado = true;
            }
            
            // Conta apenas Seg a Sex para a meta
            if (dw !== 0 && dw !== 6 && !isFeriado) diasUteisNoPeriodo++;
            dAtual.setDate(dAtual.getDate() + 1);
        }

        const rankArray = Object.keys(rankPeriodo).map(mot => {
            const slaMotorista = window.calcularSlaMotorista(mot, mesRef);
            const metaMensalMotorista = slaMotorista * window.getMetaDiaria(mot);
            
            // Fator do período
            const fatorPeriodo = diasUteisGlobaisMes > 0 ? (diasUteisNoPeriodo / diasUteisGlobaisMes) : 0;
            const metaDoPeriodo = metaMensalMotorista * fatorPeriodo;
            
            let porcentagem = 0;
            if (metaDoPeriodo > 0) {
                porcentagem = (rankPeriodo[mot].pontos / metaDoPeriodo) * 100;
            } else if (rankPeriodo[mot].pontos > 0) {
                porcentagem = 100;
            }

            return { nome: mot, ...rankPeriodo[mot], porcentagem };
        }).filter(item => item.pontos > 0 || item.valor > 0);

        // O RANKING AGORA ORDENA PELA PORCENTAGEM (SLA PROPORCIONAL)
        rankArray.sort((a, b) => b.porcentagem - a.porcentagem);
        
        const divLista = document.getElementById('listaRankingDiario');
        if (!divLista) return;
        divLista.innerHTML = '';

        if (rankArray.length === 0) {
            divLista.innerHTML = '<div class="text-center text-slate-400 py-8 font-medium">Nenhum serviço normal no período.</div>';
            return;
        }

        rankArray.forEach((mot, index) => {
            const extraBadge = mot.extra > 0 ? `<span class="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded ml-2">+ Extra ${formatarMoeda(mot.extra)}</span>` : '';
            const textoQtd = formatarQuantidadeMista(mot.caixas, mot.viagens, false);

            const cadastro = (window.todosMotoristasCloud || []).find(m => m.nome === mot.nome);
            const pixHtml = cadastro?.chave_pix
                ? `<span style="font-size:11px; color:var(--gray-400); display:flex; align-items:center; gap:4px; margin-top:2px;">
                       <i data-lucide="diamond" style="width:11px; height:11px; color:#16a34a;"></i>
                       ${cadastro.chave_pix}
                   </span>`
                : '';

            const linha = document.createElement('div');
            linha.className = 'diario-row';
            
            // INVISÍVEL: Guarda a porcentagem calculada pro PDF pescar!
            linha.setAttribute('data-perc', mot.porcentagem);

            linha.innerHTML = `
                <div class="diario-top" style="margin-bottom: 0;">
                    <div style="display:flex; flex-direction:column;">
                        <span class="diario-nome">#${index + 1} - ${mot.nome} <span class="text-blue-500 font-black">(${textoQtd})</span> ${extraBadge}</span>
                        ${pixHtml}
                    </div>
                    <span class="diario-faturamento">${formatarMoeda(mot.valor)}</span>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons({ nodes: [linha] });
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
                            const srv = dados.servicos || 0;
                            
                            // CONTAGEM ORIGINAL MANTIDA (Sem multiplicar caçamba por 2)
                            if (dados.tipoVeiculo === 'cacamba') { 
                                acumuladoMes[mot].viagens += srv; 
                                totalViagensFrota += srv; 
                            }
                               else if (dados.tipoVeiculo === 'poli_duplo') {
    acumuladoMes[mot].caixas += srv;
    totalCaixasFrota += srv;
}
                            else { 
                                acumuladoMes[mot].caixas += srv; 
                                totalCaixasFrota += srv; 
                            }
                            
                            acumuladoMes[mot].pontos += dados.tipoVeiculo === 'cacamba' ? srv * 2 : (dados.pontos !== undefined ? dados.pontos : window.calcularPontosMotorista(mot, srv, dados.tipoVeiculo));
                        }
                            // DEPOIS:
if (!diaEspecial) {
    acumuladoMes[mot].valor += dados.valor;
    totalFatMesFrota += dados.valor;
}
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

        // SOLUÇÃO DO SEU PEDIDO: Atualiza o card de quantidade acumulada do mês no topo da tela
        const elQtd = document.getElementById('totalQtdMensalLeaderboard');
        if (elQtd) elQtd.innerText = `${totalCaixasFrota} cx | ${totalViagensFrota} vg`;

        if (document.getElementById('totalViagensMesGlobal')) document.getElementById('totalViagensMesGlobal').innerText = `${totalViagensFrota} vg`;
        if (document.getElementById('totalFatMensalLeaderboard')) document.getElementById('totalFatMensalLeaderboard').innerText = formatarMoeda(totalFatMesFrota);

        function renderizarMeta(feitas, meta, elValor, elFalta) {
            const perc = meta > 0 ? ((feitas / meta) * 100).toFixed(1) : 0;
            const faltam100 = Math.max(0, meta - feitas);
            const faltam80 = Math.max(0, (meta * 0.8) - feitas);
            
            const metaFormatada = formatarNumeroInteligente(meta);
            const txtFalta100 = formatarNumeroInteligente(faltam100);
            const txtFalta80 = formatarNumeroInteligente(faltam80);
            
            if (document.getElementById(elValor)) document.getElementById(elValor).innerText = `${Math.round(feitas)} / ${metaFormatada} cx`;
            
            let textoFalta = `${perc}% | `;
            if (faltam80 > 0) {
                textoFalta += `Faltam ${txtFalta80} p/ 80% • Faltam ${txtFalta100} p/ 100%`;
            } else if (faltam100 > 0) {
                textoFalta += `80% Batido! 🎉 • Faltam ${txtFalta100} p/ 100%`;
            } else {
                textoFalta += `100% Alcançado! 🏆`;
            }
            
            if (document.getElementById(elFalta)) document.getElementById(elFalta).innerText = textoFalta;
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

        let totalLiberado = 0;
        rankFinal.forEach(mot => {
            if (mot.percentual >= 80) {
                totalLiberado += mot.valor;
            }
        });
        const elPagar = document.getElementById('totalPagarMensalLeaderboard');
        if (elPagar) elPagar.innerText = formatarMoeda(totalLiberado);

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
            
            // Novos cálculos de faltas
            const faltam100 = mot.metaExata - mot.pontos;
            const faltam80 = (mot.metaExata * 0.8) - mot.pontos;
            
            let htmlFaltam = '';
            if (faltam100 > 0) {
                const calcVisual100 = window.motOutros.includes(mot.nome) ? faltam100 / 2 : faltam100;
                const txt100 = window.motOutros.includes(mot.nome) ? `${formatarNumeroInteligente(calcVisual100)} vg` : `${formatarNumeroInteligente(calcVisual100)} cx`;
                
                if (faltam80 > 0) {
                    // Ainda não bateu nem 80%
                    const calcVisual80 = window.motOutros.includes(mot.nome) ? faltam80 / 2 : faltam80;
                    const txt80 = window.motOutros.includes(mot.nome) ? `${formatarNumeroInteligente(calcVisual80)} vg` : `${formatarNumeroInteligente(calcVisual80)} cx`;
                    
                    htmlFaltam = `
                        <div style="display:flex; flex-direction:column; gap:4px; margin-left:14px; align-items:flex-end;">
                            <span class="text-[9.5px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold leading-none whitespace-nowrap">Falta ${txt80} p/ 80%</span>
                            <span class="text-[9.5px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold leading-none whitespace-nowrap">Falta ${txt100} p/ 100%</span>
                        </div>`;
                } else {
                    // Já passou dos 80%, falta só o 100%
                    htmlFaltam = `
                        <div style="display:flex; flex-direction:column; gap:4px; margin-left:14px; align-items:flex-end;">
                            <span class="text-[9.5px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold leading-none whitespace-nowrap">80% Atingido! 🚀</span>
                            <span class="text-[9.5px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold leading-none whitespace-nowrap">Falta ${txt100} p/ 100%</span>
                        </div>`;
                }
            } else {
                // Passou dos 100%
                htmlFaltam = `<span class="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-1 rounded ml-4 font-bold whitespace-nowrap border border-emerald-200">100% Batido! 🏆</span>`;
            }

            const linha = document.createElement('div');
            linha.className = 'elo-row';
            linha.innerHTML = `<div class="posicao">#${index + 1}</div><div class="nome-motorista-rank">${mot.nome}<span class="valor-sub">Fat: ${formatarMoeda(mot.valor)}</span></div><div><span class="badge-elo ${eloInfo.classe}">${eloInfo.nome}</span></div><div class="valor-destaque text-blue-500 flex items-center">${textoQtd}<span class="badge-percent text-[11px]" style="background:${bgPercent}; color:${corPercent}; border-color:${borderPercent};">${percentualStr}</span>${htmlFaltam}</div>`;
            divLista.appendChild(linha);
        });
    };
}

queueMicrotask(aplicarCorrecaoRankings);


