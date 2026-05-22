/**
 * app.js — VERSÃO REFATORADA (Passo 1)
 *
 * O QUE MUDOU NESTE PASSO:
 * ✅ As funções de data foram REMOVIDAS daqui
 * ✅ Agora importamos essas funções de src/utils/date.js
 * ✅ As formatações de valor foram REMOVIDAS daqui
 * ✅ Agora importamos de src/utils/format.js
 * ✅ window.formatarDataParaBusca e window.formatarDataParaExibicao
 *    ainda existem como aliases para não quebrar o HTML existente
 *
 * O QUE NÃO MUDOU:
 * ❌ Todo o resto do app continua igual — sem risco de quebrar nada
 *
 * PRÓXIMO PASSO (Passo 2):
 * → Extrair calcularValorDia para src/business/financeiro.js
 */

// =============================================================
// IMPORTS — As funções que saíram deste arquivo
// =============================================================
import {
    formatarDataParaBusca,
    formatarDataParaExibicao,
    ultimoDiaDoMes,
    getAnoMesAtual,
    getHojeStr,
    primeiroDiaDoMes,
    dataEstaNoMes,
    dataEstaNoIntervalo,
} from './src/utils/date.js';

import {
    formatarMoeda,
    formatarValorNumerico,
    formatarQuantidade,
    formatarQuantidadeMista,
    formatarPercentual,
    formatarNumeroInteligente,
} from './src/utils/format.js';

import {
    calcularValorDia,
    calcularPontos,
    getMetaDiaria,
    getConfigVeiculo,
} from './src/business/financeiro.js';
// =============================================================
// ALIASES PARA O HTML EXISTENTE
// Enquanto o index.html ainda chama window.formatarDataParaBusca,
// esses aliases garantem que nada quebra.
// Quando o HTML for refatorado, eles serão removidos.
// =============================================================
window.formatarDataParaBusca = formatarDataParaBusca;
window.formatarDataParaExibicao = formatarDataParaExibicao;

// =============================================================
// CONEXÃO COM SUPABASE
// =============================================================
const supabase = window.supabaseClient;

// =============================================================
// ESTADO GLOBAL
// (Será migrado para src/state/appState.js no Passo 4)
// =============================================================
window.motRayanna = [];
window.motJulia = [];
window.motOutros = [];
window.motoristas = [];
window.motoristaSelecionado = null;
window.chartInstanciaInd = null;
window.chartInstanciaGeral = null;
window.diasUteisTravado = true;
window.bancoDadosCloud = {};
window.configMesesCloud = {};
window.configSlaCloud = {};
window.visibilidadeCloud = {};

// =============================================================
// INICIALIZAÇÃO DE DATAS — Agora usa os utilitários importados
// =============================================================
const hojeStr = getHojeStr();
const anoMesAtual = getAnoMesAtual();
const startStr = primeiroDiaDoMes(anoMesAtual);

// Preenche os inputs de data do HTML
if (document.getElementById('dataGlobal'))        document.getElementById('dataGlobal').value = anoMesAtual;
if (document.getElementById('dataLancamento'))    document.getElementById('dataLancamento').value = hojeStr;
if (document.getElementById('dataRankingInicio')) document.getElementById('dataRankingInicio').value = hojeStr;
if (document.getElementById('dataRankingFim'))    document.getElementById('dataRankingFim').value = hojeStr;
if (document.getElementById('mesFiltro'))         document.getElementById('mesFiltro').value = anoMesAtual;
if (document.getElementById('dataDomInicio'))     document.getElementById('dataDomInicio').value = startStr;
if (document.getElementById('dataDomFim'))        document.getElementById('dataDomFim').value = hojeStr;
if (document.getElementById('dataFerInicio'))     document.getElementById('dataFerInicio').value = startStr;
if (document.getElementById('dataFerFim'))        document.getElementById('dataFerFim').value = hojeStr;
if (document.getElementById('dataProjInicio'))    document.getElementById('dataProjInicio').value = startStr;
if (document.getElementById('dataProjFim'))       document.getElementById('dataProjFim').value = hojeStr;

// =============================================================
// LÓGICA DE NEGÓCIO — PONTOS
// (Será migrado para src/business/pontos.js no Passo 2)
// =============================================================
// Aliases — funções agora vêm de src/business/financeiro.js
window.calcularPontosMotorista = calcularPontos;
window.getMetaDiaria = getMetaDiaria;

// =============================================================
// O CÉREBRO: CARREGA TUDO DO SUPABASE
// (Será migrado para src/services/ no Passo 3)
// =============================================================
async function carregarDadosDoSupabase() {
    try {
        // 1. Lançamentos
const { data: lancs, error: erroLancs } = await supabase
    .from('lancamentos')
    .select('*')
    .is('cancelado_em', null);
            if (erroLancs) throw erroLancs;

       window.bancoDadosCloud[l.data][l.motorista_nome] = {
    anexoNome: l.anexo_nome,
    anexoUrl: l.anexo_url,
    anexoPath: l.anexo_path,
    anexoTipo: l.anexo_tipo,
    servicos: l.quantidade_servicos,
    valor: parseFloat(l.valor_faturamento) || 0,
    isFeriado: l.is_feriado,
    ganhouBonusSemana: l.ganhou_bonus_semana,
    tipoVeiculo: l.tipo_veiculo,
    valorExtra: parseFloat(l.valor_extra) || 0,
    pontos: l.quantidade_servicos,
    observacao: l.observacao,
    status: l.status_servico,
};
            });
        }

        // 2. Motoristas
    const { data: mots, error: erroMots } = await supabase
    .from('motoristas')
    .select('*')
    .neq('status', 'inativo');        if (erroMots) throw erroMots;

        window.motRayanna = []; window.motJulia = []; window.motOutros = []; window.motoristas = [];
        if (mots) {
            mots.forEach(m => {
                window.motoristas.push(m.nome);
                if (m.turno === 'dia')   window.motRayanna.push(m.nome);
                else if (m.turno === 'noite') window.motJulia.push(m.nome);
                else window.motOutros.push(m.nome);
            });
        }
        window.motoristas.sort();

        // 3. Dias Úteis
        const { data: configs } = await supabase.from('config_meses').select('*');
        window.configMesesCloud = {};
        if (configs) configs.forEach(c => window.configMesesCloud[c.ano_mes] = c.dias_uteis_sla);

        // 4. SLAs individuais
        const { data: slas } = await supabase.from('config_slas').select('*');
        window.configSlaCloud = {};
        if (slas) slas.forEach(s => window.configSlaCloud[s.chave] = parseFloat(s.valor));

        // 5. Visibilidade do Mês
        const { data: visib } = await supabase.from('visibilidade_mes').select('*');
        window.visibilidadeCloud = {};
        if (visib) {
            visib.forEach(v => {
                const parts = v.chave.split('_');
                const mesKey = parts[0];
                const nomKey = parts.slice(1).join('_');
                if (!window.visibilidadeCloud[mesKey]) window.visibilidadeCloud[mesKey] = {};
                window.visibilidadeCloud[mesKey][nomKey] = v.status;
            });
        }

        // Atualiza a tela
        window.reconstruirListasMotoristas();
        if (window.motoristaSelecionado) {
            window.carregarHistoricoMotorista();
            window.atualizarResumosDoMotorista();
            window.atualizarGraficosProjecao();
            window.atualizarSlaInput();
        }
        window.sincronizarMesFiltro();
        window.atualizarResumosGlobais();
        window.gerarRankingPeriodo();
        window.gerarRankingMensal();
        window.gerarPainelFeriados();

        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => { loader.style.display = 'none'; }, 500);
        }
    } catch (error) {
        console.error('ERRO AO CARREGAR:', error);
        alert('Erro ao carregar dados: ' + error.message);
    }
}

window.carregarDadosDoSupabase = carregarDadosDoSupabase;
window.carregarDadosDoSupabase();

// =============================================================
// GRAVAÇÃO DE LANÇAMENTOS
// (Será migrado para src/services/lancamentosService.js no Passo 3)
// =============================================================
window.syncToSupabase = async function(dataStr, motoristaNome) {
    const lanc = window.bancoDadosCloud[dataStr]?.[motoristaNome];
    if (!lanc) return;

    const dadosParaSalvar = {
        anexo_nome: lanc.anexoNome || null,
        anexo_url: lanc.anexoUrl || null,
        anexo_path: lanc.anexoPath || null,
        anexo_tipo: lanc.anexoTipo || null, 
        data: dataStr,
        motorista_nome: motoristaNome,
        status_servico: lanc.status,
        tipo_veiculo: lanc.tipoVeiculo,
        quantidade_servicos: lanc.servicos,
        valor_faturamento: lanc.valor,
        valor_extra: lanc.valorExtra,
        is_feriado: lanc.isFeriado,
        ganhou_bonus_semana: lanc.ganhouBonusSemana,
        observacao: lanc.observacao,
    };

    const { error } = await supabase
        .from('lancamentos')
        .upsert(dadosParaSalvar, { onConflict: 'data,motorista_nome' });

    if (error) {
        console.error('Erro na nuvem:', error.message);
        alert('Erro ao salvar: ' + error.message);
    }
};

// =============================================================
// MODAL SISTEMA / BACKUP
// =============================================================
window.abrirModalSistema = function() {
    const modal = document.getElementById('modalSistema');
    if (!modal) {
        alert('Modal de sistema não encontrado no HTML.');
        return;
    }

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    lucide.createIcons();
};

window.fecharModalSistema = function() {
    const modal = document.getElementById('modalSistema');
    if (!modal) return;

    modal.classList.add('hidden');
    modal.style.display = 'none';

    const codigoIA = document.getElementById('codigoIA');
    if (codigoIA) codigoIA.value = '';
};

window.gerarBackup = function() {
    const dadosStr = JSON.stringify(window.bancoDadosCloud, null, 2);
    const blob = new Blob([dadosStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Agora usa a função importada getHojeStr() em vez do bloco de código inline
    a.download = `backup_sgc_${getHojeStr()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('Backup gerado com sucesso! Guarde o arquivo .json em um local seguro.');
};

window.apagarTudo = async function() {
    alert('Exclusão total desativada por segurança.');
};

window.importarDadosIA = async function() {
    const jsonText = document.getElementById('codigoIA').value.trim();
    if (!jsonText) { alert('Cole o código gerado pela IA antes de importar!'); return; }

    let dados;
    try {
        dados = JSON.parse(jsonText);
    } catch (e) {
        alert('Erro no código da IA! Verifique se o JSON está correto.');
        return;
    }

    const loader = document.getElementById('loader');
    if (loader) { loader.style.display = 'flex'; loader.style.opacity = '1'; }

    let upsertArray = [];
    dados.forEach(lanc => {
        const dataStr = lanc.data;
        const mot = lanc.motorista.toUpperCase().trim();
        if (!window.motoristas.includes(mot)) return;

        let statusFinal = (lanc.status || 'normal').toLowerCase();
        let servicosFinais = parseInt(lanc.qtd);
        if (isNaN(servicosFinais)) servicosFinais = 0;
        let isFeriadoFinal = lanc.isFeriado === true;
        let tipoVeiculoFinal = lanc.veiculo || (window.motOutros.includes(mot) ? 'cacamba' : 'poliguindaste');
        let valorExtraFinal = parseFloat(lanc.extra) || 0;
        let observacaoFinal = lanc.observacao || '';

        if (statusFinal !== 'normal') { servicosFinais = 0; valorExtraFinal = 0; }

        const dataObj = new Date(dataStr + 'T00:00:00');
        const diaSemana = dataObj.getDay();
        const isDomingo = diaSemana === 0;
        const isSabado = diaSemana === 6;

        const { valorBase, bateuMetaSemana } = calcularValorDia({
    motoristaNome: mot,
    dataStr,
    servicos: servicosFinais,
    tipoVeiculo: tipoVeiculoFinal,
    isFeriado: isFeriadoFinal,
    status: statusFinal,
    bancoDados: window.bancoDadosCloud,
    formatarData: formatarDataParaBusca,
});
const valorNormalBase = valorBase;

        upsertArray.push({
            data: dataStr,
            motorista_nome: mot,
            status_servico: statusFinal,
            tipo_veiculo: tipoVeiculoFinal,
            quantidade_servicos: servicosFinais,
            valor_faturamento: valorNormalBase + valorExtraFinal,
            valor_extra: valorExtraFinal,
            is_feriado: isFeriadoFinal,
            ganhou_bonus_semana: bateuMetaSemana,
            observacao: observacaoFinal,
        });
    });

    if (upsertArray.length > 0) {
        const { error } = await supabase
            .from('lancamentos')
            .upsert(upsertArray, { onConflict: 'data,motorista_nome' });

        if (error) {
            alert('Erro ao importar: ' + error.message);
            if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.style.display = 'none', 300); }
            return;
        }
        await window.carregarDadosDoSupabase();
    }
    window.fecharModalSistema();
    alert(`Sucesso! ${upsertArray.length} lançamentos da IA foram injetados.`);
};

// =============================================================
// GERENCIAR MOTORISTAS
// =============================================================
window.gerenciarMotoristas = function() { window.abrirModalGerenciar(); };

window.abrirModalGerenciar = function() {
    const modal = document.getElementById('modalGerenciar');
    const selOcultar = document.getElementById('ocultarMotNome');
    const selMostrar = document.getElementById('mostrarMotNome');
    const elMes = document.getElementById('dataGlobal');
    const mesAtualFiltro = elMes && elMes.value ? elMes.value.substring(0, 7) : getAnoMesAtual();

    if (document.getElementById('lblMesGerenciar')) document.getElementById('lblMesGerenciar').innerText = mesAtualFiltro;
    selOcultar.innerHTML = '<option value="">Selecione quem retirar...</option>';
    selMostrar.innerHTML = '<option value="">Selecione quem adicionar...</option>';

    const visibMes = window.visibilidadeCloud[mesAtualFiltro] || {};
    window.motoristas.forEach(m => {
        const isVisible = visibMes[m] !== 'hide';
        if (isVisible) selOcultar.innerHTML += `<option value="${m}">${m}</option>`;
        else           selMostrar.innerHTML += `<option value="${m}">${m}</option>`;
    });
    modal.classList.remove('hidden');
    lucide.createIcons();
};

window.fecharModalGerenciar = function() {
    document.getElementById('modalGerenciar').classList.add('hidden');
    document.getElementById('novoMotNome').value = '';
};

window.addMotoristaModal = async function() {
    const nome = document.getElementById('novoMotNome').value.toUpperCase().trim();
    const turno = document.getElementById('novoMotTurno').value;
    const elMes = document.getElementById('dataGlobal');
    const mesAtualFiltro = elMes && elMes.value ? elMes.value.substring(0, 7) : getAnoMesAtual();

    if (!nome) {
        alert('Informe o nome do motorista.');
        return;
    }

    const { error: erroMotorista } = await supabase
        .from('motoristas')
        .upsert({
            nome,
            turno,
            meta_diaria_padrao: 8,
            status: 'ativo'
        }, { onConflict: 'nome' });

    if (erroMotorista) {
        alert('Erro ao cadastrar motorista: ' + erroMotorista.message);
        return;
    }

    const { error: erroVisibilidade } = await supabase
        .from('visibilidade_mes')
        .upsert({
            chave: `${mesAtualFiltro}_${nome}`,
            status: 'show'
        }, { onConflict: 'chave' });

    if (erroVisibilidade) {
        alert('Motorista cadastrado, mas erro ao adicionar no mês: ' + erroVisibilidade.message);
        return;
    }

    await window.carregarDadosDoSupabase();

    document.getElementById('novoMotNome').value = '';
    window.fecharModalGerenciar();

    alert('Motorista cadastrado com sucesso!');
};

window.ocultarMotoristaMes = async function() {
    const nome = document.getElementById('ocultarMotNome').value;
    const elMes = document.getElementById('dataGlobal');
    const mesAtualFiltro = elMes && elMes.value ? elMes.value.substring(0, 7) : getAnoMesAtual();
    if (!nome) return;
    await supabase.from('visibilidade_mes').upsert({ chave: `${mesAtualFiltro}_${nome}`, status: 'hide' }, { onConflict: 'chave' });
    await window.carregarDadosDoSupabase();
    window.fecharModalGerenciar();
};

window.mostrarMotoristaMes = async function() {
    const nome = document.getElementById('mostrarMotNome').value;
    const elMes = document.getElementById('dataGlobal');
    const mesAtualFiltro = elMes && elMes.value ? elMes.value.substring(0, 7) : getAnoMesAtual();
    if (!nome) return;
    await supabase.from('visibilidade_mes').upsert({ chave: `${mesAtualFiltro}_${nome}`, status: 'show' }, { onConflict: 'chave' });
    await window.carregarDadosDoSupabase();
    window.fecharModalGerenciar();
};

window.apagarMotoristaDefinitivo = async function() {
    let nome = prompt('⚠️ ZONA DE PERIGO: Para APAGAR um motorista definitivamente do painel, digite o NOME EXATO dele abaixo:');
    if (!nome) return;
    nome = nome.toUpperCase().trim();
    if (confirm(`Tem certeza absoluta que deseja EXCLUIR "${nome}"? Ele sumirá dos rankings e das listas.`)) {
    await supabase
    .from('motoristas')
    .update({ status: 'inativo' })
    .eq('nome', nome);        await window.carregarDadosDoSupabase();
        window.fecharModalGerenciar();
        alert(`🗑️ Motorista ${nome} apagado com sucesso!`);
        if (window.motoristaSelecionado === nome) location.reload();
    }
};

// =============================================================
// SIDEBAR E LISTAS
// =============================================================
window.reconstruirListasMotoristas = function() {
    window.renderizarSidebar();
    const selProjMot = document.getElementById('filtroProjMot');
    if (selProjMot) {
        const selecionadoAntes = selProjMot.value;
        selProjMot.innerHTML = '<option value="">Selecione...</option>';
        window.motoristas.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m; opt.textContent = m;
            selProjMot.appendChild(opt);
        });
        if (window.motoristas.includes(selecionadoAntes)) selProjMot.value = selecionadoAntes;
    }
};

window.motoristaTemLancamentoNoMes = function(nome, mes) {
    for (const data in window.bancoDadosCloud) {
        // ✅ Usando a função importada dataEstaNoMes()
        if (dataEstaNoMes(data, mes) && window.bancoDadosCloud[data][nome]) return true;
    }
    return false;
};

window.renderizarSidebar = function() {
    const ul = document.getElementById('listaMotoristas');
    const selectFiltro = document.getElementById('filtroTurno');
    if (!ul) return;
    ul.innerHTML = '';
    const filtroVal = selectFiltro ? selectFiltro.value : 'todos';
    const elMes = document.getElementById('dataGlobal');
    const mesAtualFiltro = elMes && elMes.value ? elMes.value.substring(0, 7) : anoMesAtual;
    const visibMes = window.visibilidadeCloud[mesAtualFiltro] || {};

    function criarGrupo(titulo, lista, icone) {
        const listaFiltrada = lista.filter(mot => visibMes[mot] !== 'hide').sort();
        if (listaFiltrada.length === 0) return;

        const tituloEl = document.createElement('div');
        tituloEl.innerHTML = `${icone} ${titulo}`;
        ul.appendChild(tituloEl);

        listaFiltrada.forEach(mot => {
            const li = document.createElement('li');
            li.className = 'driver-item';
            if (mot === window.motoristaSelecionado) li.classList.add('active');

            const diasComLancamento = Object.keys(window.bancoDadosCloud)
                // ✅ Usando a função importada dataEstaNoMes()
                .filter(d => dataEstaNoMes(d, mesAtualFiltro) && window.bancoDadosCloud[d][mot])
                .sort();

            let isDesligadoNesteMes = false;
            if (diasComLancamento.length > 0) {
                const ultimoDia = diasComLancamento[diasComLancamento.length - 1];
                if (window.bancoDadosCloud[ultimoDia][mot].status === 'desligado') isDesligadoNesteMes = true;
            }

            if (isDesligadoNesteMes) {
                li.innerHTML = `<span class="text-red-500 w-full block font-black leading-tight">${mot} <span class="text-[9px] opacity-90 ml-1 bg-red-100 text-red-700 px-1 rounded border border-red-200">(Deslig. no Mês)</span></span>`;
            } else {
                li.textContent = mot;
            }

            li.onclick = () => window.selecionarMotorista(mot, li);
            ul.appendChild(li);
        });
    }

    if (filtroVal === 'todos' || filtroVal === 'dia')      criarGrupo('Dia (Rayanna)', window.motRayanna, '☀️');
    if (filtroVal === 'todos' || filtroVal === 'noite')    criarGrupo('Noite (Júlia)', window.motJulia, '🌙');
    if (filtroVal === 'todos' || filtroVal === 'especial') criarGrupo('Especial (Caçamba)', window.motOutros, '🚛');
    lucide.createIcons();
};

window.toggleTravaGlobais = function() {
    window.diasUteisTravado = !window.diasUteisTravado;
    const inLanc = document.getElementById('inputDiasUteisLanc');
    const inRank = document.getElementById('inputDiasUteisRank');
    const btnLanc = document.getElementById('btnTravaLanc');
    const btnRank = document.getElementById('btnTravaRank');
    if (!inLanc || !inRank) return;

    if (window.diasUteisTravado) {
        inLanc.setAttribute('readonly', 'true'); inRank.setAttribute('readonly', 'true');
        if (btnLanc) btnLanc.innerHTML = '<i data-lucide="lock" class="w-5 h-5"></i>';
        if (btnRank) btnRank.innerHTML = '<i data-lucide="lock" class="w-5 h-5"></i>';
    } else {
        inLanc.removeAttribute('readonly'); inRank.removeAttribute('readonly');
        if (btnLanc) btnLanc.innerHTML = '<i data-lucide="unlock" class="w-5 h-5"></i>';
        if (btnRank) btnRank.innerHTML = '<i data-lucide="unlock" class="w-5 h-5"></i>';
        const viewLanc = document.getElementById('viewLancamentos');
        if (viewLanc && viewLanc.style.display !== 'none') inLanc.focus();
        else inRank.focus();
    }
    lucide.createIcons();
};

window.carregarDiasUteis = function(anoMesStr) {
    const dias = window.configMesesCloud[anoMesStr] || 22;
    if (document.getElementById('inputDiasUteisLanc')) document.getElementById('inputDiasUteisLanc').value = dias;
    if (document.getElementById('inputDiasUteisRank')) document.getElementById('inputDiasUteisRank').value = dias;
    return dias;
};

window.salvarDiasUteis = async function(origem) {
    const valor = origem === 'lanc'
        ? document.getElementById('inputDiasUteisLanc').value
        : document.getElementById('inputDiasUteisRank').value;

    const dias = parseInt(valor) || 22;
    if (dias < 1 || dias > 31) return;

    // Pega o mês sempre do dataGlobal ou mesFiltro, independente da aba
    const elGlobal = document.getElementById('dataGlobal');
    const elFiltro = document.getElementById('mesFiltro');

    const mesRef = elGlobal?.value || elFiltro?.value;
    if (!mesRef) return;

    // Garante que usa só YYYY-MM
    const anoMes = mesRef.substring(0, 7);

    const { error } = await supabase
        .from('config_meses')
        .upsert({ ano_mes: anoMes, dias_uteis_sla: dias }, { onConflict: 'ano_mes' });

    if (error) {
        console.error('Erro ao salvar dias úteis:', error.message);
        alert('Erro ao salvar dias úteis: ' + error.message);
        return;
    }

    await window.carregarDadosDoSupabase();
};

window.calcularSlaMotorista = function(mot, mesFiltro) {
    const visibMes = window.visibilidadeCloud[mesFiltro] || {};
    if (visibMes[mot] === 'hide') return 0;
    if (window.configSlaCloud[mot + '_' + mesFiltro] !== undefined) {
        return window.configSlaCloud[mot + '_' + mesFiltro];
    }
    return window.carregarDiasUteis(mesFiltro);
};

window.toggleTravaSla = async function() {
    if (!window.motoristaSelecionado) { alert('Selecione um motorista primeiro!'); return; }
    const inSla = document.getElementById('inputSlaMotorista');
    const elMes = document.getElementById('dataGlobal');
    if (!inSla) return;
    const mesFiltroStr = elMes && elMes.value ? elMes.value.substring(0, 7) : getAnoMesAtual();
    const chaveComMes = window.motoristaSelecionado + '_' + mesFiltroStr;

    if (inSla.hasAttribute('readonly')) {
        await supabase.from('config_slas').delete().eq('chave', chaveComMes);
        await window.carregarDadosDoSupabase();
    } else {
        await window.salvarSlaMotorista();
    }
};

window.atualizarSlaInput = function() {
    if (!window.motoristaSelecionado) return;
    const elMes = document.getElementById('dataGlobal');
    const mesFiltroStr = elMes && elMes.value ? elMes.value.substring(0, 7) : getAnoMesAtual();
    const chaveComMes = window.motoristaSelecionado + '_' + mesFiltroStr;
    const customSla = window.configSlaCloud[chaveComMes];
    const slaAtivo = window.calcularSlaMotorista(window.motoristaSelecionado, mesFiltroStr);

    const inSla = document.getElementById('inputSlaMotorista');
    const btnSla = document.getElementById('btnTravaSla');
    if (inSla && btnSla) {
        inSla.value = slaAtivo;
        if (customSla !== undefined) {
            inSla.setAttribute('readonly', 'true');
            btnSla.innerHTML = '<i data-lucide="lock" class="w-4 h-4"></i>';
            btnSla.className = 'bg-red-100 text-red-600 hover:text-red-700 p-2 rounded-lg shadow-sm border border-red-200 transition-colors shrink-0';
        } else {
            inSla.removeAttribute('readonly');
            btnSla.innerHTML = '<i data-lucide="unlock" class="w-4 h-4"></i>';
            btnSla.className = 'text-amber-500 hover:text-amber-700 bg-white p-2 rounded-lg shadow-sm border border-amber-100 transition-colors shrink-0';
        }
    }
    lucide.createIcons();
};

window.salvarSlaMotorista = async function() {
    if (!window.motoristaSelecionado) return;
    const inSla = document.getElementById('inputSlaMotorista');
    const elMes = document.getElementById('dataGlobal');
    if (!inSla) return;
    const val = parseFloat(inSla.value);
    const mesFiltroStr = elMes && elMes.value ? elMes.value.substring(0, 7) : getAnoMesAtual();
    const chaveComMes = window.motoristaSelecionado + '_' + mesFiltroStr;
    if (val >= 0) {
        await supabase.from('config_slas').upsert({ chave: chaveComMes, valor: val }, { onConflict: 'chave' });
        await window.carregarDadosDoSupabase();
    }
};

window.sincronizarMesData = function() {
    const dtG = document.getElementById('dataGlobal');
    const msF = document.getElementById('mesFiltro');
    if (!dtG || !msF) return;
    msF.value = dtG.value;
    window.carregarDiasUteis(dtG.value);
    window.renderizarSidebar();
};

window.sincronizarMesFiltro = function() {
    const msF = document.getElementById('mesFiltro');
    if (!msF) return;
    window.carregarDiasUteis(msF.value);
    window.renderizarSidebar();
};

window.calcularPrevisao = function(totalSoma, anoMesStr, diasUteisAlvo) {
    if (totalSoma === 0) return 0;
    const dataAtual = new Date();
    const anoAtual = dataAtual.getFullYear();
    const mesAtual = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const strAtual = `${anoAtual}-${mesAtual}`;
    const diasUteisTotais = diasUteisAlvo || window.carregarDiasUteis(anoMesStr);
    let diasUteisCorridos = 0;

    if (anoMesStr < strAtual) {
        diasUteisCorridos = diasUteisTotais;
    } else if (anoMesStr > strAtual) {
        return 0;
    } else {
        const diaHoje = dataAtual.getDate();
        const diasNoMes = new Date(anoAtual, parseInt(mesAtual), 0).getDate();
        const progresso = diaHoje / diasNoMes;
        diasUteisCorridos = Math.max(1, Math.round(diasUteisTotais * progresso));
    }

    if (diasUteisCorridos === 0) return 0;
    return Math.round((totalSoma / diasUteisCorridos) * diasUteisTotais);
};

window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('w-[280px]')) {
        sidebar.classList.remove('w-[280px]'); sidebar.classList.add('w-0');
    } else {
        sidebar.classList.remove('w-0'); sidebar.classList.add('w-[280px]');
    }
};

window.mudarAba = function(aba) {
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));

    ['viewLancamentos', 'viewRankings', 'viewDomFeriados', 'viewProjecao', 'viewAuditoria'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    if (aba === 'lancamentos') {
        document.getElementById('btnTabLancamentos')?.classList.add('active');
        document.getElementById('viewLancamentos') && (document.getElementById('viewLancamentos').style.display = 'block');
    } else if (aba === 'rankings') {
        document.getElementById('btnTabRankings')?.classList.add('active');
        document.getElementById('viewRankings') && (document.getElementById('viewRankings').style.display = 'block');
        window.gerarRankingPeriodo();
        window.gerarRankingMensal();
    } else if (aba === 'domferiados') {
        document.getElementById('btnTabDomFeriados')?.classList.add('active');
        document.getElementById('viewDomFeriados') && (document.getElementById('viewDomFeriados').style.display = 'block');
        window.gerarPainelFeriados();
    } else if (aba === 'projecao') {
        document.getElementById('btnTabProjecao')?.classList.add('active');
        document.getElementById('viewProjecao') && (document.getElementById('viewProjecao').style.display = 'block');
        window.atualizarGraficosProjecao();
    } else if (aba === 'auditoria') {
        document.getElementById('btnTabAuditoria')?.classList.add('active');
        document.getElementById('viewAuditoria') && (document.getElementById('viewAuditoria').style.display = 'block');
        window.carregarAuditoriaLancamentos();
    }
};

window.mudarAba('lancamentos');


window.filtrarMotoristas = function() {
    const busca = document.getElementById('buscaMotorista');
    if (!busca) return;
    const input = busca.value.toUpperCase();
    document.querySelectorAll('.driver-item').forEach(item => {
        const nome = item.textContent || item.innerText;
        item.style.display = nome.toUpperCase().includes(input) ? '' : 'none';
    });
};

window.selecionarMotorista = function(nome, elementoLista) {
    window.motoristaSelecionado = nome;
    document.querySelectorAll('.driver-item').forEach(el => el.classList.remove('active'));
    if (elementoLista) elementoLista.classList.add('active');

    document.getElementById('estadoVazio') && (document.getElementById('estadoVazio').style.display = 'none');
    document.getElementById('conteudoMotorista') && (document.getElementById('conteudoMotorista').style.display = 'block');
    if (document.getElementById('nomeMotoristaDisplay')) document.getElementById('nomeMotoristaDisplay').textContent = nome;

    const selectVeiculo = document.getElementById('tipoVeiculo');
    if (selectVeiculo) {
        selectVeiculo.innerHTML = `
            <option value="poliguindaste">Poliguindaste Simples (Meta 4 Cx p/ Faturamento)</option>
            <option value="poli_duplo">Poliguindaste Duplo (Meta 8 Cx p/ Faturamento)</option>
            <option value="cacamba">Caminhão Caçamba (Meta 4 Vg p/ Faturamento)</option>
        `;
        selectVeiculo.value = window.motOutros.includes(nome) ? 'cacamba' : 'poliguindaste';
    }

    if (document.getElementById('filtroProjMot')) document.getElementById('filtroProjMot').value = nome;
    window.atualizarSlaInput();
    window.carregarHistoricoMotorista();
    window.atualizarResumosDoMotorista();
    window.atualizarGraficosProjecao();
};

window.selecionarMotoristaProjecao = function(nome) { if (!nome) return; window.selecionarMotorista(nome, null); };

// =============================================================
// SALVAR LANÇAMENTO
// =============================================================
window.salvarLancamento = async function() {
    if (!window.motoristaSelecionado) { alert('Selecione um motorista primeiro!'); return; }
    const elData = document.getElementById('dataLancamento');
    const dataStr = elData ? elData.value : null;
    if (!dataStr) { alert('Preencha a data do serviço.'); return; }

    const statusInput = document.getElementById('statusServico').value;
    const tipoVeiculoInput = document.getElementById('tipoVeiculo').value;
    let servicosInput = parseInt(document.getElementById('servicos').value) || 0;
    let valorExtraInput = parseFloat(document.getElementById('valorExtra').value.replace(',', '.')) || 0;
    const isFeriadoInput = document.getElementById('feriado') ? document.getElementById('feriado').checked : false;
    const observacaoInput = document.getElementById('observacao') ? document.getElementById('observacao').value.trim() : '';

    if (statusInput !== 'normal') { servicosInput = 0; valorExtraInput = 0; }

    const bancoDados = window.bancoDadosCloud;
    if (!bancoDados[dataStr]) bancoDados[dataStr] = {};
    const lancamentoExistente = bancoDados[dataStr][window.motoristaSelecionado];

    let servicosFinais = servicosInput;
    let valorExtraFinal = valorExtraInput;
    let isFeriadoFinal = isFeriadoInput;
    let observacaoFinal = observacaoInput;
    let tipoVeiculoFinal = tipoVeiculoInput;
    let statusFinal = statusInput;

    if (lancamentoExistente) {
        if (lancamentoExistente.status !== 'normal' && statusInput === 'normal') {
            servicosFinais = servicosInput;
            valorExtraFinal = valorExtraInput;
        } else {
            servicosFinais += (lancamentoExistente.servicos || 0);
            valorExtraFinal += (lancamentoExistente.valorExtra || 0);
        }
        isFeriadoFinal = isFeriadoInput || lancamentoExistente.isFeriado;
        if (lancamentoExistente.observacao && observacaoInput) observacaoFinal = lancamentoExistente.observacao + ' | ' + observacaoInput;
        else if (lancamentoExistente.observacao) observacaoFinal = lancamentoExistente.observacao;

        if (lancamentoExistente.tipoVeiculo && lancamentoExistente.tipoVeiculo !== tipoVeiculoInput && statusInput === 'normal') {
            tipoVeiculoFinal = 'misto';
            if (!observacaoFinal.includes('[MISTO]')) observacaoFinal = '[MISTO] ' + observacaoFinal;
        } else {
            tipoVeiculoFinal = lancamentoExistente.tipoVeiculo;
        }
    }

    const dataObj = new Date(dataStr + 'T00:00:00');
    const diaSemana = dataObj.getDay();
    const isDomingo = diaSemana === 0;
    const isSabado = diaSemana === 6;

    const { valorBase, bateuMetaSemana } = calcularValorDia({
    motoristaNome: window.motoristaSelecionado,
    dataStr,
    servicos: servicosFinais,
    tipoVeiculo: tipoVeiculoFinal,
    isFeriado: isFeriadoFinal,
    status: statusFinal,
    bancoDados: window.bancoDadosCloud,
    formatarData: formatarDataParaBusca,
});
const valorNormalBase = valorBase;

    const valorFinal = valorNormalBase + valorExtraFinal;

    const arquivoAnexo = document.getElementById('anexoObs')?.files?.[0];
let dadosAnexo = null;

if (arquivoAnexo) {
    const nomeSeguro = arquivoAnexo.name.replace(/[^\w.\-]+/g, '_');
    const caminhoAnexo = `${dataStr}/${window.motoristaSelecionado}/${Date.now()}_${nomeSeguro}`;

    const { error: erroUpload } = await supabase.storage
        .from('lancamentos-anexos')
        .upload(caminhoAnexo, arquivoAnexo, { upsert: true });

    if (erroUpload) {
        alert('Erro ao anexar arquivo: ' + erroUpload.message);
        return;
    }

    const { data: urlData } = supabase.storage
        .from('lancamentos-anexos')
        .getPublicUrl(caminhoAnexo);

    dadosAnexo = {
        nome: arquivoAnexo.name,
        url: urlData.publicUrl,
        path: caminhoAnexo,
        tipo: arquivoAnexo.type || '',
    };
}
    bancoDados[dataStr][window.motoristaSelecionado] = {
        anexoNome: dadosAnexo?.nome || lancamentoExistente?.anexoNome || null,
        anexoUrl: dadosAnexo?.url || lancamentoExistente?.anexoUrl || null,
        anexoPath: dadosAnexo?.path || lancamentoExistente?.anexoPath || null,
        anexoTipo: dadosAnexo?.tipo || lancamentoExistente?.anexoTipo || null,
        servicos: servicosFinais,
        valor: valorFinal,
        isFeriado: isFeriadoFinal,
        ganhouBonusSemana: bateuMetaSemana,
        tipoVeiculo: tipoVeiculoFinal,
        valorExtra: valorExtraFinal,
        pontos: window.calcularPontosMotorista(window.motoristaSelecionado, servicosFinais, tipoVeiculoFinal),
        observacao: observacaoFinal,
        status: statusFinal,
    };

    await window.syncToSupabase(dataStr, window.motoristaSelecionado);
    await window.carregarDadosDoSupabase();

    if (document.getElementById('servicos'))     document.getElementById('servicos').value = '';
    if (document.getElementById('valorExtra'))   document.getElementById('valorExtra').value = '';
    if (document.getElementById('observacao'))   document.getElementById('observacao').value = '';
    if (document.getElementById('feriado'))      document.getElementById('feriado').checked = false;
    if (document.getElementById('statusServico')) document.getElementById('statusServico').value = 'normal';
    if (document.getElementById('anexoObs'))     document.getElementById('anexoObs').value = '';
    if (document.getElementById('nomeAnexo'))    document.getElementById('nomeAnexo').classList.add('hidden');
};

// =============================================================
// HISTÓRICO E EXCLUSÃO
// =============================================================
window.carregarHistoricoMotorista = function() {
    if (!window.motoristaSelecionado) return;
    const tbody = document.querySelector('#tabelaHistorico tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const bancoDados = window.bancoDadosCloud;
    const elMes = document.getElementById('dataGlobal');
    const mesFiltroStr = elMes && elMes.value ? elMes.value.substring(0, 7) : getAnoMesAtual();

    let historico = [];
    for (const data in bancoDados) {
        // ✅ Usando a função importada dataEstaNoMes()
        if (dataEstaNoMes(data, mesFiltroStr) && bancoDados[data][window.motoristaSelecionado]) {
            historico.push({ data, dados: bancoDados[data][window.motoristaSelecionado] });
        }
    }
    historico.sort((a, b) => new Date(b.data) - new Date(a.data));

    if (historico.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-slate-400 font-medium py-8">Nenhum lançamento encontrado neste mês.</td></tr>';
        return;
    }

    historico.forEach(item => {
        const tr = document.createElement('tr');
        const dataObj = new Date(item.data + 'T00:00:00');

        let tagsDia = '';
        if (dataObj.getDay() === 0) tagsDia += '<span class="badge-feriado">DOMINGO</span> ';
        if (item.dados.isFeriado) tagsDia += '<span class="badge-feriado">FERIADO</span> ';
        if (item.dados.ganhouBonusSemana) tagsDia += '<span class="badge-meta">META SAB BATIDA</span>';
        if (!tagsDia) tagsDia = 'Normal';

        const statusMap = { falta: 'bg-red-500 text-white', folga: 'bg-slate-500 text-white', atestado: 'bg-yellow-400 text-slate-800', polioff: 'bg-orange-500 text-white', licenca: 'bg-purple-500 text-white', desligado: 'bg-red-800 text-white shadow-sm' };
        const statusLabel = { falta: 'Falta', folga: 'Folga', atestado: 'Atestado', polioff: 'Poli OFF', licenca: 'Licença', desligado: 'Desligado' };
        let tagStatus = '';
        if (item.dados.status && statusMap[item.dados.status]) {
            tagStatus = `<span class="${statusMap[item.dados.status]} px-2 py-0.5 rounded text-[10px] font-black uppercase">${statusLabel[item.dados.status]}</span>`;
        }

        let tagVeiculo = 'POLIGUINDASTE';
        if (item.dados.tipoVeiculo === 'cacamba')   tagVeiculo = 'CAÇAMBA';
        else if (item.dados.tipoVeiculo === 'poli_duplo') tagVeiculo = 'POLI. DUPLO';
        else if (item.dados.tipoVeiculo === 'misto') tagVeiculo = 'VEÍC. MISTO';

        const stringColuna2 = tagStatus
            ? tagStatus
            : `<span class="badge-veiculo">${tagVeiculo}</span><br><span class="inline-block mt-1">${tagsDia}</span>`;

        let qtdText = item.dados.tipoVeiculo === 'cacamba' ? `${item.dados.servicos} vg` : `${item.dados.servicos} cx`;
        if (item.dados.status && item.dados.status !== 'normal') qtdText = '-';

        // ✅ Usando a função importada formatarMoeda()
        const extraTxt = item.dados.valorExtra > 0 ? `+ ${formatarMoeda(item.dados.valorExtra)}` : '-';
        const obsText = item.dados.observacao || '-';
        const anexoHtml = item.dados.anexoUrl
    ? `<a href="${item.dados.anexoUrl}" target="_blank" class="text-blue-600 font-bold underline">Ver anexo</a>`
    : '';
        const dataEscaped = item.data.replace(/'/g, "\\'");

        tr.innerHTML = `
            <td class="text-slate-800 font-bold">${formatarDataParaExibicao(item.data)}</td>
            <td>${stringColuna2}</td>
            <td class="text-center font-black">${qtdText}</td>
            <td class="text-center text-blue-600 font-bold">${extraTxt}</td>
            <td class="text-right text-emerald-600 font-black text-sm">${formatarMoeda(item.dados.valor)}</td>
            <td class="text-xs text-slate-500 max-w-[180px] truncate" title="${obsText}">
    ${obsText}
    ${anexoHtml ? `<br>${anexoHtml}` : ''}
</td>            <td class="text-center"><button class="btn-delete" onclick="window.deletarLancamentoEspecifico('${dataEscaped}')">Excluir</button></td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
};

window.deletarLancamentoEspecifico = async function(dataStr) {
    if (!window.motoristaSelecionado) return;

    const motivo = prompt(`Motivo para cancelar o lançamento de ${formatarDataParaExibicao(dataStr)}:`);
    if (motivo === null) return;

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
        .from('lancamentos')
        .update({
            cancelado_em: new Date().toISOString(),
            cancelado_por: user?.id || null,
            cancelado_por_email: user?.email || null,
            motivo_cancelamento: motivo || 'Cancelado pelo sistema',
        })
        .eq('data', dataStr)
        .eq('motorista_nome', window.motoristaSelecionado);

    if (error) {
        alert('Erro ao cancelar: ' + error.message);
        return;
    }

    await window.carregarDadosDoSupabase();
};

// =============================================================
// RESUMOS
// =============================================================
window.atualizarResumosDoMotorista = function() {
    if (!window.motoristaSelecionado) return;
    const elLanc = document.getElementById('dataLancamento');
    if (!elLanc) return;
    const dataRefStr = elLanc.value;
    if (!dataRefStr) return;
    const bancoDados = window.bancoDadosCloud;

    let totalDia = 0;
    if (bancoDados[dataRefStr]?.[window.motoristaSelecionado]) {
        totalDia = bancoDados[dataRefStr][window.motoristaSelecionado].valor;
    }
    // ✅ Usando a função importada formatarMoeda()
    if (document.getElementById('motoristaTotalDia')) document.getElementById('motoristaTotalDia').innerText = formatarMoeda(totalDia);

    let totalSemana = 0;
    const dataObj = new Date(dataRefStr + 'T00:00:00');
    const diffParaSegunda = (dataObj.getDay() === 0) ? -6 : 1 - dataObj.getDay();
    const dataSegunda = new Date(dataObj);
    dataSegunda.setDate(dataObj.getDate() + diffParaSegunda);

    for (let i = 0; i < 7; i++) {
        const diaCheck = new Date(dataSegunda);
        diaCheck.setDate(dataSegunda.getDate() + i);
        // ✅ Usando a função importada
        const diaCheckStr = formatarDataParaBusca(diaCheck);
        if (bancoDados[diaCheckStr]?.[window.motoristaSelecionado]) {
            totalSemana += bancoDados[diaCheckStr][window.motoristaSelecionado].valor;
        }
    }
    if (document.getElementById('motoristaTotalSemana')) document.getElementById('motoristaTotalSemana').innerText = formatarMoeda(totalSemana);

    const elMes = document.getElementById('dataGlobal');
    const anoMesFiltro = elMes && elMes.value ? elMes.value.substring(0, 7) : dataRefStr.substring(0, 7);

    let totalCaixasMes = 0, totalViagensMes = 0, totalFatMes = 0, totalPontosMes = 0;

    for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
        // ✅ Usando a função importada dataEstaNoMes()
        if (dataEstaNoMes(dataStr, anoMesFiltro) && dadosDia[window.motoristaSelecionado]) {
            const r = dadosDia[window.motoristaSelecionado];
            if (!r.status || r.status === 'normal') {
                if (r.tipoVeiculo === 'cacamba') totalViagensMes += (r.servicos || 0);
                else totalCaixasMes += (r.servicos || 0);
                totalPontosMes += (r.pontos !== undefined) ? r.pontos : window.calcularPontosMotorista(window.motoristaSelecionado, (r.servicos || 0), r.tipoVeiculo);
            }
            totalFatMes += r.valor;
        }
    }

    const metaDiaria = window.getMetaDiaria(window.motoristaSelecionado);
    const diasUteisMotorista = window.calcularSlaMotorista(window.motoristaSelecionado, anoMesFiltro);
    const metaMensalPontos = diasUteisMotorista * metaDiaria;
    const previsaoPontos = window.calcularPrevisao(totalPontosMes, anoMesFiltro, diasUteisMotorista);
    const isEspecial = window.motOutros.includes(window.motoristaSelecionado);

    let textoMeta = '';
    if (isEspecial) {
        textoMeta = `${metaMensalPontos / 2} vg`;
        if (document.getElementById('motoristaCaixasMes')) document.getElementById('motoristaCaixasMes').innerText = `${totalCaixasMes} cx | ${totalViagensMes} vg`;
        if (document.getElementById('motoristaPrevisaoMes')) document.getElementById('motoristaPrevisaoMes').innerText = `${previsaoPontos / 2} vg`;
    } else {
        textoMeta = `${metaMensalPontos} cx`;
        if (document.getElementById('motoristaCaixasMes')) document.getElementById('motoristaCaixasMes').innerText = `${totalCaixasMes} cx`;
        const exibeCaixas = (totalPontosMes > 0 && totalCaixasMes > totalPontosMes) ? Math.round(previsaoPontos * (totalCaixasMes / totalPontosMes)) : previsaoPontos;
        if (document.getElementById('motoristaPrevisaoMes')) document.getElementById('motoristaPrevisaoMes').innerText = `${exibeCaixas} cx`;
    }
    // ✅ Usando a função importada formatarMoeda()
    if (document.getElementById('motoristaMetaMes')) document.getElementById('motoristaMetaMes').innerText = `Meta (Elo): ${textoMeta} | Fat: ${formatarMoeda(totalFatMes)}`;
};

window.atualizarResumosGlobais = function() {
    const elLanc = document.getElementById('dataLancamento');
    const dataRefStr = elLanc ? elLanc.value : null;
    const elGlobal = document.getElementById('dataGlobal');
    const mesGlobalStr = elGlobal ? elGlobal.value.substring(0, 7) : (dataRefStr ? dataRefStr.substring(0, 7) : null);
    if (!mesGlobalStr) return;
    const bancoDados = window.bancoDadosCloud;
    let totalDiaGlobal = 0, caixasDiaGlobal = 0, totalMesGlobal = 0, caixasMesGlobal = 0;

    if (dataRefStr && bancoDados[dataRefStr]) {
        for (const mot in bancoDados[dataRefStr]) {
            totalDiaGlobal += bancoDados[dataRefStr][mot].valor;
            if (bancoDados[dataRefStr][mot].tipoVeiculo !== 'cacamba' && (!bancoDados[dataRefStr][mot].status || bancoDados[dataRefStr][mot].status === 'normal')) {
                caixasDiaGlobal += (bancoDados[dataRefStr][mot].servicos || 0);
            }
        }
    }

    for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
        // ✅ Usando a função importada dataEstaNoMes()
        if (dataEstaNoMes(dataStr, mesGlobalStr)) {
            for (const mot in dadosDia) {
                totalMesGlobal += dadosDia[mot].valor;
                if (dadosDia[mot].tipoVeiculo !== 'cacamba' && (!dadosDia[mot].status || dadosDia[mot].status === 'normal')) {
                    caixasMesGlobal += (dadosDia[mot].servicos || 0);
                }
            }
        }
    }

    // ✅ Usando as funções importadas
    if (document.getElementById('totalDiaGlobal'))    document.getElementById('totalDiaGlobal').innerText = formatarMoeda(totalDiaGlobal);
    if (document.getElementById('caixasDiaGlobal'))   document.getElementById('caixasDiaGlobal').innerText = `${caixasDiaGlobal} cx`;
    if (document.getElementById('totalSemanaGlobal')) document.getElementById('totalSemanaGlobal').innerText = formatarMoeda(totalMesGlobal);
    if (document.getElementById('caixasSemanaGlobal')) document.getElementById('caixasSemanaGlobal').innerText = `${caixasMesGlobal} cx`;
};

// =============================================================
// RANKINGS
// =============================================================
window.gerarRankingPeriodo = function() {
    const elInicio = document.getElementById('dataRankingInicio');
    const elFim = document.getElementById('dataRankingFim');
    if (!elInicio || !elFim) return;
    const inicio = elInicio.value; const fim = elFim.value;
    if (!inicio || !fim) return;

    const bancoDados = window.bancoDadosCloud;
    let rankPeriodo = {};

    for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
        // ✅ Usando a função importada dataEstaNoIntervalo()
        if (dataEstaNoIntervalo(dataStr, inicio, fim)) {
            const diaDaSemana = new Date(dataStr + 'T00:00:00').getDay();
            for (const [mot, dados] of Object.entries(dadosDia)) {
                if (!rankPeriodo[mot]) rankPeriodo[mot] = { caixas: 0, viagens: 0, valor: 0, extra: 0, diasTrab: 0, pontos: 0 };
                rankPeriodo[mot].valor += dados.valor;
                rankPeriodo[mot].extra += dados.valorExtra || 0;

                if (!dados.status || dados.status === 'normal') {
                    if (dados.tipoVeiculo === 'cacamba') rankPeriodo[mot].viagens += (dados.servicos || 0);
                    else rankPeriodo[mot].caixas += (dados.servicos || 0);
                    rankPeriodo[mot].pontos += (dados.pontos !== undefined) ? dados.pontos : window.calcularPontosMotorista(mot, (dados.servicos || 0), dados.tipoVeiculo);
                    if (diaDaSemana !== 0 && diaDaSemana !== 6 && !dados.isFeriado) rankPeriodo[mot].diasTrab += 1;
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
        divLista.innerHTML = '<div class="text-center text-slate-400 py-8 font-medium">Nenhum serviço normal no período. 😴</div>';
        return;
    }

    rankArray.forEach((mot, index) => {
        // ✅ Usando as funções importadas
        const porcentagemStr = formatarPercentual(mot.porcentagem);
        const classeBarra = mot.porcentagem >= 100 ? 'meta-batida' : (mot.porcentagem >= 80 ? 'meta-excedida' : 'meta-ruim');
        const larguraBarra = Math.min(mot.porcentagem, 100);
        const extraBadge = mot.extra > 0 ? `<span class="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded ml-2">+ Extra ${formatarMoeda(mot.extra)}</span>` : '';
        const textoQtd = formatarQuantidadeMista(mot.caixas, mot.viagens, window.motOutros.includes(mot.nome));

        const linha = document.createElement('div');
        linha.className = 'diario-row';
        linha.innerHTML = `
            <div class="diario-top"><span class="diario-nome">#${index + 1} - ${mot.nome} <span class="text-blue-500 font-black">(${textoQtd})</span> ${extraBadge}</span><span class="diario-faturamento">${formatarMoeda(mot.valor)}</span></div>
            <div class="progress-wrapper"><div class="progress-bar-bg"><div class="progress-bar-fill ${classeBarra}" style="width: ${larguraBarra}%;"></div></div><span class="progress-text" title="Baseado nos dias trabalhados">${porcentagemStr}</span></div>
        `;
        divLista.appendChild(linha);
    });
};

window.obterRankElo = function(percentual) {
    if (percentual >= 100) return { nome: 'Radiante', classe: 'elo-radiante' };
    if (percentual >= 80)  return { nome: 'Diamante', classe: 'elo-diamante' };
    return { nome: 'Bronze', classe: 'elo-bronze' };
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
        // ✅ Usando a função importada dataEstaNoMes()
        if (dataEstaNoMes(dataStr, mesFiltro)) {
            for (const [mot, dados] of Object.entries(dadosDia)) {
                if (acumuladoMes[mot]) {
                    const statusMot = (dados.status || 'normal').toLowerCase();
                    if (statusMot === 'normal') {
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

    if (document.getElementById('totalViagensMesGlobal'))   document.getElementById('totalViagensMesGlobal').innerText = `${totalViagensFrota} vg`;
    // ✅ Usando a função importada formatarMoeda()
    if (document.getElementById('totalFatMensalLeaderboard')) document.getElementById('totalFatMensalLeaderboard').innerText = formatarMoeda(totalFatMesFrota);

    function renderizarMeta(feitas, meta, elValor, elFalta) {
        // ✅ Usando as funções importadas
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
        // ✅ Usando as funções importadas
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

// =============================================================
// PAINEL DOMINGOS E FERIADOS
// =============================================================
window.gerarPainelFeriados = function() {
    const domInicio = document.getElementById('dataDomInicio')?.value;
    const domFim    = document.getElementById('dataDomFim')?.value;
    const ferInicio = document.getElementById('dataFerInicio')?.value;
    const ferFim    = document.getElementById('dataFerFim')?.value;
    const bancoDados = window.bancoDadosCloud;
    let registrosDom = [], registrosFer = [];
    let fatTotalDom = 0, fatTotalFer = 0;

    for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
        const dataObj = new Date(dataStr + 'T00:00:00');
        const isDomingo = dataObj.getDay() === 0;
        for (const [mot, dados] of Object.entries(dadosDia)) {
            if (!(dados.servicos > 0) && (!dados.status || dados.status === 'normal')) continue;
            const obj = { dataStr, nome: mot, caixas: dados.tipoVeiculo !== 'cacamba' ? dados.servicos : 0, viagens: dados.tipoVeiculo === 'cacamba' ? dados.servicos : 0, valor: dados.valor, status: dados.status };
            // ✅ Usando a função importada dataEstaNoIntervalo()
            if (isDomingo && !dados.isFeriado) {
                if (!domInicio || !domFim || dataEstaNoIntervalo(dataStr, domInicio, domFim)) { registrosDom.push(obj); fatTotalDom += dados.valor; }
            }
            if (dados.isFeriado) {
                if (!ferInicio || !ferFim || dataEstaNoIntervalo(dataStr, ferInicio, ferFim)) { registrosFer.push(obj); fatTotalFer += dados.valor; }
            }
        }
    }

    // ✅ Usando as funções importadas
    if (document.getElementById('totalFatDom'))      document.getElementById('totalFatDom').innerText = formatarMoeda(fatTotalDom);
    if (document.getElementById('totalFatFer'))      document.getElementById('totalFatFer').innerText = formatarMoeda(fatTotalFer);
    if (document.getElementById('totalGeralDomFer')) document.getElementById('totalGeralDomFer').innerText = formatarMoeda(fatTotalDom + fatTotalFer);

    function renderizarLista(listaRegistros, idElemento, msgVazia) {
        listaRegistros.sort((a, b) => new Date(b.dataStr) - new Date(a.dataStr) || b.valor - a.valor);
        const divLista = document.getElementById(idElemento);
        if (!divLista) return;
        divLista.innerHTML = '';
        if (listaRegistros.length === 0) { divLista.innerHTML = `<div class="text-center text-slate-400 py-8 font-medium">${msgVazia}</div>`; return; }

        listaRegistros.forEach(mot => {
            let textoQtd = '';
            if (mot.status && mot.status !== 'normal') textoQtd = `<span class="bg-red-500 text-white px-2 py-0.5 rounded text-[10px] uppercase font-bold">${mot.status}</span>`;
            else textoQtd = formatarQuantidadeMista(mot.caixas, mot.viagens, window.motOutros.includes(mot.nome));

            const linha = document.createElement('div');
            linha.className = 'diario-row';
            linha.innerHTML = `<div class="diario-top" style="margin:0;"><span class="diario-nome" style="display:flex; align-items:center; gap:8px;"><span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-black">${formatarDataParaExibicao(mot.dataStr)}</span>${mot.nome} <span class="text-blue-500">(${textoQtd})</span></span><span class="diario-faturamento text-red-500">${formatarMoeda(mot.valor)}</span></div>`;
            divLista.appendChild(linha);
        });
    }

    renderizarLista(registrosDom, 'listaDomingos', 'Nenhum serviço em domingos no período selecionado. 😴');
    renderizarLista(registrosFer, 'listaFeriados', 'Nenhum serviço em feriados no período selecionado. 😴');
};

// =============================================================
// GRÁFICOS DE PROJEÇÃO
// =============================================================
window.atualizarGraficosProjecao = function() {
    const bancoDados = window.bancoDadosCloud;
    const inicio = document.getElementById('dataProjInicio')?.value;
    const fim    = document.getElementById('dataProjFim')?.value;
    const filtroTurno = document.getElementById('filtroProjTurno')?.value || 'todos';
    if (!inicio || !fim) return;

    const dIni = new Date(inicio + 'T00:00:00');
    const dFim = new Date(fim + 'T00:00:00');
    dIni.setMonth(dIni.getMonth() - 1); dFim.setMonth(dFim.getMonth() - 1);
    // ✅ Usando a função importada
    const inicioPassadoStr = formatarDataParaBusca(dIni);
    const fimPassadoStr    = formatarDataParaBusca(dFim);

    let dadosEvolucaoInd = [], mapGeral = {}, stats = { atual: 0, passado: 0 };
    let diasTrabalhadosInd = 0, diasMetaBatidaInd = 0, somaServicosFisicosReal = 0;
    let maxServicosDiarios = 0, dataRecordeFisico = '';
    let somaPontosDiaDaSemana = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const nomesDias = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };

    if (document.getElementById('projecaoNomeMotorista')) document.getElementById('projecaoNomeMotorista').innerText = window.motoristaSelecionado || 'Ninguém Selecionado';

    for (const [data, motoristasDia] of Object.entries(bancoDados)) {
        // ✅ Usando a função importada dataEstaNoIntervalo()
        const isPeriodoAtual   = dataEstaNoIntervalo(data, inicio, fim);
        const isPeriodoPassado = dataEstaNoIntervalo(data, inicioPassadoStr, fimPassadoStr);
        const dataObj = new Date(data + 'T00:00:00');
        const diaDaSemana = dataObj.getDay();
        let pontosDiaGeral = 0;

        for (const [mot, dados] of Object.entries(motoristasDia)) {
            const statusN = (!dados.status || dados.status === 'normal');
            const pts = (dados.pontos !== undefined) ? dados.pontos : window.calcularPontosMotorista(mot, (dados.servicos || 0), dados.tipoVeiculo);
            const qtdReal = statusN ? (dados.servicos || 0) : 0;

            if (mot === window.motoristaSelecionado) {
                if (isPeriodoAtual && statusN) {
                    stats.atual += pts;
                    somaServicosFisicosReal += qtdReal;
                    if (qtdReal > maxServicosDiarios) { maxServicosDiarios = qtdReal; dataRecordeFisico = data; }
                    if (diaDaSemana !== 0 && diaDaSemana !== 6 && !dados.isFeriado) {
                        diasTrabalhadosInd++;
                        if (pts >= window.getMetaDiaria(mot)) diasMetaBatidaInd++;
                    }
                    dadosEvolucaoInd.push({ dataStr: data, pontos: pts });
                }
                if (isPeriodoPassado && statusN) stats.passado += pts;
            }

            const incluirNoGeral = filtroTurno === 'todos'
                || (filtroTurno === 'dia'      && window.motRayanna.includes(mot))
                || (filtroTurno === 'noite'    && window.motJulia.includes(mot))
                || (filtroTurno === 'especial' && window.motOutros.includes(mot));

            if (isPeriodoAtual && incluirNoGeral && statusN) {
                pontosDiaGeral += pts;
                somaPontosDiaDaSemana[diaDaSemana] += pts;
            }
        }
        if (isPeriodoAtual) mapGeral[data] = pontosDiaGeral;
    }

    const txtSufixo = window.motOutros.includes(window.motoristaSelecionado) ? ' vg' : ' cx';

    if (document.getElementById('statMesAtual'))  document.getElementById('statMesAtual').innerText = Math.round(stats.atual) + txtSufixo;
    if (document.getElementById('statMesPassado')) document.getElementById('statMesPassado').innerText = Math.round(stats.passado) + txtSufixo;

    const elCrescimento = document.getElementById('statCrescimento');
    if (elCrescimento) {
        if (!window.motoristaSelecionado) {
            elCrescimento.innerHTML = `<span class="text-slate-500 bg-slate-100 px-3 py-1 rounded-xl text-sm font-bold">Selecione na lista</span>`;
        } else {
            const diff = Math.round(stats.atual - stats.passado);
            if (diff > 0)      elCrescimento.innerHTML = `<span class="text-emerald-600 bg-emerald-100 px-3 py-1 rounded-xl text-sm font-bold">+${diff}${txtSufixo}</span><span class="text-xs text-slate-500 font-medium">vs Per. Anterior</span>`;
            else if (diff < 0) elCrescimento.innerHTML = `<span class="text-red-600 bg-red-100 px-3 py-1 rounded-xl text-sm font-bold">-${Math.abs(diff)}${txtSufixo}</span><span class="text-xs text-slate-500 font-medium">vs Per. Anterior</span>`;
            else               elCrescimento.innerHTML = `<span class="text-slate-600 bg-slate-100 px-3 py-1 rounded-xl text-sm font-bold">Empatado</span><span class="text-xs text-slate-500 font-medium">vs Per. Anterior</span>`;
        }
    }

    const winRate = diasTrabalhadosInd > 0 ? Math.round((diasMetaBatidaInd / diasTrabalhadosInd) * 100) : 0;
    if (document.getElementById('statWinRate')) {
        document.getElementById('statWinRate').innerText = `${winRate}%`;
        document.getElementById('statWinRateSub').innerText = `${diasMetaBatidaInd} metas batidas em ${diasTrabalhadosInd} dias úteis`;
    }

    const mediaReal = diasTrabalhadosInd > 0 ? (somaServicosFisicosReal / diasTrabalhadosInd).toFixed(1) : '0.0';
    const metaDiariaFixa = window.motoristaSelecionado ? window.getMetaDiaria(window.motoristaSelecionado) : 0;
    if (document.getElementById('statMediaReal')) {
        document.getElementById('statMediaReal').innerText = `${mediaReal} ${txtSufixo}/dia`;
        const metaVisual = window.motOutros.includes(window.motoristaSelecionado) ? (metaDiariaFixa / 2) + ' vg' : metaDiariaFixa + ' cx';
        document.getElementById('statMediaNec').innerText = `SLA pede: ${metaVisual} /dia`;
    }

    if (document.getElementById('statRecorde')) {
        document.getElementById('statRecorde').innerText = `${maxServicosDiarios} ${txtSufixo}`;
        // ✅ Usando a função importada formatarDataParaExibicao()
        document.getElementById('statRecordeData').innerText = dataRecordeFisico ? `Dia ${formatarDataParaExibicao(dataRecordeFisico)}` : 'Sem registros';
    }

    const melhorDiaChave = Object.keys(somaPontosDiaDaSemana).reduce((a, b) => somaPontosDiaDaSemana[a] > somaPontosDiaDaSemana[b] ? a : b);
    const ptsMelhorDia = somaPontosDiaDaSemana[melhorDiaChave];
    if (document.getElementById('statMelhorDia')) {
        if (ptsMelhorDia > 0 && nomesDias[melhorDiaChave]) {
            document.getElementById('statMelhorDia').innerText = nomesDias[melhorDiaChave];
            document.getElementById('statMelhorDiaPts').innerText = `${Math.round(ptsMelhorDia)} pts acumulados`;
        } else {
            document.getElementById('statMelhorDia').innerText = 'N/A';
            document.getElementById('statMelhorDiaPts').innerText = 'Sem dados';
        }
    }

    dadosEvolucaoInd.sort((a, b) => new Date(a.dataStr) - new Date(b.dataStr));
    // ✅ Usando a função importada formatarDataParaExibicao()
    const labelsInd  = dadosEvolucaoInd.map(d => formatarDataParaExibicao(d.dataStr).substring(0, 5));
    const dataInd    = dadosEvolucaoInd.map(d => d.pontos);
    const arrayGeral = Object.keys(mapGeral).map(k => ({ dataStr: k, pontos: mapGeral[k] })).sort((a, b) => new Date(a.dataStr) - new Date(b.dataStr));
    const labelsGeral = arrayGeral.map(d => formatarDataParaExibicao(d.dataStr).substring(0, 5));
    const dataGeral   = arrayGeral.map(d => d.pontos);

    Chart.defaults.font.family = "'Inter', sans-serif";

    const ctxInd = document.getElementById('chartEvolucaoIndividual');
    if (ctxInd) {
        if (window.chartInstanciaInd) window.chartInstanciaInd.destroy();
        window.chartInstanciaInd = new Chart(ctxInd.getContext('2d'), {
            type: 'line',
            data: { labels: labelsInd, datasets: [{ label: 'Volume', data: dataInd, borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderWidth: 3, pointBackgroundColor: '#fff', pointBorderColor: '#2563eb', fill: true, tension: 0.3 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } },
        });
    }

    const ctxGeral = document.getElementById('chartEvolucaoGeral');
    if (ctxGeral) {
        if (window.chartInstanciaGeral) window.chartInstanciaGeral.destroy();
        window.chartInstanciaGeral = new Chart(ctxGeral.getContext('2d'), {
            type: 'line',
            data: { labels: labelsGeral, datasets: [{ label: 'Frota', data: dataGeral, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 3, pointBackgroundColor: '#fff', pointBorderColor: '#10b981', fill: true, tension: 0.3 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } },
        });
    }
};

// =============================================================
// AUDITORIA
// =============================================================
window.carregarAuditoriaLancamentos = async function() {
    const tbody = document.querySelector('#tabelaAuditoria tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-slate-400 font-medium py-8">Carregando auditoria...</td></tr>';

    const { data, error } = await supabase
        .from('lancamentos_historico')
        .select('*')
        .order('criado_em', { ascending: false })
        .limit(100);

    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 font-bold py-8">Erro ao carregar auditoria: ${error.message}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-slate-400 font-medium py-8">Nenhum histórico encontrado.</td></tr>';
        return;
    }

    const acaoLabel = {
        criar: 'Criou',
        editar: 'Editou',
        excluir: 'Excluiu',
        excluir_mes_motorista: 'Apagou mês',
        excluir_tudo: 'Apagou tudo',
        importar_ia: 'Importou IA',
    };

    function formatarDataHora(valor) {
        if (!valor) return '-';
        return new Date(valor).toLocaleString('pt-BR');
    }

    function resumoMudanca(item) {
        const antes = item.dados_antes || {};
        const depois = item.dados_depois || {};

        if (item.acao === 'criar') {
            return `Qtd: ${depois.quantidade_servicos ?? '-'} | Valor: ${formatarMoeda(Number(depois.valor_faturamento || 0))}`;
        }

        if (item.acao === 'editar') {
            const partes = [];

            if (antes.quantidade_servicos !== depois.quantidade_servicos) {
                partes.push(`Qtd: ${antes.quantidade_servicos ?? '-'} → ${depois.quantidade_servicos ?? '-'}`);
            }

            if (Number(antes.valor_faturamento || 0) !== Number(depois.valor_faturamento || 0)) {
                partes.push(`Valor: ${formatarMoeda(Number(antes.valor_faturamento || 0))} → ${formatarMoeda(Number(depois.valor_faturamento || 0))}`);
            }

            if ((antes.status_servico || '') !== (depois.status_servico || '')) {
                partes.push(`Status: ${antes.status_servico || '-'} → ${depois.status_servico || '-'}`);
            }

            return partes.length ? partes.join(' | ') : 'Alterou dados do lançamento';
        }

        if (item.acao === 'excluir') {
            return `Excluiu qtd ${antes.quantidade_servicos ?? '-'} no valor ${formatarMoeda(Number(antes.valor_faturamento || 0))}`;
        }

        return item.observacao || '-';
    }

    tbody.innerHTML = '';

    data.forEach(item => {
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td class="text-slate-700 font-bold">${formatarDataHora(item.criado_em)}</td>
            <td class="font-black">${acaoLabel[item.acao] || item.acao}</td>
            <td class="text-xs text-slate-600">${item.usuario_email || '-'}</td>
            <td class="font-bold">${item.motorista_nome || '-'}</td>
            <td>${item.data_servico ? formatarDataParaExibicao(item.data_servico) : '-'}</td>
            <td class="text-xs text-slate-500">${resumoMudanca(item)}</td>
        `;

        tbody.appendChild(tr);
    });

    lucide.createIcons();
};



// =============================================================
// RESTAURAÇÃO DE BACKUP
// =============================================================
window.processarRestauracaoBackup = function(event) {
    const arquivo = event.target.files[0];
    if (!arquivo) return;
    alert('Atenção: A função de restaurar backup via arquivo está temporariamente desativada no modo SQL para evitar corrupção de dados.');
    document.getElementById('inputRestaurarBackup').value = '';
};
