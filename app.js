// =============================================================
// IMPORTS
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
// =============================================================
window.formatarDataParaBusca = formatarDataParaBusca;
window.formatarDataParaExibicao = formatarDataParaExibicao;

window.formatarCpf = function(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 11);
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  input.value = v;
};

window.formatarTelefone = function(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 11);
  v = v.replace(/^(\d{2})(\d)/, '($1) $2');
  v = v.replace(/(\d{5})(\d)/, '$1-$2');
  input.value = v;
};
// =============================================================
// CONEXÃO COM SUPABASE
// =============================================================
const supabase = window.supabaseClient;

// =============================================================
// ESTADO GLOBAL
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
// INICIALIZAÇÃO DE DATAS
// =============================================================
const hojeStr = getHojeStr();
const anoMesAtual = getAnoMesAtual();
const startStr = primeiroDiaDoMes(anoMesAtual);

const _setInputVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
};

_setInputVal('dataGlobal',        anoMesAtual);
_setInputVal('dataLancamento',    hojeStr);
_setInputVal('dataRankingInicio', hojeStr);
_setInputVal('dataRankingFim',    hojeStr);
_setInputVal('mesFiltro',         anoMesAtual);
_setInputVal('dataDomInicio',     startStr);
_setInputVal('dataDomFim',        hojeStr);
_setInputVal('dataFerInicio',     startStr);
_setInputVal('dataFerFim',        hojeStr);
_setInputVal('dataProjInicio',    startStr);
_setInputVal('dataProjFim',       hojeStr);
_setInputVal('dataRotaDia',       hojeStr);

// =============================================================
// ALIASES DE NEGÓCIO
// =============================================================
window.calcularPontosMotorista = calcularPontos;
window.getMetaDiaria = getMetaDiaria;

// =============================================================
// RESTRIÇÕES DE INTERFACE — definidas antes de carregar dados
// =============================================================
window.aplicarRestricoesInterface = function () {
    const funcao = window.usuarioAtualFuncao || 'operador';

    // Mapa de abas: chave = nome da aba, valor = id do botão no sidebar
    const todasAbas = {
        lancamentos: 'btnTabLancamentos',
        rankings:    'btnTabRankings',
        domferiados: 'btnTabDomFeriados',
        projecao:    'btnTabProjecao',
        auditoria:   'btnTabAuditoria',
        rotas:       'btnTabRotas',
        cadastro:    'btnTabCadastro',
        operador:    'btnTabOperador',
        faltas:      'btnTabFaltas',
    };

    // Abas permitidas por função
    const permissoes = {
        admin: Object.keys(todasAbas), // todas
        operador: ['rankings', 'projecao', 'rotas'],
        rh: ['cadastro', 'operador', 'faltas', 'domferiados', 'rankings'],
    };

    const abasPermitidas = permissoes[funcao] || permissoes['operador'];

    // Oculta as abas não permitidas
    Object.entries(todasAbas).forEach(([aba, btnId]) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.style.display = abasPermitidas.includes(aba) ? '' : 'none';
        }
    });

    // Esconde o botão Sistema/Backup para não-admins
    const btnSistema = document.querySelector('.btn-sistema[onclick="window.abrirModalSistema()"]');
    if (btnSistema) {
        btnSistema.style.display = funcao === 'admin' ? '' : 'none';
    }

    // Define qual aba abrir por padrão conforme a função
    const abaInicial = {
        admin:    'lancamentos',
        operador: 'rotas',
        rh:       'cadastro',
    };

    console.log(`🔐 Perfil "${funcao}" ativado. Abas liberadas: ${abasPermitidas.join(', ')}`);
    window.mudarAba(abaInicial[funcao] || abasPermitidas[0]);

    if (funcao === 'admin') {
        console.log('🔓 Modo Admin ativado. Acesso total.');
    }
};

// =============================================================
// O CÉREBRO: CARREGA TUDO DO SUPABASE
// =============================================================
async function carregarDadosDoSupabase() {
    try {
        window.motoristas = [];
        window.motRayanna = [];
        window.motJulia   = [];
        window.motOutros  = [];
        window.motoristasInativos = [];

        // 1. Lançamentos
        const { data: lancs, error: erroLancs } = await supabase
            .from('lancamentos')
            .select('*')
            .is('cancelado_em', null);

        if (erroLancs) throw erroLancs;
        const { data: mots, error: erroMots } = await supabase
        .from('motoristas')
        .select('*');

        if (erroMots) throw erroMots;

        window.bancoDadosCloud = {};

        if (lancs) {
            lancs.forEach(l => {
                if (!window.bancoDadosCloud[l.data]) {
                    window.bancoDadosCloud[l.data] = {};
                }
                window.bancoDadosCloud[l.data][l.motorista_nome.toUpperCase().trim()] = {
                    anexoNome: l.anexo_nome,
                    anexoUrl: l.anexo_url,
                    anexoPath: l.anexo_path,
                    anexoTipo: l.anexo_tipo,
                    servicos: l.quantidade_servicos,
                    caixasBrutas:  l.caixas_brutas  ?? (l.tipo_veiculo === 'cacamba' ? 0 : l.quantidade_servicos),   // ← ADICIONAR
                    viagensBrutas: l.viagens_brutas ?? (l.tipo_veiculo === 'cacamba' ? l.quantidade_servicos : 0),   // ← ADICIONAR
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
        window.motoristasInativos = []; // lista dos inativos
        if (mots) {
          mots.forEach(m => {
        const nomeNorm = m.nome.toUpperCase().trim();
if (m.status === 'inativo') {
    window.motoristasInativos.push(nomeNorm);
    return;
}
window.motoristas.push(nomeNorm);
if (m.turno === 'dia')        window.motRayanna.push(nomeNorm);
else if (m.turno === 'noite') window.motJulia.push(nomeNorm);
else                          window.motOutros.push(nomeNorm);
    });
}
        window.motoristas.sort();

        // 3. Dias Úteis
        const { data: configs } = await supabase.from('config_meses').select('*');
        window.configMesesCloud = {};
        if (configs) configs.forEach(c => { window.configMesesCloud[c.ano_mes] = c.dias_uteis_sla; });

        // 4. SLAs individuais
        const { data: slas } = await supabase.from('config_slas').select('*');
        window.configSlaCloud = {};
        if (slas) slas.forEach(s => { window.configSlaCloud[s.chave] = parseFloat(s.valor); });

        // 5. Visibilidade do Mês
        const { data: visib } = await supabase.from('visibilidade_mes').select('*');
        window.visibilidadeCloud = {};
        if (visib) {
            visib.forEach(v => {
                const firstUnder = v.chave.indexOf('_');
                const mesKey = v.chave.substring(0, firstUnder);
                const nomKey = v.chave.substring(firstUnder + 1);
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

       // ✅ REGRAS DE PERMISSÃO — chamada uma única vez aqui
        window.aplicarRestricoesInterface();

        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => { loader.style.display = 'none'; }, 500);
        }
    } catch (error) {
        console.error('ERRO AO CARREGAR:', error);
        alert('Erro ao carregar dados: ' + error.message);
        
        const loader = document.getElementById('loader');
        if (loader) { 
            loader.style.opacity = '0';
            setTimeout(() => { loader.style.display = 'none'; }, 500);
        }
    }
}

window.carregarDadosDoSupabase = carregarDadosDoSupabase;
window.carregarDadosDoSupabase();

// =============================================================
// GRAVAÇÃO DE LANÇAMENTOS
// =============================================================
window.syncToSupabase = async function (dataStr, motoristaNome) {
    const lanc = window.bancoDadosCloud[dataStr]?.[motoristaNome];
    if (!lanc) return;

    const dadosParaSalvar = {
    anexo_nome:           lanc.anexoNome    || null,
    anexo_url:            lanc.anexoUrl     || null,
    anexo_path:           lanc.anexoPath    || null,
    anexo_tipo:           lanc.anexoTipo    || null,
    data:                 dataStr,
    motorista_nome:       motoristaNome,
    status_servico:       lanc.status,
    tipo_veiculo:         lanc.tipoVeiculo,
    quantidade_servicos:  lanc.servicos,
    caixas_brutas:        lanc.caixasBrutas  ?? 0,  
    viagens_brutas:       lanc.viagensBrutas ?? 0, 
    valor_faturamento:    lanc.valor,
    valor_extra:          lanc.valorExtra,
    is_feriado:           lanc.isFeriado,
    ganhou_bonus_semana:  lanc.ganhouBonusSemana,
    observacao:           lanc.observacao,
    cancelado_em:         null,
    cancelado_por:        null,
    cancelado_por_email:  null,
    motivo_cancelamento:  null,
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
window.abrirModalSistema = function () {
    const modal = document.getElementById('modalSistema');
    if (!modal) { alert('Modal de sistema não encontrado no HTML.'); return; }
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    lucide.createIcons();
};

window.fecharModalSistema = function () {
    const modal = document.getElementById('modalSistema');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.style.display = 'none';
    const codigoIA = document.getElementById('codigoIA');
    if (codigoIA) codigoIA.value = '';
};

window.gerarBackup = function () {
    const dadosStr = JSON.stringify(window.bancoDadosCloud, null, 2);
    const blob = new Blob([dadosStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_sgc_${getHojeStr()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('Backup gerado com sucesso! Guarde o arquivo .json em um local seguro.');
};

window.apagarTudo = async function () {
    alert('Exclusão total desativada por segurança.');
};

window.importarDadosIA = async function () {
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

    const upsertArray = [];

    dados.forEach(lanc => {
        const dataStr = lanc.data;
        const mot = lanc.motorista.toUpperCase().trim();
        if (!window.motoristas.includes(mot)) return;

        let statusFinal    = (lanc.status || 'normal').toLowerCase();
        let servicosFinais = parseInt(lanc.qtd);
        if (isNaN(servicosFinais)) servicosFinais = 0;

        const isFeriadoFinal   = lanc.isFeriado === true;
        const tipoVeiculoFinal = lanc.veiculo || (window.motOutros.includes(mot) ? 'cacamba' : 'poliguindaste');
        let valorExtraFinal    = parseFloat(lanc.extra) || 0;
        const observacaoFinal  = lanc.observacao || '';

        if (statusFinal !== 'normal') { servicosFinais = 0; valorExtraFinal = 0; }

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

        upsertArray.push({
            data:                 dataStr,
            motorista_nome:       mot,
            status_servico:       statusFinal,
            tipo_veiculo:         tipoVeiculoFinal,
            quantidade_servicos:  servicosFinais,
            valor_faturamento:    valorBase + valorExtraFinal,
            valor_extra:          valorExtraFinal,
            is_feriado:           isFeriadoFinal,
            ganhou_bonus_semana:  bateuMetaSemana,
            observacao:           observacaoFinal,
        });
    });

    if (upsertArray.length > 0) {
        const { error } = await supabase
            .from('lancamentos')
            .upsert(upsertArray, { onConflict: 'data,motorista_nome' });

        if (error) {
            alert('Erro ao importar: ' + error.message);
            if (loader) { loader.style.opacity = '0'; setTimeout(() => { loader.style.display = 'none'; }, 300); }
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
window.gerenciarMotoristas = function () { window.abrirModalGerenciar(); };

window.abrirModalGerenciar = function () {
    const modal    = document.getElementById('modalGerenciar');
    const selOcultar = document.getElementById('ocultarMotNome');
    const selMostrar = document.getElementById('mostrarMotNome');
    const elMes    = document.getElementById('dataGlobal');
    const mesAtualFiltro = elMes?.value ? elMes.value.substring(0, 7) : getAnoMesAtual();

    const lblMes = document.getElementById('lblMesGerenciar');
    if (lblMes) lblMes.innerText = mesAtualFiltro;

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

window.fecharModalGerenciar = function () {
    document.getElementById('modalGerenciar').classList.add('hidden');
    document.getElementById('novoMotNome').value = '';
};

window.addMotoristaModal = async function () {
    const nome  = document.getElementById('novoMotNome').value.toUpperCase().trim();
    const turno = document.getElementById('novoMotTurno').value;
    const elMes = document.getElementById('dataGlobal');
    const mesAtualFiltro = elMes?.value ? elMes.value.substring(0, 7) : getAnoMesAtual();

    if (!nome) { alert('Informe o nome do motorista.'); return; }

    const { error: erroMotorista } = await supabase
        .from('motoristas')
       .upsert({ nome, turno, status: 'ativo' }, { onConflict: 'nome' });

    if (erroMotorista) { alert('Erro ao cadastrar motorista: ' + erroMotorista.message); return; }

    const { error: erroVisibilidade } = await supabase
        .from('visibilidade_mes')
        .upsert({ chave: `${mesAtualFiltro}_${nome}`, status: 'show' }, { onConflict: 'chave' });

    if (erroVisibilidade) { alert('Motorista cadastrado, mas erro ao adicionar no mês: ' + erroVisibilidade.message); return; }

    await window.carregarDadosDoSupabase();
    document.getElementById('novoMotNome').value = '';
    window.fecharModalGerenciar();
    alert('Motorista cadastrado com sucesso!');
};

window.ocultarMotoristaMes = async function () {
    const nome = document.getElementById('ocultarMotNome').value;
    const elMes = document.getElementById('dataGlobal');
    const mesAtualFiltro = elMes?.value ? elMes.value.substring(0, 7) : getAnoMesAtual();
    if (!nome) return;
    await supabase.from('visibilidade_mes').upsert({ chave: `${mesAtualFiltro}_${nome}`, status: 'hide' }, { onConflict: 'chave' });
    await window.carregarDadosDoSupabase();
    window.fecharModalGerenciar();
};

window.mostrarMotoristaMes = async function () {
    const nome = document.getElementById('mostrarMotNome').value;
    const elMes = document.getElementById('dataGlobal');
    const mesAtualFiltro = elMes?.value ? elMes.value.substring(0, 7) : getAnoMesAtual();
    if (!nome) return;
    await supabase.from('visibilidade_mes').upsert({ chave: `${mesAtualFiltro}_${nome}`, status: 'show' }, { onConflict: 'chave' });
    await window.carregarDadosDoSupabase();
    window.fecharModalGerenciar();
};

window.apagarMotoristaDefinitivo = async function () {
    let nome = prompt('⚠️ ZONA DE PERIGO: Para APAGAR um motorista definitivamente do painel, digite o NOME EXATO dele abaixo:');
    if (!nome) return;
    nome = nome.toUpperCase().trim();

    if (confirm(`Tem certeza absoluta que deseja EXCLUIR "${nome}"? Ele sumirá dos rankings e das listas.`)) {
        await supabase.from('motoristas').update({ status: 'inativo' }).eq('nome', nome);
        await window.carregarDadosDoSupabase();
        window.fecharModalGerenciar();
        alert(`🗑️ Motorista ${nome} apagado com sucesso!`);
        if (window.motoristaSelecionado === nome) location.reload();
    }
};

// =============================================================
// SIDEBAR E LISTAS
// =============================================================
window.reconstruirListasMotoristas = function () {
    window.renderizarSidebar();
    const selProjMot = document.getElementById('filtroProjMot');
    if (selProjMot) {
        const selecionadoAntes = selProjMot.value;
        selProjMot.innerHTML = '<option value="">Selecione...</option>';
        window.motoristas.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            selProjMot.appendChild(opt);
        });
        if (window.motoristas.includes(selecionadoAntes)) selProjMot.value = selecionadoAntes;
    }
};

window.motoristaTemLancamentoNoMes = function (nome, mes) {
    for (const data in window.bancoDadosCloud) {
        if (dataEstaNoMes(data, mes) && window.bancoDadosCloud[data][nome]) return true;
    }
    return false;
};



window._turnoIndex = 0;
window._turnosCiclo = [
    { value: 'todos',    label: 'Todos',    icone: '👥', bg: '#f1f5f9', border: '#e2e8f0', color: '#475569' },
    { value: 'dia',      label: 'Dia',      icone: '☀️', bg: '#fef9c3', border: '#fde047', color: '#854d0e' },
    { value: 'noite',    label: 'Noite',    icone: '🌙', bg: '#ede9fe', border: '#a78bfa', color: '#5b21b6' },
    { value: 'especial', label: 'Especial', icone: '🚛', bg: '#dcfce7', border: '#86efac', color: '#166534' },
];

window.ciclartarTurno = function () {
    window._turnoIndex = (window._turnoIndex + 1) % window._turnosCiclo.length;
    const t = window._turnosCiclo[window._turnoIndex];

    const input   = document.getElementById('filtroTurno');
    const toggle  = document.getElementById('filtroTurnoToggle');
    const icone   = document.getElementById('filtroTurnoIcone');
    const label   = document.getElementById('filtroTurnoLabel');

    if (input)  input.value = t.value;
    if (label)  label.textContent = t.label;
    if (toggle) {
        toggle.style.background  = t.bg;
        toggle.style.borderColor = t.border;
        toggle.style.color       = t.color;
    }
    if (icone) {
        icone.style.transform = 'rotate(360deg) scale(1.3)';
        setTimeout(() => { icone.textContent = t.icone; icone.style.transform = 'rotate(0deg) scale(1)'; }, 200);
    }

    window.renderizarSidebar();
};

window.renderizarSidebar = function () {
    const ul = document.getElementById('listaMotoristas');
    const selectFiltro = document.getElementById('filtroTurno');
    if (!ul) return;

    ul.innerHTML = '';
    const filtroVal = selectFiltro ? selectFiltro.value : 'todos';
    const elMes = document.getElementById('dataGlobal');
    const mesAtualFiltro = elMes?.value ? elMes.value.substring(0, 7) : anoMesAtual;
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
                .filter(d => dataEstaNoMes(d, mesAtualFiltro) && window.bancoDadosCloud[d][mot])
                .sort();

            const ultimoDia = diasComLancamento[diasComLancamento.length - 1];
            const isDesligadoNesteMes = ultimoDia
                ? window.bancoDadosCloud[ultimoDia][mot].status === 'desligado'
                : false;

            // Acha o mês mais recente em que esse motorista teve status desligado
            const mesDesligamento = Object.keys(window.bancoDadosCloud)
                .filter(d => window.bancoDadosCloud[d][mot]?.status === 'desligado')
                .map(d => d.substring(0, 7))
                .sort()
                .pop();
            // Se foi desligado em mês anterior ao exibido, não renderiza
            if (mesDesligamento && mesDesligamento < mesAtualFiltro) return;

            if (isDesligadoNesteMes) {
                li.innerHTML = `<span class="text-red-500 w-full block font-black leading-tight">${mot} <span class="text-[9px] opacity-90 ml-1 bg-red-100 text-red-700 px-1 rounded border border-red-200">(Deslig. no Mês)</span></span>`;
            } else {
                li.textContent = mot;
            }

            li.onclick = () => window.selecionarMotorista(mot, li);
            ul.appendChild(li);
        });
    }

    if (filtroVal === 'todos' || filtroVal === 'dia')      criarGrupo('Dia (Rayanna)',      window.motRayanna, '☀️');
    if (filtroVal === 'todos' || filtroVal === 'noite')    criarGrupo('Noite (Júlia)',      window.motJulia,   '🌙');
    if (filtroVal === 'todos' || filtroVal === 'especial') criarGrupo('Especial (Caçamba)', window.motOutros,  '🚛');

    lucide.createIcons();
};

window.toggleTravaGlobais = function () {
    window.diasUteisTravado = !window.diasUteisTravado;
    const inLanc = document.getElementById('inputDiasUteisLanc');
    const inRank = document.getElementById('inputDiasUteisRank');
    const btnLanc = document.getElementById('btnTravaLanc');
    const btnRank = document.getElementById('btnTravaRank');
    if (!inLanc || !inRank) return;

    if (window.diasUteisTravado) {
        inLanc.setAttribute('readonly', 'true');
        inRank.setAttribute('readonly', 'true');
        if (btnLanc) btnLanc.innerHTML = '<i data-lucide="lock" class="w-5 h-5"></i>';
        if (btnRank) btnRank.innerHTML = '<i data-lucide="lock" class="w-5 h-5"></i>';
    } else {
        inLanc.removeAttribute('readonly');
        inRank.removeAttribute('readonly');
        if (btnLanc) btnLanc.innerHTML = '<i data-lucide="unlock" class="w-5 h-5"></i>';
        if (btnRank) btnRank.innerHTML = '<i data-lucide="unlock" class="w-5 h-5"></i>';
        const viewLanc = document.getElementById('viewLancamentos');
        if (viewLanc && viewLanc.style.display !== 'none') inLanc.focus();
        else inRank.focus();
    }
    lucide.createIcons();
};

window.carregarDiasUteis = function (anoMesStr) {
    const dias = window.configMesesCloud[anoMesStr] || 22;
    _setInputVal('inputDiasUteisLanc', dias);
    _setInputVal('inputDiasUteisRank', dias);
    return dias;
};

window.salvarDiasUteis = async function (origem) {
    const elId = origem === 'lanc' ? 'inputDiasUteisLanc' : 'inputDiasUteisRank';
    const dias = parseInt(document.getElementById(elId)?.value) || 22;
    if (dias < 1 || dias > 31) return;

    const elGlobal = document.getElementById('dataGlobal');
    const elFiltro = document.getElementById('mesFiltro');
    const mesRef = elGlobal?.value || elFiltro?.value;
    if (!mesRef) return;

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

window.calcularSlaMotorista = function (mot, mesFiltro) {
    const visibMes = window.visibilidadeCloud[mesFiltro] || {};
    if (visibMes[mot] === 'hide') return 0;
    if (window.configSlaCloud[mot + '_' + mesFiltro] !== undefined) {
        return window.configSlaCloud[mot + '_' + mesFiltro];
    }
    return window.carregarDiasUteis(mesFiltro);
};

window.toggleTravaSla = async function () {
    if (!window.motoristaSelecionado) { alert('Selecione um motorista primeiro!'); return; }
    const inSla = document.getElementById('inputSlaMotorista');
    const elMes = document.getElementById('dataGlobal');
    if (!inSla) return;
    const mesFiltroStr = elMes?.value ? elMes.value.substring(0, 7) : getAnoMesAtual();
    const chaveComMes  = window.motoristaSelecionado + '_' + mesFiltroStr;

    if (inSla.hasAttribute('readonly')) {
        await supabase.from('config_slas').delete().eq('chave', chaveComMes);
        await window.carregarDadosDoSupabase();
    } else {
        await window.salvarSlaMotorista();
    }
};

window.atualizarSlaInput = function () {
    if (!window.motoristaSelecionado) return;
    const elMes = document.getElementById('dataGlobal');
    const mesFiltroStr = elMes?.value ? elMes.value.substring(0, 7) : getAnoMesAtual();
    const chaveComMes  = window.motoristaSelecionado + '_' + mesFiltroStr;
    const customSla    = window.configSlaCloud[chaveComMes];
    const slaAtivo     = window.calcularSlaMotorista(window.motoristaSelecionado, mesFiltroStr);

    const inSla  = document.getElementById('inputSlaMotorista');
    const btnSla = document.getElementById('btnTravaSla');

    if (inSla && btnSla) {
        inSla.value = slaAtivo;
        if (customSla !== undefined) {
            inSla.setAttribute('readonly', 'true');
            btnSla.innerHTML   = '<i data-lucide="lock" class="w-4 h-4"></i>';
            btnSla.className   = 'bg-red-100 text-red-600 hover:text-red-700 p-2 rounded-lg shadow-sm border border-red-200 transition-colors shrink-0';
        } else {
            inSla.removeAttribute('readonly');
            btnSla.innerHTML   = '<i data-lucide="unlock" class="w-4 h-4"></i>';
            btnSla.className   = 'text-amber-500 hover:text-amber-700 bg-white p-2 rounded-lg shadow-sm border border-amber-100 transition-colors shrink-0';
        }
    }
    lucide.createIcons();
};

window.salvarSlaMotorista = async function () {
    if (!window.motoristaSelecionado) return;
    const inSla = document.getElementById('inputSlaMotorista');
    const elMes = document.getElementById('dataGlobal');
    if (!inSla) return;
    const val = parseFloat(inSla.value);
    const mesFiltroStr = elMes?.value ? elMes.value.substring(0, 7) : getAnoMesAtual();
    const chaveComMes  = window.motoristaSelecionado + '_' + mesFiltroStr;
    if (val >= 0) {
        await supabase.from('config_slas').upsert({ chave: chaveComMes, valor: val }, { onConflict: 'chave' });
        await window.carregarDadosDoSupabase();
    }
};

window.sincronizarMesData = function () {
    const dtG = document.getElementById('dataGlobal');
    const msF = document.getElementById('mesFiltro');
    if (!dtG || !msF) return;
    msF.value = dtG.value;

    // Atualiza data de lançamento para o 1º dia do mês selecionado
    const dataLanc = document.getElementById('dataLancamento');
    if (dataLanc) {
        const [ano, mes] = dtG.value.split('-');
        const hoje = new Date();
        const mesHoje = String(hoje.getMonth() + 1).padStart(2, '0');
        const anoHoje = String(hoje.getFullYear());
        if (ano === anoHoje && mes === mesHoje) {
            dataLanc.value = getHojeStr();
        } else {
            dataLanc.value = `${ano}-${mes}-01`;
        }
    }

    window.carregarDiasUteis(dtG.value);
    window.renderizarSidebar();
    window.atualizarResumosGlobais();
    if (window.motoristaSelecionado) {
        window.atualizarResumosDoMotorista();
        window.carregarHistoricoMotorista();
        window.atualizarSlaInput();
    }
};

window.sincronizarMesFiltro = function () {
    const msF = document.getElementById('mesFiltro');
    if (!msF) return;
    window.carregarDiasUteis(msF.value);
    window.renderizarSidebar();
};

window.calcularPrevisao = function (totalSoma, anoMesStr, diasUteisAlvo) {
    if (totalSoma === 0) return 0;
    const dataAtual   = new Date();
    const anoAtual    = dataAtual.getFullYear();
    const mesAtual    = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const strAtual    = `${anoAtual}-${mesAtual}`;
    const diasUteisTotais = diasUteisAlvo || window.carregarDiasUteis(anoMesStr);
    let diasUteisCorridos = 0;

    if (anoMesStr < strAtual) {
        diasUteisCorridos = diasUteisTotais;
    } else if (anoMesStr > strAtual) {
        return 0;
    } else {
        const diaHoje    = dataAtual.getDate();
        const diasNoMes  = new Date(anoAtual, parseInt(mesAtual), 0).getDate();
        const progresso  = diaHoje / diasNoMes;
        diasUteisCorridos = Math.max(1, Math.round(diasUteisTotais * progresso));
    }

    if (diasUteisCorridos === 0) return 0;
    return Math.round((totalSoma / diasUteisCorridos) * diasUteisTotais);
};



window.toggleSidebar = function () {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('sidebar-fechada');
};

window.mudarAba = function (aba) {
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));

['viewLancamentos', 'viewRankings', 'viewDomFeriados', 'viewProjecao', 'viewAuditoria', 'viewRotas', 'viewCadastro', 'viewOperador', 'viewFaltas', 'viewCaminhoes'].forEach(id => {        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    const mapaAbas = {
        lancamentos: { btn: 'btnTabLancamentos', view: 'viewLancamentos' },
        rankings:    { btn: 'btnTabRankings',    view: 'viewRankings'    },
        domferiados: { btn: 'btnTabDomFeriados', view: 'viewDomFeriados' },
        projecao:    { btn: 'btnTabProjecao',    view: 'viewProjecao'    },
        auditoria:   { btn: 'btnTabAuditoria',   view: 'viewAuditoria'   },
        rotas:       { btn: 'btnTabRotas',       view: 'viewRotas'       },
        cadastro:    { btn: 'btnTabCadastro',    view: 'viewCadastro'    },
        operador:    { btn: 'btnTabOperador',    view: 'viewOperador'    },
        faltas:      { btn: 'btnTabFaltas',    view: 'viewFaltas'    },
        caminhoes: { btn: 'btnTabCaminhoes', view: 'viewCaminhoes' },
    };

    const conf = mapaAbas[aba];
    if (!conf) return;

    const btnEl = document.getElementById(conf.btn);
    if (btnEl) btnEl.classList.add('active');
    
    const viewEl = document.getElementById(conf.view);
    if (viewEl) viewEl.style.display = 'block';

    // Abas que usam o seletor de Mês de Referência
    const abasComMes = ['lancamentos', 'rankings', 'domferiados', 'projecao', 'rotas', 'faltas'];
    const containerMes = document.getElementById('dataGlobal')?.closest('div');
    if (containerMes) containerMes.style.display = abasComMes.includes(aba) ? 'flex' : 'none';

    // Ações específicas por aba
    if (aba === 'rankings') {
        window.gerarRankingPeriodo();
        window.gerarRankingMensal();
    } else if (aba === 'domferiados') {
        window.gerarPainelFeriados();
    } else if (aba === 'projecao') {
        window.atualizarGraficosProjecao();
    } else if (aba === 'auditoria') {
        window.carregarAuditoriaLancamentos();
    } else if (aba === 'rotas') {
        window.carregarRotasDia();
    } else if (aba === 'cadastro') {
        window.carregarMotoristas();
    } else if (aba === 'faltas') {
        window.popularSelectFaltas();
        window.renderizarRelatorioFaltas();
    } else if (aba === 'caminhoes') {
    window.carregarCaminhoes();
    }

};

// Garante que a primeira aba só carregue depois do HTML estar pronto
document.addEventListener('DOMContentLoaded', () => {
    window.mudarAba('lancamentos');
});

window.filtrarMotoristas = function () {
    const busca = document.getElementById('buscaMotorista');
    if (!busca) return;
    const input = busca.value.toUpperCase();
    document.querySelectorAll('.driver-item').forEach(item => {
        const nome = item.textContent || item.innerText;
        item.style.display = nome.toUpperCase().includes(input) ? '' : 'none';
    });
};

window.selecionarMotorista = function (nome, elementoLista) {
    window.motoristaSelecionado = nome;
    document.querySelectorAll('.driver-item').forEach(el => el.classList.remove('active'));
    if (elementoLista) elementoLista.classList.add('active');

    const estadoVazio = document.getElementById('estadoVazio');
    const conteudo    = document.getElementById('conteudoMotorista');
    const nomeDisplay = document.getElementById('nomeMotoristaDisplay');

    if (estadoVazio) estadoVazio.style.display = 'none';
    if (conteudo)    conteudo.style.display = 'block';
    if (nomeDisplay) nomeDisplay.textContent = nome;

    const selectVeiculo = document.getElementById('tipoVeiculo');
    if (selectVeiculo) {
        selectVeiculo.innerHTML = `
            <option value="poli_duplo">Poliguindaste Duplo (Meta 8 Cx p/ Faturamento)</option>
            <option value="poliguindaste">Poliguindaste Simples (Meta 4 Cx p/ Faturamento)</option>
            <option value="cacamba">Caminhão Caçamba (Meta 4 Vg p/ Faturamento)</option>
        `;
        selectVeiculo.value = window.motOutros.includes(nome) ? 'cacamba' : 'poli_duplo';

    }

    const filtroProjMot = document.getElementById('filtroProjMot');
    if (filtroProjMot) filtroProjMot.value = nome;

    window.atualizarSlaInput();
    window.carregarHistoricoMotorista();
    window.atualizarResumosDoMotorista();
    window.atualizarGraficosProjecao();
};

window.selecionarMotoristaProjecao = function (nome) {
    if (!nome) return;
    window.selecionarMotorista(nome, null);
};

// =============================================================
// SALVAR LANÇAMENTO
// =============================================================
window.salvarLancamento = async function () {
    if (window._salvandoLancamento) return;
    window._salvandoLancamento = true;
    if (!window.motoristaSelecionado) { window._salvandoLancamento = false; alert('Selecione um motorista primeiro!'); return; }

    const elData  = document.getElementById('dataLancamento');
    const dataStr = elData ? elData.value : null;
    if (!dataStr) { alert('Preencha a data do serviço.'); return; }

    const statusInput     = document.getElementById('statusServico').value;
    const tipoVeiculoInput = document.getElementById('tipoVeiculo').value;
    let servicosInput     = parseInt(document.getElementById('servicos').value) || 0;
    let valorExtraInput   = parseFloat(document.getElementById('valorExtra').value.replace(',', '.')) || 0;
    const isFeriadoInput  = document.getElementById('feriado')?.checked ?? false;
    const observacaoInput = document.getElementById('observacao')?.value.trim() ?? '';

    if (statusInput !== 'normal') { servicosInput = 0; valorExtraInput = 0; }

    const bancoDados = window.bancoDadosCloud;
    if (!bancoDados[dataStr]) bancoDados[dataStr] = {};
    const lancamentoExistente = bancoDados[dataStr][window.motoristaSelecionado];

    let servicosFinais    = servicosInput;
    let valorExtraFinal   = valorExtraInput;
    let isFeriadoFinal    = isFeriadoInput;
    let observacaoFinal   = observacaoInput;
    let tipoVeiculoFinal  = tipoVeiculoInput;
    let statusFinal       = statusInput;

    if (lancamentoExistente) {
        if (lancamentoExistente.status !== 'normal' && statusInput === 'normal') {
            servicosFinais  = servicosInput;
            valorExtraFinal = valorExtraInput;
        } else {
    servicosFinais  += (lancamentoExistente.servicos || 0);
    valorExtraFinal += (lancamentoExistente.valorExtra || 0);
    const pontosNovo = tipoVeiculoInput === 'poli_duplo' ? servicosInput * 0.5 : servicosInput;
    const pontosExistente = lancamentoExistente.tipoVeiculo === 'poli_duplo' ? (lancamentoExistente.servicos || 0) * 0.5 : (lancamentoExistente.servicos || 0);
    window._pontosFinaisMisto = pontosNovo + pontosExistente;
    // Guarda as quantidades brutas separadas para exibição
const cxExistente  = lancamentoExistente.tipoVeiculo === 'cacamba'    ? 0 : (lancamentoExistente.servicos || 0);
const vgExistente  = lancamentoExistente.tipoVeiculo === 'cacamba'    ? (lancamentoExistente.servicos || 0) : 0;
const cxNovo       = tipoVeiculoInput === 'cacamba'                   ? 0 : servicosInput;
const vgNovo       = tipoVeiculoInput === 'cacamba'                   ? servicosInput : 0;
window._caixasBrutasMisto  = cxExistente  + cxNovo;
window._viagensBrutasMisto = vgExistente + vgNovo;
}

        isFeriadoFinal = isFeriadoInput || lancamentoExistente.isFeriado;

        if (lancamentoExistente.observacao && observacaoInput) {
            observacaoFinal = lancamentoExistente.observacao + ' | ' + observacaoInput;
        } else if (lancamentoExistente.observacao) {
            observacaoFinal = lancamentoExistente.observacao;
        }

        if (lancamentoExistente.tipoVeiculo && lancamentoExistente.tipoVeiculo !== tipoVeiculoInput && statusInput === 'normal') {
            tipoVeiculoFinal = 'misto';
            if (!observacaoFinal.includes('[MISTO]')) observacaoFinal = '[MISTO] ' + observacaoFinal;
        } else {
        }
    }

    const { valorBase, bateuMetaSemana } = calcularValorDia({
        motoristaNome: window.motoristaSelecionado,
        dataStr,
        servicos: tipoVeiculoFinal === 'misto' ? (window._pontosFinaisMisto || servicosFinais) : servicosFinais,
        servicosBrutos: servicosFinais,
        tipoVeiculo: tipoVeiculoFinal,
        isFeriado: isFeriadoFinal,
        status: statusFinal,
        bancoDados: window.bancoDadosCloud,
        formatarData: formatarDataParaBusca,
    });

    const valorFinal = valorBase + valorExtraFinal;

    // Upload de anexo
    const arquivoAnexo = document.getElementById('anexoObs')?.files?.[0];
    let dadosAnexo = null;

    if (arquivoAnexo) {
        const nomeSeguro = arquivoAnexo.name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w.\-]+/g, '_');

        const motoristaSeguro = window.motoristaSelecionado
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\-]+/g, '_');

        const caminhoAnexo = `${dataStr}/${motoristaSeguro}/${Date.now()}_${nomeSeguro}`;

        const { error: erroUpload } = await supabase.storage
            .from('lancamentos-anexos')
            .upload(caminhoAnexo, arquivoAnexo, { upsert: true });

        if (erroUpload) { alert('Erro ao anexar arquivo: ' + erroUpload.message); return; }

        const { data: urlData } = supabase.storage.from('lancamentos-anexos').getPublicUrl(caminhoAnexo);
        dadosAnexo = {
            nome: arquivoAnexo.name,
            url:  urlData.publicUrl,
            path: caminhoAnexo,
            tipo: arquivoAnexo.type || '',
        };
    }

    bancoDados[dataStr][window.motoristaSelecionado] = {
        anexoNome:         dadosAnexo?.nome  || lancamentoExistente?.anexoNome  || null,
        anexoUrl:          dadosAnexo?.url   || lancamentoExistente?.anexoUrl   || null,
        anexoPath:         dadosAnexo?.path  || lancamentoExistente?.anexoPath  || null,
        anexoTipo:         dadosAnexo?.tipo  || lancamentoExistente?.anexoTipo  || null,
        servicos:          servicosFinais,
        caixasBrutas:      tipoVeiculoFinal === 'misto' ? window._caixasBrutasMisto  : (tipoVeiculoFinal === 'cacamba' ? 0 : servicosFinais),  // ← ADICIONAR
viagensBrutas:     tipoVeiculoFinal === 'misto' ? window._viagensBrutasMisto : (tipoVeiculoFinal === 'cacamba' ? servicosFinais : 0),  // ← ADICIONAR
        valor:             valorFinal,
        isFeriado:         isFeriadoFinal,
        ganhouBonusSemana: bateuMetaSemana,
        tipoVeiculo:       tipoVeiculoFinal,
        valorExtra:        valorExtraFinal,
        pontos:            window.calcularPontosMotorista(window.motoristaSelecionado, servicosFinais, tipoVeiculoFinal),
        observacao:        observacaoFinal,
        status:            statusFinal,
        caixasBrutas:      tipoVeiculoFinal === 'misto' ? window._caixasBrutasMisto  : (tipoVeiculoFinal === 'cacamba' ? 0 : servicosFinais),
        viagensBrutas:     tipoVeiculoFinal === 'misto' ? window._viagensBrutasMisto : (tipoVeiculoFinal === 'cacamba' ? servicosFinais : 0),
    };

    await window.syncToSupabase(dataStr, window.motoristaSelecionado);
    await window.carregarDadosDoSupabase();

    // Limpar formulário
    ['servicos', 'valorExtra', 'observacao'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const elFeriado = document.getElementById('feriado');
    if (elFeriado) elFeriado.checked = false;
    const elStatus = document.getElementById('statusServico');
    if (elStatus) elStatus.value = 'normal';
    const elAnexo = document.getElementById('anexoObs');
       if (elAnexo) elAnexo.value = '';
    const elNomeAnexo = document.getElementById('nomeAnexo');
    if (elNomeAnexo) elNomeAnexo.classList.add('hidden');
    window._salvandoLancamento = false;
};

// =============================================================
// HISTÓRICO E EXCLUSÃO
// =============================================================
window.carregarHistoricoMotorista = function () {
    if (!window.motoristaSelecionado) return;
    const tbody = document.querySelector('#tabelaHistorico tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const bancoDados = window.bancoDadosCloud;
    const elMes = document.getElementById('dataGlobal');
    const mesFiltroStr = elMes?.value ? elMes.value.substring(0, 7) : getAnoMesAtual();

    let historico = [];
    for (const data in bancoDados) {
        if (dataEstaNoMes(data, mesFiltroStr) && bancoDados[data][window.motoristaSelecionado]) {
            historico.push({ data, dados: bancoDados[data][window.motoristaSelecionado] });
        }
    }
    historico.sort((a, b) => new Date(b.data) - new Date(a.data));

    if (historico.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-slate-400 font-medium py-8">Nenhum lançamento encontrado neste mês.</td></tr>';
        return;
    }

    const statusMap = {
        falta:      'bg-red-500 text-white',
        folga:      'bg-slate-500 text-white',
        atestado:   'bg-yellow-400 text-slate-800',
        polioff:    'bg-orange-500 text-white',
        ferias:    'bg-purple-500 text-white',
        desligado:  'bg-red-800 text-white shadow-sm',
    };
    const statusLabel = {
        falta: 'Falta', folga: 'Folga', atestado: 'Atestado',
        polioff: 'Poli OFF', licenca: 'Férias', desligado: 'Desligado',
    };

    historico.forEach(item => {
        const tr = document.createElement('tr');
        const dataObj = new Date(item.data + 'T00:00:00');

        let tagsDia = '';
        if (dataObj.getDay() === 0)    tagsDia += '<span class="badge-feriado">DOMINGO</span> ';
        if (item.dados.isFeriado)      tagsDia += '<span class="badge-feriado">FERIADO</span> ';
        if (item.dados.ganhouBonusSemana) tagsDia += '<span class="badge-meta">META SAB BATIDA</span>';
        if (!tagsDia) tagsDia = 'Normal';

        const tagStatus = statusMap[item.dados.status]
            ? `<span class="${statusMap[item.dados.status]} px-2 py-0.5 rounded text-[10px] font-black uppercase">${statusLabel[item.dados.status]}</span>`
            : '';

        const tagVeiculo = {
            cacamba:    'CAÇAMBA',
            poli_duplo: 'POLI. DUPLO',
            misto:      'VEÍC. MISTO',
        }[item.dados.tipoVeiculo] || 'POLIGUINDASTE';

       const feriadoBadge = item.dados.isFeriado
            ? `<span class="badge-feriado" style="margin-left:4px;">FERIADO</span>`
            : '';
        const stringColuna2 = tagStatus
            ? `${tagStatus}${feriadoBadge}`
            : `<span class="badge-veiculo">${tagVeiculo}</span><br><span class="inline-block mt-1">${tagsDia}</span>`;

        let qtdText = item.dados.tipoVeiculo === 'cacamba'
            ? `${item.dados.servicos} vg`
            : `${item.dados.servicos} cx`;
        if (item.dados.status && item.dados.status !== 'normal') qtdText = '-';

        const extraTxt   = item.dados.valorExtra > 0 ? `+ ${formatarMoeda(item.dados.valorExtra)}` : '-';
        const obsText    = item.dados.observacao || '-';
        const anexoHtml  = item.dados.anexoUrl
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
                ${obsText}${anexoHtml ? `<br>${anexoHtml}` : ''}
            </td>
            <td class="text-center">
                <button class="btn-delete" onclick="window.deletarLancamentoEspecifico('${dataEscaped}')">Excluir</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    lucide.createIcons();
};

window.deletarLancamentoEspecifico = async function (dataStr) {
    if (!window.motoristaSelecionado) return;

    const motivo = prompt(`Motivo para cancelar o lançamento de ${formatarDataParaExibicao(dataStr)}:`);
    if (motivo === null) return;

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
        .from('lancamentos')
        .update({
            cancelado_em:         new Date().toISOString(),
            cancelado_por:        user?.id    || null,
            cancelado_por_email:  user?.email || null,
            motivo_cancelamento:  motivo || 'Cancelado pelo sistema',
        })
        .eq('data', dataStr)
        .eq('motorista_nome', window.motoristaSelecionado);

    if (error) { alert('Erro ao cancelar: ' + error.message); return; }

    await window.carregarDadosDoSupabase();
};

// =============================================================
// RESUMOS
// =============================================================
window.atualizarResumosDoMotorista = function () {
    if (!window.motoristaSelecionado) return;
    const elLanc = document.getElementById('dataLancamento');
    if (!elLanc) return;
    const dataRefStr = elLanc.value;
    if (!dataRefStr) return;

    const bancoDados = window.bancoDadosCloud;

    // Total do Dia
    const totalDia = bancoDados[dataRefStr]?.[window.motoristaSelecionado]?.valor ?? 0;
    const elTotalDia = document.getElementById('motoristaTotalDia');
    if (elTotalDia) elTotalDia.innerText = formatarMoeda(totalDia);

    // Total da Semana
    let totalSemana = 0;
    const dataObj = new Date(dataRefStr + 'T00:00:00');
    const diffParaSegunda = dataObj.getDay() === 0 ? -6 : 1 - dataObj.getDay();
    const dataSegunda = new Date(dataObj);
    dataSegunda.setDate(dataObj.getDate() + diffParaSegunda);

    for (let i = 0; i < 7; i++) {
        const diaCheck = new Date(dataSegunda);
        diaCheck.setDate(dataSegunda.getDate() + i);
        const diaCheckStr = formatarDataParaBusca(diaCheck);
        totalSemana += bancoDados[diaCheckStr]?.[window.motoristaSelecionado]?.valor ?? 0;
    }
    const elTotalSemana = document.getElementById('motoristaTotalSemana');
    if (elTotalSemana) elTotalSemana.innerText = formatarMoeda(totalSemana);

    // Totais do mês — usa sempre o dataGlobal (mês de referência principal)
    const elMes = document.getElementById('dataGlobal');
    const anoMesFiltro = (elMes?.value || dataRefStr).substring(0, 7);
    let totalCaixasMes = 0, totalViagensMes = 0, totalFatMes = 0, totalPontosMes = 0;

    for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
        if (dataEstaNoMes(dataStr, anoMesFiltro) && dadosDia[window.motoristaSelecionado]) {
            const r = dadosDia[window.motoristaSelecionado];
            if (!r.status || r.status === 'normal') {
                const srv = r.servicos || 0;
                // Registros antigos podem ter caixasBrutas=0 mesmo tendo serviços
                // então usa || em vez de ?? para forçar recálculo quando for 0
                const cxBrutas = r.caixasBrutas > 0 ? r.caixasBrutas
                    : (r.tipoVeiculo === 'cacamba' ? 0
                    : r.tipoVeiculo === 'poli_duplo' ? srv * 2
                    : srv);
                const vgBrutas = r.viagensBrutas > 0 ? r.viagensBrutas
                    : (r.tipoVeiculo === 'cacamba' ? srv : 0);
                totalCaixasMes  += cxBrutas;
                totalViagensMes += vgBrutas;
                totalPontosMes += r.pontos !== undefined
                    ? r.pontos
                    : window.calcularPontosMotorista(window.motoristaSelecionado, r.servicos || 0, r.tipoVeiculo);
            }
            totalFatMes += r.valor;
        }
    }

    const metaDiaria         = window.getMetaDiaria(window.motoristaSelecionado);
    const diasUteisMotorista  = window.calcularSlaMotorista(window.motoristaSelecionado, anoMesFiltro);
    const metaMensalPontos    = diasUteisMotorista * metaDiaria;
    const previsaoPontos      = window.calcularPrevisao(totalPontosMes, anoMesFiltro, diasUteisMotorista);
    const isEspecial          = window.motOutros.includes(window.motoristaSelecionado);

    let textoMeta = '';
    if (isEspecial) {
        textoMeta = `${metaMensalPontos / 2} vg`;
        const elCaixas = document.getElementById('motoristaCaixasMes');
        if (elCaixas) elCaixas.innerText = `${totalCaixasMes} cx | ${totalViagensMes} vg`;
        const elPrevisao = document.getElementById('motoristaPrevisaoMes');
        if (elPrevisao) elPrevisao.innerText = `${previsaoPontos / 2} vg`;
    } else {
        textoMeta = `${metaMensalPontos} cx`;
        const elCaixas = document.getElementById('motoristaCaixasMes');
        if (elCaixas) elCaixas.innerText = totalViagensMes > 0
            ? `${totalCaixasMes} cx + ${totalViagensMes} vg`
            : `${totalCaixasMes} cx`;
        const exibeCaixas = totalPontosMes > 0 && totalCaixasMes > totalPontosMes
            ? Math.round(previsaoPontos * (totalCaixasMes / totalPontosMes))
            : previsaoPontos;
        const elPrevisao = document.getElementById('motoristaPrevisaoMes');
        if (elPrevisao) elPrevisao.innerText = `${exibeCaixas} cx`;
    }

    const elMeta = document.getElementById('motoristaMetaMes');
    if (elMeta) elMeta.innerText = `Meta (Elo): ${textoMeta} | Fat: ${formatarMoeda(totalFatMes)}`;
};

window.atualizarResumosGlobais = function () {
    const elLanc = document.getElementById('dataLancamento');
    const dataRefStr = elLanc ? elLanc.value : null;
    const elGlobal = document.getElementById('dataGlobal');
    const mesGlobalStr = elGlobal
        ? elGlobal.value.substring(0, 7)
        : (dataRefStr ? dataRefStr.substring(0, 7) : null);
    if (!mesGlobalStr) return;

    const bancoDados = window.bancoDadosCloud;
    let totalDiaGlobal = 0, caixasDiaGlobal = 0, totalMesGlobal = 0, caixasMesGlobal = 0;

    if (dataRefStr && bancoDados[dataRefStr]) {
        for (const mot in bancoDados[dataRefStr]) {
            const d = bancoDados[dataRefStr][mot];
            totalDiaGlobal += d.valor;
            if (d.tipoVeiculo !== 'cacamba' && (!d.status || d.status === 'normal')) {
                caixasDiaGlobal += d.servicos || 0;
            }
        }
    }

    for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
        if (dataEstaNoMes(dataStr, mesGlobalStr)) {
            for (const mot in dadosDia) {
                const d = dadosDia[mot];
                totalMesGlobal += d.valor;
                if (d.tipoVeiculo !== 'cacamba' && (!d.status || d.status === 'normal')) {
                    caixasMesGlobal += d.servicos || 0;
                }
            }
        }
    }

    const _set = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };
    _set('totalDiaGlobal',     formatarMoeda(totalDiaGlobal));
    _set('caixasDiaGlobal',    `${caixasDiaGlobal} cx`);
    _set('totalSemanaGlobal',  formatarMoeda(totalMesGlobal));
    _set('caixasSemanaGlobal', `${caixasMesGlobal} cx`);
};

window.gerarRankingPeriodo = function () {
    const elInicio = document.getElementById('dataRankingInicio');
    const elFim    = document.getElementById('dataRankingFim');
    if (!elInicio || !elFim) return;
    const inicio = elInicio.value;
    const fim    = elFim.value;
    if (!inicio || !fim) return;

    const bancoDados = window.bancoDadosCloud;
    let rankPeriodo  = {};
    
    let totalFatGeral = 0;
    let totalCaixasGeral = 0;
    let totalViagensGeral = 0;

    for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
        if (dataEstaNoIntervalo(dataStr, inicio, fim)) {
            const dataObj = new Date(dataStr + 'T00:00:00');
            const diaDaSemana = dataObj.getDay();

            // Pula domingos
            if (diaDaSemana === 0) continue;

            for (const [mot, dados] of Object.entries(dadosDia)) {
                // Pula feriados
                if (dados.isFeriado) continue;

                if (!rankPeriodo[mot]) rankPeriodo[mot] = { caixas: 0, viagens: 0, valor: 0, extra: 0, diasTrab: 0, pontos: 0 };
                
                rankPeriodo[mot].valor += dados.valor;
                rankPeriodo[mot].extra += dados.valorExtra || 0;
                
                totalFatGeral += dados.valor;

                if (!dados.status || dados.status === 'normal') {
                    const srv = dados.servicos || 0;
                    const cx = dados.caixasBrutas  ?? (dados.tipoVeiculo === 'cacamba' ? 0 : (dados.tipoVeiculo === 'poli_duplo' ? srv * 2 : srv));
                    const vg = dados.viagensBrutas ?? (dados.tipoVeiculo === 'cacamba' ? srv : 0);
                    rankPeriodo[mot].caixas  += cx;
                    rankPeriodo[mot].viagens += vg;
                    totalCaixasGeral  += cx;
                    totalViagensGeral += vg;
                    rankPeriodo[mot].pontos += dados.pontos !== undefined
                        ? dados.pontos
                        : window.calcularPontosMotorista(mot, srv, dados.tipoVeiculo);
                    if (diaDaSemana !== 0 && diaDaSemana !== 6 && !dados.isFeriado) rankPeriodo[mot].diasTrab++;
                }
            }
        }
    }

    const elQtd = document.getElementById('totalQtdPeriodo');
    if (elQtd) elQtd.innerText = `${totalCaixasGeral} cx | ${totalViagensGeral} vg`;
    
    const elFat = document.getElementById('totalFatPeriodo');
    if (elFat) elFat.innerText = formatarMoeda(totalFatGeral);

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
        const porcentagemStr = formatarPercentual(mot.porcentagem);
        const classeBarra    = mot.porcentagem >= 100 ? 'meta-batida' : (mot.porcentagem >= 80 ? 'meta-excedida' : 'meta-ruim');
        const larguraBarra   = Math.min(mot.porcentagem, 100);
        const extraBadge     = mot.extra > 0
            ? `<span class="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded ml-2">+ Extra ${formatarMoeda(mot.extra)}</span>`
            : '';
        const textoQtd = formatarQuantidadeMista(mot.caixas, mot.viagens, window.motOutros.includes(mot.nome));

        const cadastro = (window.motoristasCache || []).find(m => m.nome === mot.nome);
        const pixHtml = cadastro?.chave_pix
            ? `<span style="font-size:11px; color:var(--gray-400); display:flex; align-items:center; gap:4px; margin-top:2px;">
                   <i data-lucide="diamond" style="width:11px; height:11px; color:#16a34a;"></i>
                   ${cadastro.chave_pix}
               </span>`
            : '';

        const linha = document.createElement('div');
        linha.className = 'diario-row';
        linha.innerHTML = `
            <div class="diario-top">
                <div style="display:flex; flex-direction:column;">
                    <span class="diario-nome">#${index + 1} - ${mot.nome} <span class="text-blue-500 font-black">(${textoQtd})</span> ${extraBadge}</span>
                    ${pixHtml}
                </div>
                <span class="diario-faturamento">${formatarMoeda(mot.valor)}</span>
            </div>
            <div class="progress-wrapper">
                <div class="progress-bar-bg"><div class="progress-bar-fill ${classeBarra}" style="width: ${larguraBarra}%;"></div></div>
                <span class="progress-text" title="Baseado nos dias trabalhados">${porcentagemStr}</span>
            </div>
        `;

        if (window.lucide) window.lucide.createIcons({ nodes: [linha] });
        divLista.appendChild(linha);
    });
};

// =============================================================
// FUNÇÃO PARA EXPORTAR O RANKING EM PDF
// =============================================================
window.exportarRankingPeriodoPDF = function() {
    const inicio = document.getElementById('dataRankingInicio')?.value;
    const fim    = document.getElementById('dataRankingFim')?.value;
    if (!inicio || !fim) return alert('Selecione o período antes de exportar.');

    // Formata datas para exibição: 2026-05-01 → 01/05/2026
    const fmt = d => d.split('-').reverse().join('/');
    const periodoLabel = `${fmt(inicio)} até ${fmt(fim)}`;

    // Pega as linhas já renderizadas e reconstrói com PIX
    const linhasOriginais = document.querySelectorAll('#listaRankingDiario .diario-row');
    let linhasHtml = '';
    linhasOriginais.forEach((linha) => {
        const nomeEl  = linha.querySelector('.diario-nome');
        const fatEl   = linha.querySelector('.diario-faturamento');
        const barraEl = linha.querySelector('.progress-bar-fill');
        const percEl  = linha.querySelector('.progress-text');

        // Usa innerText para evitar SVGs/ícones Lucide no HTML
        const nomeTexto = nomeEl ? nomeEl.innerText : '';
        const fatTexto  = fatEl  ? fatEl.innerText  : '';
        const largura   = barraEl ? barraEl.style.width : '0%';
        const classeBar = barraEl ? barraEl.className.replace('progress-bar-fill','').trim() : '';
        const percTexto = percEl  ? percEl.innerText : '';

        const corBarra = classeBar === 'meta-batida' ? '#22c55e' : classeBar === 'meta-excedida' ? '#f59e0b' : '#ef4444';

        // Busca o nome puro para encontrar o PIX no cache
        const nomeMotorista = nomeTexto.replace(/#\d+\s*-\s*/, '').replace(/\(.*\)/, '').trim();
        const cadastro = (window.motoristasCache || []).find(m =>
            nomeMotorista && m.nome.toLowerCase() === nomeMotorista.toLowerCase()
        );
        const pixHtml = cadastro?.chave_pix
            ? `<div style="font-size:10px;color:#6b7280;margin-top:3px;">PIX: ${cadastro.chave_pix}</div>`
            : '';

        linhasHtml += `
            <div style="padding:12px 14px;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:8px;page-break-inside:avoid;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                    <div>
                        <div style="font-size:13px;font-weight:600;color:#111827;">${nomeTexto}</div>
                        ${pixHtml}
                    </div>
                    <div style="font-family:monospace;font-weight:600;color:#059669;font-size:15px;">${fatTexto}</div>
                </div>
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="flex:1;background:#f3f4f6;height:6px;border-radius:999px;overflow:hidden;">
                        <div style="height:100%;border-radius:999px;width:${largura};background:${corBarra};"></div>
                    </div>
                    <span style="font-size:11px;font-weight:600;color:#6b7280;width:52px;text-align:right;">${percTexto}</span>
                </div>
            </div>`;
    });

    const totalQtd = document.getElementById('totalQtdPeriodo')?.innerText || '—';
    const totalFat = document.getElementById('totalFatPeriodo')?.innerText  || '—';
    // Monta seção de status (motoristas sem serviço no período)
const statusLabels = {
    licenca: 'Férias', folga: 'Folga', falta: 'Falta',
    polioff: 'Poli OFF', desligado: 'Desligado', atestado: 'Atestado',
};
let statusHtml = '';
const bancoDados = window.bancoDadosCloud;
const statusPorMot = {};

for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
    if (dataStr < inicio || dataStr > fim) continue;
    for (const [mot, dados] of Object.entries(dadosDia)) {
        if (dados.status && dados.status !== 'normal' && (!dados.servicos || dados.servicos === 0)) {
            if (!statusPorMot[mot]) statusPorMot[mot] = [];
            const d = dataStr.split('-').reverse().join('/');
            const label = statusLabels[dados.status] || dados.status;
            statusPorMot[mot].push(`${d}: ${label}`);
        }
    }
}

if (Object.keys(statusPorMot).length > 0) {
    statusHtml = `
        <div style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:16px;">
            <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:10px;">📋 Status por Motorista</div>
            ${Object.entries(statusPorMot).map(([mot, dias]) => `
                <div style="margin-bottom:8px;padding:10px 12px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
                    <div style="font-size:12px;font-weight:600;color:#111827;">${mot}</div>
                    <div style="font-size:11px;color:#6b7280;margin-top:3px;">${dias.join(' · ')}</div>
                </div>`).join('')}
        </div>`;
}

    // Abre janela de impressão com o conteúdo — solução 100% confiável, sem html2canvas
    const janelaImpressao = window.open('', '_blank', 'width=800,height=900');
    janelaImpressao.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Ranking por Período - ${periodoLabel}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; padding: 28px; background: #fff; color: #111827; }
        @media print {
            body { padding: 16px; }
            @page { margin: 10mm; size: A4 portrait; }
        }
    </style>
</head>
<body>
    <!-- Cabeçalho -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">
        <div style="background:#dcfce7;border-radius:10px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:20px;">📊</div>
        <div>
            <div style="font-size:17px;font-weight:700;color:#111827;">Ranking por Período</div>
            <div style="font-size:12px;color:#9ca3af;">Total de serviços e faturamento</div>
        </div>
    </div>
    <!-- Período -->
    <div style="font-size:11px;color:#6b7280;margin-bottom:16px;padding-left:52px;">📅 ${periodoLabel}</div>
    <!-- Badge de totais -->
    <div style="display:flex;justify-content:space-between;background:#f9fafb;border:1px solid #d1fae5;border-radius:10px;padding:12px 16px;margin-bottom:20px;">
        <div>
            <div style="font-size:9px;font-weight:600;color:#059669;text-transform:uppercase;letter-spacing:.08em;">Total de Serviços no Período</div>
            <div style="font-size:15px;font-weight:700;color:#16a34a;">${totalQtd}</div>
        </div>
        <div style="text-align:right;">
            <div style="font-size:9px;font-weight:600;color:#059669;text-transform:uppercase;letter-spacing:.08em;">Faturamento no Período</div>
            <div style="font-size:15px;font-weight:700;color:#059669;">${totalFat}</div>
        </div>
    </div>
    <!-- Lista de motoristas -->
    ${linhasHtml}
    ${statusHtml} 
    <script>
        window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
        };
    <\/script>
</body>
</html>`);
    janelaImpressao.document.close();
};

window.obterRankElo = function (percentual) {
    if (percentual >= 100) return { nome: 'Ouro',  classe: 'elo-ouro'   };
    if (percentual >= 80)  return { nome: 'Prata', classe: 'elo-prata'  };
    return { nome: 'Bronze', classe: 'elo-bronze' };
};

window.gerarRankingMensal = function () {
    const elFiltro = document.getElementById('mesFiltro');
    if (!elFiltro) return;
    const mesFiltro = elFiltro.value;
    if (!mesFiltro) return;

    const diasUteisGlobais = window.carregarDiasUteis(mesFiltro);
    const bancoDados = window.bancoDadosCloud;
    let acumuladoMes = {};
    let totalCaixasFrota = 0, totalViagensFrota = 0, totalFatMesFrota = 0;

    window.motoristas.forEach(m => { acumuladoMes[m] = { caixas: 0, viagens: 0, valor: 0, pontos: 0 }; });
    window.motoristasInativos.forEach(m => { acumuladoMes[m] = { caixas: 0, viagens: 0, valor: 0, pontos: 0 }; });

    for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
        if (dataEstaNoMes(dataStr, mesFiltro)) {
            for (const [mot, dados] of Object.entries(dadosDia)) {
                if (!acumuladoMes[mot]) continue;
                const statusMot = (dados.status || 'normal').toLowerCase();
                if (statusMot === 'normal') {
                    const srv = dados.servicos || 0;
                    const cx = dados.caixasBrutas  ?? (dados.tipoVeiculo === 'cacamba' ? 0 : (dados.tipoVeiculo === 'poli_duplo' ? srv * 2 : srv));
                    const vg = dados.viagensBrutas ?? (dados.tipoVeiculo === 'cacamba' ? srv : 0);
                    acumuladoMes[mot].caixas  += cx;
                    acumuladoMes[mot].viagens += vg;
                    totalCaixasFrota  += cx;
                    totalViagensFrota += vg;

                    acumuladoMes[mot].pontos += dados.pontos !== undefined
                        ? dados.pontos
                        : window.calcularPontosMotorista(mot, dados.servicos || 0, dados.tipoVeiculo);
                }
                acumuladoMes[mot].valor += dados.valor;
                totalFatMesFrota += dados.valor;
            }
        }
    }

    function getMetaCalculadaMotorista(mot) {
        const slaMotorista    = window.calcularSlaMotorista(mot, mesFiltro);
        const metaDiaria      = window.getMetaDiaria(mot);
        const metaCheiaDoMes  = metaDiaria * diasUteisGlobais;
        if (diasUteisGlobais === 0) return 0;
        return metaCheiaDoMes * (slaMotorista / diasUteisGlobais);
    }

    let ptsRayanna = 0, feitasRayanna = 0;
    window.motRayanna.forEach(mot => {
        ptsRayanna   += getMetaCalculadaMotorista(mot);
        feitasRayanna += acumuladoMes[mot]?.pontos ?? 0;
    });

    let ptsJulia = 0, feitasJulia = 0;
    window.motJulia.forEach(mot => {
        ptsJulia   += getMetaCalculadaMotorista(mot);
        feitasJulia += acumuladoMes[mot]?.pontos ?? 0;
    });

    const ptsGeral    = ptsRayanna + ptsJulia;
    const feitasGeral = feitasRayanna + feitasJulia;

    const elViagens = document.getElementById('totalViajensMesGlobal');
    if (elViagens) elViagens.innerText = `${totalViagensFrota} vg`;
    const elFat = document.getElementById('totalFatMensalLeaderboard');
    if (elFat) elFat.innerText = formatarMoeda(totalFatMesFrota);

    function renderizarMeta(feitas, meta, elValor, elFalta) {
        const perc           = meta > 0 ? ((feitas / meta) * 100).toFixed(1) : 0;
        const faltam         = Math.max(0, meta - feitas);
        const metaFormatada  = formatarNumeroInteligente(meta);
        const faltamFormatado = formatarNumeroInteligente(faltam);
        const elV = document.getElementById(elValor);
        const elF = document.getElementById(elFalta);
        if (elV) elV.innerText = `${Math.round(feitas)} / ${metaFormatada} cx`;
        if (elF) elF.innerText = `${perc}% | Faltam ${faltamFormatado} cx`;
    }

    renderizarMeta(feitasGeral,   ptsGeral,   'metaGeralGlobal',   'faltaGeralGlobal');
    renderizarMeta(feitasRayanna, ptsRayanna, 'metaRayannaGlobal', 'faltaRayannaGlobal');
    renderizarMeta(feitasJulia,   ptsJulia,   'metaJuliaGlobal',   'faltaJuliaGlobal');

    const rankFinal = Object.keys(acumuladoMes).map(mot => {
        const info            = acumuladoMes[mot];
        const metaMensalPontos = getMetaCalculadaMotorista(mot);
        const percentualMeta  = metaMensalPontos > 0 ? (info.pontos / metaMensalPontos) * 100 : 0;
       return { nome: mot, caixas: info.caixas, viagens: info.viagens, valor: info.valor, pontos: info.pontos, percentual: percentualMeta, metaExata: metaMensalPontos, inativo: window.motoristasInativos.includes(mot) };
    }).filter(item => item.pontos > 0 || item.valor > 0).sort((a, b) => b.percentual - a.percentual);

    const divLista = document.getElementById('listaLeaderboard');
    if (!divLista) return;
    divLista.innerHTML = '';

    if (rankFinal.length === 0) {
        divLista.innerHTML = '<div class="text-center text-slate-400 py-8 font-medium">Sem registros válidos.</div>';
        return;
    }

    rankFinal.forEach((mot, index) => {
        const eloInfo       = window.obterRankElo(mot.percentual);
        const percentualStr = formatarPercentual(mot.percentual);

        let corPercent, bgPercent, borderPercent;
        if (mot.percentual >= 100)     { corPercent = '#10b981'; bgPercent = '#d1fae5'; borderPercent = '#a7f3d0'; }
        else if (mot.percentual >= 80) { corPercent = '#d97706'; bgPercent = '#fef3c7'; borderPercent = '#fde68a'; }
        else                           { corPercent = '#ef4444'; bgPercent = '#fee2e2'; borderPercent = '#fca5a5'; }

        const textoQtd = formatarQuantidadeMista(mot.caixas, mot.viagens, window.motOutros.includes(mot.nome));
        const faltam   = mot.metaExata - mot.pontos;
        let htmlFaltam = '';

        if (faltam > 0) {
            const calcVisual = window.motOutros.includes(mot.nome) ? faltam / 2 : faltam;
            const txtFaltam  = window.motOutros.includes(mot.nome)
                ? `Faltam ${formatarNumeroInteligente(calcVisual)} vg`
                : `Faltam ${formatarNumeroInteligente(calcVisual)} cx`;
            htmlFaltam = `<span class="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded ml-2 font-bold">${txtFaltam}</span>`;
        } else {
            htmlFaltam = `<span class="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded ml-2 font-bold">Meta OK!</span>`;
        }

        const linha = document.createElement('div');
        linha.className = 'elo-row';
        linha.innerHTML = `
            <div class="posicao">#${index + 1}</div>
            <div class="nome-motorista-rank" ${mot.inativo ? 'style="color:#ef4444;"' : ''}>${mot.nome}<span class="valor-sub">Fat: ${formatarMoeda(mot.valor)}</span></div>
            <div><span class="badge-elo ${eloInfo.classe}">${eloInfo.nome}</span></div>
            <div class="valor-destaque text-blue-500 flex items-center">
                ${textoQtd}
                <span class="badge-percent text-[11px]" style="background:${bgPercent}; color:${corPercent}; border-color:${borderPercent};">${percentualStr}</span>
                ${htmlFaltam}
            </div>
        `;
        divLista.appendChild(linha);
    });
};

// =============================================================
// PAINEL DOMINGOS E FERIADOS
// =============================================================
window.gerarPainelFeriados = function () {
    const domInicio = document.getElementById('dataDomInicio')?.value;
    const domFim    = document.getElementById('dataDomFim')?.value;
    const ferInicio = document.getElementById('dataFerInicio')?.value;
    const ferFim    = document.getElementById('dataFerFim')?.value;
    const bancoDados = window.bancoDadosCloud;
    let registrosDom = [], registrosFer = [];
    let fatTotalDom = 0, fatTotalFer = 0;

    for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
        const dataObj  = new Date(dataStr + 'T00:00:00');
        const isDomingo = dataObj.getDay() === 0;

        for (const [mot, dados] of Object.entries(dadosDia)) {
            if (!(dados.servicos > 0) && (!dados.status || dados.status === 'normal')) continue;
            const obj = {
                dataStr,
                nome:    mot,
                caixas:  dados.tipoVeiculo !== 'cacamba' ? dados.servicos : 0,
                viagens: dados.tipoVeiculo === 'cacamba' ? dados.servicos : 0,
                valor:   dados.valor,
                status:  dados.status,
            };
            if (isDomingo && !dados.isFeriado) {
                if (!domInicio || !domFim || dataEstaNoIntervalo(dataStr, domInicio, domFim)) {
                    registrosDom.push(obj);
                    fatTotalDom += dados.valor;
                }
            }
            if (dados.isFeriado) {
                if (!ferInicio || !ferFim || dataEstaNoIntervalo(dataStr, ferInicio, ferFim)) {
                    registrosFer.push(obj);
                    fatTotalFer += dados.valor;
                }
            }
        }
    }

    const _set = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };
    _set('totalFatDom',      formatarMoeda(fatTotalDom));
    _set('totalFatFer',      formatarMoeda(fatTotalFer));
    _set('totalGeralDomFer', formatarMoeda(fatTotalDom + fatTotalFer));

    function renderizarLista(listaRegistros, idElemento, msgVazia) {
        listaRegistros.sort((a, b) => new Date(b.dataStr) - new Date(a.dataStr) || b.valor - a.valor);
        const divLista = document.getElementById(idElemento);
        if (!divLista) return;
        divLista.innerHTML = '';

        if (listaRegistros.length === 0) {
            divLista.innerHTML = `<div class="text-center text-slate-400 py-8 font-medium">${msgVazia}</div>`;
            return;
        }

        listaRegistros.forEach(mot => {
            let textoQtd = '';
            if (mot.status && mot.status !== 'normal') {
                textoQtd = `<span class="bg-red-500 text-white px-2 py-0.5 rounded text-[10px] uppercase font-bold">${mot.status}</span>`;
            } else {
                textoQtd = formatarQuantidadeMista(mot.caixas, mot.viagens, window.motOutros.includes(mot.nome));
            }

            const linha = document.createElement('div');
            linha.className = 'diario-row';
            linha.innerHTML = `
                <div class="diario-top" style="margin:0;">
                    <span class="diario-nome" style="display:flex; align-items:center; gap:8px;">
                        <span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-black">${formatarDataParaExibicao(mot.dataStr)}</span>
                        ${mot.nome} <span class="text-blue-500">(${textoQtd})</span>
                    </span>
                    <span class="diario-faturamento text-red-500">${formatarMoeda(mot.valor)}</span>
                </div>
            `;
            divLista.appendChild(linha);
        });
    }

    renderizarLista(registrosDom, 'listaDomingos', 'Nenhum serviço em domingos no período selecionado. 😴');
    renderizarLista(registrosFer, 'listaFeriados', 'Nenhum serviço em feriados no período selecionado. 😴');
};

// =============================================================
// GRÁFICOS DE PROJEÇÃO
// =============================================================
window.atualizarGraficosProjecao = function () {
    const bancoDados = window.bancoDadosCloud;
    const inicio     = document.getElementById('dataProjInicio')?.value;
    const fim        = document.getElementById('dataProjFim')?.value;
    const filtroTurno = document.getElementById('filtroProjTurno')?.value || 'todos';
    if (!inicio || !fim) return;

    // Período anterior (mês anterior)
    const dIni = new Date(inicio + 'T00:00:00');
    const dFim = new Date(fim    + 'T00:00:00');
    dIni.setMonth(dIni.getMonth() - 1);
    dFim.setMonth(dFim.getMonth() - 1);
    const inicioPassadoStr = formatarDataParaBusca(dIni);
    const fimPassadoStr    = formatarDataParaBusca(dFim);

    let dadosEvolucaoInd = [], mapGeral = {}, stats = { atual: 0, passado: 0 };
    let diasTrabalhadosInd = 0, diasMetaBatidaInd = 0, somaServicosFisicosReal = 0;
    let maxServicosDiarios = 0, dataRecordeFisico = '';
    let somaPontosDiaDaSemana = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const nomesDias = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };

    const elNomeMot = document.getElementById('projecaoNomeMotorista');
    if (elNomeMot) elNomeMot.innerText = window.motoristaSelecionado || 'Ninguém Selecionado';

    for (const [data, motoristasDia] of Object.entries(bancoDados)) {
        const isPeriodoAtual   = dataEstaNoIntervalo(data, inicio, fim);
        const isPeriodoPassado = dataEstaNoIntervalo(data, inicioPassadoStr, fimPassadoStr);
        const dataObj          = new Date(data + 'T00:00:00');
        const diaDaSemana      = dataObj.getDay();
        let pontosDiaGeral     = 0;

        for (const [mot, dados] of Object.entries(motoristasDia)) {
            const statusN = !dados.status || dados.status === 'normal';
            const pts     = dados.pontos !== undefined
                ? dados.pontos
                : window.calcularPontosMotorista(mot, dados.servicos || 0, dados.tipoVeiculo);
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

            const incluirNoGeral =
                filtroTurno === 'todos' ||
                (filtroTurno === 'dia'      && window.motRayanna.includes(mot)) ||
                (filtroTurno === 'noite'    && window.motJulia.includes(mot))   ||
                (filtroTurno === 'especial' && window.motOutros.includes(mot));

            if (isPeriodoAtual && incluirNoGeral && statusN) {
                pontosDiaGeral += pts;
                somaPontosDiaDaSemana[diaDaSemana] += pts;
            }
        }
        if (isPeriodoAtual) mapGeral[data] = pontosDiaGeral;
    }

    const txtSufixo = window.motOutros.includes(window.motoristaSelecionado) ? ' vg' : ' cx';

    const _set = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };
    _set('statMesAtual',   Math.round(stats.atual)   + txtSufixo);
    _set('statMesPassado', Math.round(stats.passado) + txtSufixo);

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
    const elWinRate = document.getElementById('statWinRate');
    if (elWinRate) {
        elWinRate.innerText = `${winRate}%`;
        const elSub = document.getElementById('statWinRateSub');
        if (elSub) elSub.innerText = `${diasMetaBatidaInd} metas batidas em ${diasTrabalhadosInd} dias úteis`;
    }

    const mediaReal      = diasTrabalhadosInd > 0 ? (somaServicosFisicosReal / diasTrabalhadosInd).toFixed(1) : '0.0';
    const metaDiariaFixa = window.motoristaSelecionado ? window.getMetaDiaria(window.motoristaSelecionado) : 0;
    const elMediaReal    = document.getElementById('statMediaReal');
    if (elMediaReal) {
        elMediaReal.innerText = `${mediaReal} ${txtSufixo}/dia`;
        const metaVisual = window.motOutros.includes(window.motoristaSelecionado)
            ? (metaDiariaFixa / 2) + ' vg'
            : metaDiariaFixa + ' cx';
        const elNec = document.getElementById('statMediaNec');
        if (elNec) elNec.innerText = `SLA pede: ${metaVisual} /dia`;
    }

    const elRecorde = document.getElementById('statRecorde');
    if (elRecorde) {
        elRecorde.innerText = `${maxServicosDiarios} ${txtSufixo}`;
        const elRecordeData = document.getElementById('statRecordeData');
        if (elRecordeData) elRecordeData.innerText = dataRecordeFisico ? `Dia ${formatarDataParaExibicao(dataRecordeFisico)}` : 'Sem registros';
    }

    const melhorDiaChave = Object.keys(somaPontosDiaDaSemana).reduce((a, b) =>
        somaPontosDiaDaSemana[a] > somaPontosDiaDaSemana[b] ? a : b
    );
    const ptsMelhorDia = somaPontosDiaDaSemana[melhorDiaChave];
    const elMelhorDia  = document.getElementById('statMelhorDia');
    if (elMelhorDia) {
        if (ptsMelhorDia > 0 && nomesDias[melhorDiaChave]) {
            elMelhorDia.innerText = nomesDias[melhorDiaChave];
            const elPts = document.getElementById('statMelhorDiaPts');
            if (elPts) elPts.innerText = `${Math.round(ptsMelhorDia)} pts acumulados`;
        } else {
            elMelhorDia.innerText = 'N/A';
            const elPts = document.getElementById('statMelhorDiaPts');
            if (elPts) elPts.innerText = 'Sem dados';
        }
    }

    // Gráficos
    dadosEvolucaoInd.sort((a, b) => new Date(a.dataStr) - new Date(b.dataStr));
    const labelsInd  = dadosEvolucaoInd.map(d => formatarDataParaExibicao(d.dataStr).substring(0, 5));
    const dataInd    = dadosEvolucaoInd.map(d => d.pontos);
    const arrayGeral = Object.keys(mapGeral)
        .map(k => ({ dataStr: k, pontos: mapGeral[k] }))
        .sort((a, b) => new Date(a.dataStr) - new Date(b.dataStr));
    const labelsGeral = arrayGeral.map(d => formatarDataParaExibicao(d.dataStr).substring(0, 5));
    const dataGeral   = arrayGeral.map(d => d.pontos);

    Chart.defaults.font.family = "'Inter', sans-serif";

    const ctxInd = document.getElementById('chartEvolucaoIndividual');
    if (ctxInd) {
        if (window.chartInstanciaInd) window.chartInstanciaInd.destroy();
        window.chartInstanciaInd = new Chart(ctxInd.getContext('2d'), {
            type: 'line',
            data: {
                labels: labelsInd,
                datasets: [{ label: 'Volume', data: dataInd, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.1)', borderWidth: 3, pointBackgroundColor: '#fff', pointBorderColor: '#2563eb', fill: true, tension: 0.3 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } },
        });
    }

    const ctxGeral = document.getElementById('chartEvolucaoGeral');
    if (ctxGeral) {
        if (window.chartInstanciaGeral) window.chartInstanciaGeral.destroy();
        window.chartInstanciaGeral = new Chart(ctxGeral.getContext('2d'), {
            type: 'line',
            data: {
                labels: labelsGeral,
                datasets: [{ label: 'Frota', data: dataGeral, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 3, pointBackgroundColor: '#fff', pointBorderColor: '#10b981', fill: true, tension: 0.3 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } },
        });
    }
};

// =============================================================
// ROTA DO DIA
// =============================================================
window.carregarRotasDia = async function () {
    const dataRota        = document.getElementById('dataRotaDia')?.value || getHojeStr();
    const board           = document.getElementById('rotaDiaBoard');
    const selectMotorista = document.getElementById('rotaMotorista');

    if (!board) return;

    if (selectMotorista) {
        const selecionado = selectMotorista.value;
        selectMotorista.innerHTML = '<option value="">Selecione...</option>';
        window.motoristas.forEach(nome => {
            selectMotorista.innerHTML += `<option value="${nome}">${nome}</option>`;
        });
        if (window.motoristas.includes(selecionado)) selectMotorista.value = selecionado;
    }

    board.innerHTML = '<div class="text-slate-400 font-bold p-4">Carregando rota...</div>';

    const { data, error } = await supabase
        .from('rotas_dia')
        .select('*')
        .eq('data', dataRota)
        .order('ordem',     { ascending: true })
        .order('criado_em', { ascending: true });

    if (error) {
        board.innerHTML = `<div class="text-red-500 font-bold p-4">Erro ao carregar rota: ${error.message}</div>`;
        return;
    }

    window.renderizarRotasDia(data || []);
};

window.renderizarRotasDia = function (rotas) {
    const board = document.getElementById('rotaDiaBoard');
    if (!board) return;

    const porMotorista = {};
    window.motoristas.forEach(nome => { porMotorista[nome] = []; });
    rotas.forEach(rota => {
        if (!porMotorista[rota.motorista_nome]) porMotorista[rota.motorista_nome] = [];
        porMotorista[rota.motorista_nome].push(rota);
    });

    board.innerHTML = '';

    Object.entries(porMotorista).forEach(([motorista, lista]) => {
        const coluna = document.createElement('div');
        coluna.className = 'rota-coluna';

        const servicosHtml = lista.length
            ? lista.map(rota => window.htmlCardRota(rota)).join('')
            : '<div class="rota-vazio">Sem serviços</div>';

        coluna.innerHTML = `
            <div class="rota-coluna-header">
                <strong>${motorista}</strong>
                <span>${lista.length} serviço(s)</span>
            </div>
            <div class="rota-coluna-body">${servicosHtml}</div>
        `;
        board.appendChild(coluna);
    });

    lucide.createIcons();
};

window.htmlCardRota = function (rota) {
    const classeStatus = {
        realizado:     'rota-card-verde',
        carro_quebrado: 'rota-card-vermelho',
        cancelado:     'rota-card-laranja',
    }[rota.status_celula] || 'rota-card-verde';

    const classeTexto = {
        troca:     'rota-fonte-preta',
        colocacao: 'rota-fonte-vermelha',
        retirada:  'rota-fonte-azul',
    }[rota.tipo_texto] || 'rota-fonte-preta';

    const qtd = rota.quantidade  ? `<div class="rota-qtd">${rota.quantidade}</div>`   : '';
    const obs = rota.observacao  ? `<div class="rota-obs">${rota.observacao}</div>`   : '';

    return `
        <div class="rota-card ${classeStatus}">
            <button class="rota-card-delete" onclick="window.excluirServicoRota('${rota.id}')" title="Excluir">
                <i data-lucide="x"></i>
            </button>
            <div class="${classeTexto} rota-descricao">${rota.descricao}</div>
            ${qtd}${obs}
        </div>
    `;
};

window.salvarServicoRota = async function () {
    const dataRota   = document.getElementById('dataRotaDia')?.value || getHojeStr();
    const motorista  = document.getElementById('rotaMotorista')?.value;
    const descricao  = document.getElementById('rotaDescricao')?.value.trim();
    const quantidade = parseFloat(document.getElementById('rotaQuantidade')?.value || '0') || null;
    const statusCelula = document.getElementById('rotaStatus')?.value     || 'realizado';
    const tipoTexto    = document.getElementById('rotaTipoTexto')?.value  || 'troca';
    const observacao   = document.getElementById('rotaObservacao')?.value.trim() || null;

    if (!motorista) { alert('Selecione um motorista.'); return; }
    if (!descricao) { alert('Informe o serviço.');      return; }

    const { error } = await supabase.from('rotas_dia').insert({
        data:          dataRota,
       motorista_nome: motoristaNome.toUpperCase().trim(),
        descricao,
        quantidade,
        status_celula: statusCelula,
        tipo_texto:    tipoTexto,
        observacao,
        ordem:         Date.now(),
    });

    if (error) { alert('Erro ao salvar serviço: ' + error.message); return; }

    document.getElementById('rotaDescricao').value  = '';
    document.getElementById('rotaQuantidade').value = '';
    document.getElementById('rotaObservacao').value = '';

    await window.carregarRotasDia();
};

window.excluirServicoRota = async function (id) {
    if (!confirm('Excluir este serviço da rota?')) return;
    const { error } = await supabase.from('rotas_dia').delete().eq('id', id);
    if (error) { alert('Erro ao excluir serviço: ' + error.message); return; }
    await window.carregarRotasDia();
};

// =============================================================
// AUDITORIA
// =============================================================
window.carregarAuditoriaLancamentos = async function () {
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
        criar:                  'Criou',
        editar:                 'Editou',
        excluir:                'Excluiu',
        excluir_mes_motorista:  'Apagou mês',
        excluir_tudo:           'Apagou tudo',
        importar_ia:            'Importou IA',
    };

    function formatarDataHora(valor) {
        if (!valor) return '-';
        return new Date(valor).toLocaleString('pt-BR');
    }

    function resumoMudanca(item) {
        const antes  = item.dados_antes  || {};
        const depois = item.dados_depois || {};

        if (item.acao === 'criar') {
            return `Qtd: ${depois.quantidade_servicos ?? '-'} | Valor: ${formatarMoeda(Number(depois.valor_faturamento || 0))}`;
        }
        if (item.acao === 'editar') {
            const partes = [];
            if (antes.quantidade_servicos !== depois.quantidade_servicos)
                partes.push(`Qtd: ${antes.quantidade_servicos ?? '-'} → ${depois.quantidade_servicos ?? '-'}`);
            if (Number(antes.valor_faturamento || 0) !== Number(depois.valor_faturamento || 0))
                partes.push(`Valor: ${formatarMoeda(Number(antes.valor_faturamento || 0))} → ${formatarMoeda(Number(depois.valor_faturamento || 0))}`);
            if ((antes.status_servico || '') !== (depois.status_servico || ''))
                partes.push(`Status: ${antes.status_servico || '-'} → ${depois.status_servico || '-'}`);
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
window.processarRestauracaoBackup = function (event) {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;
    alert('Atenção: A função de restaurar backup via arquivo está temporariamente desativada no modo SQL para evitar corrupção de dados.');
    const elInput = document.getElementById('inputRestaurarBackup');
    if (elInput) elInput.value = '';
};

// =============================================================
// MÓDULO: ROTA DO DIA (VISUAL MODERNO)
// =============================================================

// Define o turno padrão
window.turnoPlanilhaAtual = 'todos';

document.addEventListener('DOMContentLoaded', () => {
    const elData = document.getElementById('dataPlanilhaRota');
    if(elData) {
        const dataHoje = new Date();
        const offset = dataHoje.getTimezoneOffset() * 60000;
        elData.value = new Date(dataHoje.getTime() - offset).toISOString().split('T')[0];
    }
});

// Lógica das Abas (Tabs)
window.mudarTurnoPlanilha = function(turno, btnElement) {
    // Tira a cor ativa de todos os botões
    document.querySelectorAll('.tab-turno').forEach(b => {
        b.classList.remove('bg-indigo-50', 'text-indigo-700', 'border-indigo-200');
        b.classList.add('bg-white', 'text-slate-500', 'border-transparent');
    });
    // Bota a cor ativa no botão clicado
    btnElement.classList.remove('bg-white', 'text-slate-500', 'border-transparent');
    btnElement.classList.add('bg-indigo-50', 'text-indigo-700', 'border-indigo-200');

    window.turnoPlanilhaAtual = turno;
    window.carregarPlanilhaRota();
};

window.marcarPlanilhaNaoSalva = function() {
    const btn = document.getElementById('btnSalvarPlanilha');
    if (btn && !btn.innerText.includes("não salvas")) {
        btn.innerHTML = '<i data-lucide="alert-circle" class="w-4 h-4 mr-2"></i> Alterações não salvas *';
        btn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
        btn.classList.add('bg-amber-500', 'hover:bg-amber-600');
        lucide.createIcons();
    }
};

window.carregarPlanilhaRota = async function() {
    const dataStr = document.getElementById('dataPlanilhaRota').value;
    const turno = window.turnoPlanilhaAtual;
    if (!dataStr) return;

    // Pega os motoristas do turno selecionado
    let motoristasTurno = [];
    if (turno === 'dia') motoristasTurno = window.motRayanna || [];
    else if (turno === 'noite') motoristasTurno = window.motJulia || [];
    else if (turno === 'especial') motoristasTurno = window.motOutros || [];
    else motoristasTurno = window.motoristas || []; // 'todos'

    const head = document.getElementById('planilhaHead');
    const body = document.getElementById('planilhaBody');

    // Monta o Cabeçalho Base
    head.innerHTML = `
        <tr>
            <th class="col-fixa-1">#</th>
            <th class="col-fixa-2 text-left">MOTORISTA <i data-lucide="chevrons-up-down" class="w-3 h-3 inline ml-1"></i></th>
            <th>SERVIÇO 1</th>
            <th>SERVIÇO 2</th>
            <th>SERVIÇO 3</th>
            <th>SERVIÇO 4</th>
            <th>SERVIÇO 5</th>
        </tr>
    `;

    try {
        // Busca do banco
        const { data, error } = await window.supabaseClient
            .from('rotas_planilha')
            .select('conteudo_html')
            .eq('data', dataStr)
            .eq('turno', turno)
            .maybeSingle();

        if (error) throw error;

        // Se tem salvo, injeta. Senão, cria a matriz limpa!
        if (data && data.conteudo_html) {
            body.innerHTML = data.conteudo_html;
        } else {
            let htmlNovo = '';
            motoristasTurno.forEach((mot, index) => {
                htmlNovo += `
                <tr>
                    <td class="col-fixa-1">${index + 1}</td>
                    <td class="col-fixa-2">${mot}</td>
                    <td></td><td></td><td></td><td></td><td></td>
                </tr>`;
            });
            body.innerHTML = htmlNovo;
        }

        // Restaura o visual do botão de salvar
        const btn = document.getElementById('btnSalvarPlanilha');
        btn.innerHTML = '<i data-lucide="save" class="w-4 h-4 mr-2"></i> Salvar Planilha';
        btn.classList.remove('bg-amber-500', 'hover:bg-amber-600');
        btn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
        lucide.createIcons();

    } catch (err) {
        console.error("Erro ao carregar planilha:", err);
    }
};

window.salvarPlanilhaRota = async function() {
    const dataStr = document.getElementById('dataPlanilhaRota').value;
    const turno = window.turnoPlanilhaAtual;
    const bodyHtml = document.getElementById('planilhaBody').innerHTML;

    if (!dataStr) return;

    const btn = document.getElementById('btnSalvarPlanilha');
    btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 mr-2 animate-spin"></i> Salvando...';

    try {
        const { error } = await window.supabaseClient
            .from('rotas_planilha')
            .upsert({ data: dataStr, turno: turno, conteudo_html: bodyHtml }, { onConflict: 'data,turno' });

        if (error) throw error;

        btn.innerHTML = '<i data-lucide="check" class="w-4 h-4 mr-2"></i> Salvo!';
        btn.classList.remove('bg-amber-500', 'bg-indigo-600', 'hover:bg-amber-600', 'hover:bg-indigo-700');
        btn.classList.add('bg-emerald-500', 'hover:bg-emerald-600');
        lucide.createIcons();

        setTimeout(() => {
            btn.innerHTML = '<i data-lucide="save" class="w-4 h-4 mr-2"></i> Salvar Planilha';
            btn.classList.remove('bg-emerald-500', 'hover:bg-emerald-600');
            btn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
            lucide.createIcons();
        }, 2500);

    } catch (err) {
        alert("Erro ao salvar: " + err.message);
        btn.innerHTML = '<i data-lucide="save" class="w-4 h-4 mr-2"></i> Tentar Novamente';
    }
};


// ========== CADASTRO DE MOTORISTAS ==========

window.motoristasCache = [];

// Carregar motoristas
window.carregarMotoristas = async function() {
  try {
    const { data, error } = await window.supabaseClient
      .from('motoristas')
      .select('*')
      .order('nome');

    if (error) throw error;
    
    window.motoristasCache = data || [];
    window.motoristas = [];
    window.motRayanna = [];
    window.motJulia = [];
    window.motOutros = [];
    window.motoristasCache.forEach(m => {
  window.motoristas.push(m.nome);
  if (m.turno === 'dia')        window.motRayanna.push(m.nome);
  else if (m.turno === 'noite') window.motJulia.push(m.nome);
  else                          window.motOutros.push(m.nome);
});
window.motoristas.sort();
    window.renderizarTabelaMotoristasModal(data);
    window.atualizarCardsCadastro();
  } catch (err) {
    console.error('Erro:', err);
    alert('Erro ao carregar motoristas: ' + err.message);
  }
};

// Helper: verifica se aniversário está entre 5 dias antes e o dia seguinte
window.isAniversarioProximo = function(dataNasc) {
    if (!dataNasc) return false;
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const [, mes, dia] = dataNasc.split('-').map(Number);
    // Aniversário deste ano
    const aniv = new Date(anoAtual, mes - 1, dia);
    const diffMs = aniv - hoje;
    const diffDias = diffMs / (1000 * 60 * 60 * 24);
    // Janela: -1 dia (já passou hoje) até 5 dias antes
    return diffDias >= -1 && diffDias <= 5;
};

// Helper: verifica se CNH está vencida ou vence hoje
window.isCnhVencida = function(cnhVenc) {
    if (!cnhVenc) return false;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const venc = new Date(cnhVenc + 'T00:00:00');
    return venc <= hoje;
};

// Renderizar tabela
window.renderizarTabelaMotoristasModal = function(motoristas = []) {
  const tbody = document.getElementById('tabelaCadastroMotoristas');
  
  if (!motoristas || motoristas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px; color:#999;">Nenhum motorista cadastrado</td></tr>';
    return;
  }

  // Ativos primeiro, depois inativos/desligados — dentro de cada grupo ordena por nome
  const motoristasOrdenados = [...motoristas].sort((a, b) => {
    const fa = a.status === 'inativo' ? 1 : 0;
    const fb = b.status === 'inativo' ? 1 : 0;
    return fa - fb || a.nome.localeCompare(b.nome);
  });

  tbody.innerHTML = motoristasOrdenados.map(m => {
  const inativo = m.status === 'inativo';
  const nomeUpper = m.nome.toUpperCase().trim();
  const isDesligado = Object.values(window.bancoDadosCloud || {}).some(dia => dia[nomeUpper]?.status === 'desligado');
  const anivProximo = window.isAniversarioProximo(m.data_nascimento);
  const cnhVencida  = window.isCnhVencida(m.cnh_venc);
  return `
  <tr style="border-bottom: 1px solid #e5e7eb; opacity:${inativo ? '0.5' : '1'};">
    <td style="padding:12px; color:#1f2937;">
      ${m.nome}
      ${inativo ? '<span style="font-size:11px; background:#fee2e2; color:#dc2626; padding:2px 6px; border-radius:4px; margin-left:6px;">Inativo</span>' : ''}
      ${isDesligado && !inativo ? '<span style="font-size:11px; background:#fecaca; color:#991b1b; padding:2px 6px; border-radius:4px; margin-left:6px;">Desligado</span>' : ''}
    </td>
    <td style="text-align:center; padding:12px; text-transform:capitalize;">${m.turno === 'dia' ? '☀️' : m.turno === 'noite' ? '🌙' : '🚛'} ${m.turno}</td>
    <td style="text-align:center; padding:12px; ${anivProximo ? 'color:#16a34a; font-weight:500;' : ''}">${m.data_nascimento ? new Date(m.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
    <td style="text-align:center; padding:12px; ${cnhVencida ? 'color:#dc2626; font-weight:500;' : ''}">${m.cnh_venc ? new Date(m.cnh_venc + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
    <td style="text-align:center; padding:12px;">${m.tamanho_epi || '—'}</td>
    <td style="text-align:center; padding:12px;">
      <button onclick="window.abrirModalEditarMotorista('${m.nome}')" style="background:none; border:none; cursor:pointer; color:#0ea5e9;">✏️</button>
      <button onclick="window.toggleStatusMotorista('${m.nome}', '${m.status}')" 
        style="background:none; border:none; cursor:pointer; font-size:15px;" 
        title="${inativo ? 'Reativar' : 'Desativar'}">
        ${inativo ? '✅' : '🚫'}
      </button>
      <button onclick="this.closest('tr').nextElementSibling.style.display = this.closest('tr').nextElementSibling.style.display === 'none' ? 'table-row' : 'none'" style="background:none; border:none; cursor:pointer; font-size:16px; color:#6366f1;">+</button>
    </td>
  </tr>
  <tr style="display:none; background:#f8fafc;">
    <td colspan="5" style="padding:12px 20px;">
      <div style="display:grid; grid-template-columns: repeat(3,1fr); gap:8px; font-size:13px; color:#374151;">
        <div><b>CPF:</b> ${m.cpf || '—'}</div>
        <div><b>Telefone:</b> ${m.telefone || '—'}</div>
        <div><b style="color:var(--brand-600);">PIX:</b> ${m.chave_pix || '—'}</div>
        <div><b>CNH:</b> ${m.cnh || '—'}</div>
        <div><b>Admissão:</b> ${m.data_admissao ? new Date(m.data_admissao + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</div>
        <div><b>Demissão:</b> ${m.data_demissao ? new Date(m.data_demissao + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</div>
        <div><b>Observação:</b> ${m.observacao || '—'}</div>
      </div>
    </td>
  </tr>
  `;
}).join('');
  
  document.getElementById('totalCadastrados').textContent = `Total: ${motoristas.length} motorista(s)`;
};

// Salvar novo motorista
window.salvarCadastroMotorista = async function() {
  const nome = document.getElementById('cadNome').value.trim().toUpperCase();
  const turno = document.getElementById('cadTurno').value;
  const cpf = document.getElementById('cadCpf')?.value?.trim() || null;
const telefone = document.getElementById('cadTelefone')?.value?.trim() || null;
const chavePix = document.getElementById('cadChavePix')?.value?.trim() || null;
const cnh = document.getElementById('cadCnh')?.value || null;
const cnh_venc = document.getElementById('cadCnhVenc')?.value || null;
const nascimento = document.getElementById('cadNascimento')?.value || null;
const admissao = document.getElementById('cadAdmissao')?.value || null;
const demissao = document.getElementById('cadDemissao')?.value || null;
const obs = document.getElementById('cadObs')?.value?.trim() || null;
const epi = [
  document.getElementById('cadEpiCamisaNum')?.value ? `Camisa:${document.getElementById('cadEpiCamisaNum').value}` : '',
  document.getElementById('cadEpiBotaNum')?.value   ? `Bota:${document.getElementById('cadEpiBotaNum').value}`   : '',
  document.getElementById('cadEpiCalcaNum')?.value  ? `Calça:${document.getElementById('cadEpiCalcaNum').value}`  : ''
].filter(Boolean).join(' | ') || null;

  if (!nome || !turno) {
    alert('❌ Nome e Turno são obrigatórios!');
    return;
  }

  const btn = document.getElementById('btnCadastrarMotorista');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

  try {
    const { error } = await window.supabaseClient
      .from('motoristas')
      .insert([{
        nome, turno, cpf, telefone, chave_pix: chavePix, cnh,
        cnh_venc, data_nascimento: nascimento, data_admissao: admissao, data_demissao: demissao,
        tamanho_epi: epi, observacao: obs, status: 'ativo'
      }]);

    if (error) throw error;

    alert('✅ Motorista cadastrado com sucesso!');

    ['cadNome','cadCpf','cadTelefone','cadChavePix','cadCnhVenc','cadNascimento','cadAdmissao','cadDemissao','cadObs'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('cadTurno').value = 'dia';
    document.getElementById('cadCnh').value = '';
    document.getElementById('cadEpiCamisaNum').value = '';
    document.getElementById('cadEpiBotaNum').value = '';
    document.getElementById('cadEpiCalcaNum').value = '';

    window.carregarMotoristas();
  } catch (err) {
    alert('❌ Erro ao salvar: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="user-plus" style="width:16px;height:16px;display:inline;margin-right:6px;"></i>Cadastrar Motorista';
      lucide.createIcons();
    }
  }
};

// Função para calcular e atualizar os cards superiores do Cadastro
window.atualizarCardsCadastro = function() {
  const total = window.motoristasCache.length;
  const inativos = window.motoristasCache.filter(m => m.status === 'inativo').length;
  const ativos = total - inativos;

  const percAtivos = total > 0 ? Math.round((ativos / total) * 100) : 0;
  const percInativos = total > 0 ? Math.round((inativos / total) * 100) : 0;

  // Atualiza o Total
  const elTotal = document.getElementById('totalMotoristas');
  if (elTotal) elTotal.innerText = total;
  
  const elTotalMes = document.getElementById('motoristasMes');
  if (elTotalMes) elTotalMes.innerText = 'Cadastrados no sistema';

  // Atualiza os Ativos
  const elAtivosValor = document.getElementById('motoristasAtivos');
  if (elAtivosValor) elAtivosValor.innerText = ativos;
  
  const elAtivosPerc = document.getElementById('percentualAtivos');
  if (elAtivosPerc) elAtivosPerc.innerText = `${percAtivos}% da frota`;

  // Atualiza os Inativos
  const elInativosValor = document.getElementById('motoristasInativos');
  if (elInativosValor) elInativosValor.innerText = inativos;
  
  const elInativosPerc = document.getElementById('percentualInativos');
  if (elInativosPerc) elInativosPerc.innerText = `${percInativos}% da frota`;
};


// Abrir modal de edição
window.abrirModalEditarMotorista = async function(nome) {
  const motorista = window.motoristasCache.find(m => m.nome === nome);
  
  if (!motorista) {
    alert('Motorista não encontrado');
    return;
  }

  document.getElementById('editNomeOriginal').value = motorista.nome;
  document.getElementById('editNome').value = motorista.nome;
  document.getElementById('editTurno').value = motorista.turno;
  document.getElementById('editCpf').value = motorista.cpf || '';
  document.getElementById('editTelefone').value = motorista.telefone || '';
  const elPix = document.getElementById('editChavePix');
  if(elPix) elPix.value = motorista.chave_pix || '';
  document.getElementById('editCnh').value = motorista.cnh || '';
  document.getElementById('editCnhVenc').value = motorista.cnh_venc || '';
document.getElementById('editNascimento').value = motorista.data_nascimento || '';
document.getElementById('editAdmissao').value = motorista.data_admissao || '';
document.getElementById('editDemissao').value = motorista.data_demissao || '';
const epiParts = (motorista.tamanho_epi || '').split(' | ');
document.getElementById('editEpiCamisa').value = (epiParts[0] || '').replace('Camisa:', '');
document.getElementById('editEpiBota').value   = (epiParts[1] || '').replace('Bota:', '');
document.getElementById('editEpiCalca').value  = (epiParts[2] || '').replace('Calça:', '');
  document.getElementById('editObs').value = motorista.observacao || '';

  document.getElementById('modalEditarMotorista').classList.remove('hidden');
};

window.fecharModalEditar = function() {
  document.getElementById('modalEditarMotorista').classList.add('hidden');
};

// Salvar edição
window.salvarEdicaoMotorista = async function() {
  const nomeOriginal = document.getElementById('editNomeOriginal').value;
  const novoNome = document.getElementById('editNome').value.trim().toUpperCase();
  const turno = document.getElementById('editTurno').value;
  const cpf = document.getElementById('editCpf').value;
  const telefone = document.getElementById('editTelefone').value;
  const elPix = document.getElementById('editChavePix');
  const chavePix = elPix ? elPix.value.trim() : null;
  const cnh = document.getElementById('editCnh').value;
const cnh_venc = document.getElementById('editCnhVenc').value || null;
const nascimento = document.getElementById('editNascimento').value || null;
const admissao = document.getElementById('editAdmissao').value || null;
const demissao = document.getElementById('editDemissao').value || null;
const epi = [
    document.getElementById('editEpiCamisa').value ? `Camisa:${document.getElementById('editEpiCamisa').value}` : '',
    document.getElementById('editEpiBota').value   ? `Bota:${document.getElementById('editEpiBota').value}`     : '',
    document.getElementById('editEpiCalca').value  ? `Calça:${document.getElementById('editEpiCalca').value}`   : ''
].filter(Boolean).join(' | ') || null;
  const obs = document.getElementById('editObs').value;

  try {
    const { error } = await window.supabaseClient
      .from('motoristas')
      .update({
        nome: novoNome,
        turno,
        cpf,
        telefone,
        chave_pix: chavePix,
        cnh,
        cnh_venc,
        data_nascimento: nascimento,
        data_admissao: admissao,
        data_demissao: demissao,
        tamanho_epi: epi,
        observacao: obs
      })
      .eq('nome', nomeOriginal);

    if (error) throw error;

    alert('✅ Motorista atualizado!');
    window.fecharModalEditar();
    window.carregarMotoristas();
  } catch (err) {
    alert('❌ Erro ao editar: ' + err.message);
  }
};

window.filtrarTabelaCadastro = function() {
  const busca = document.getElementById('buscaCadastro').value.toUpperCase();
  const turno = document.getElementById('filtroCadTurno').value;

  let motoristas = window.motoristasCache;

  if (busca) motoristas = motoristas.filter(m => m.nome.includes(busca));
  if (turno) motoristas = motoristas.filter(m => m.turno === turno);

  window.renderizarTabelaMotoristasModal(motoristas);
};

window.toggleStatusMotorista = async function(nome, statusAtual) {
  const novoStatus = statusAtual === 'inativo' ? 'ativo' : 'inativo';
  const acao = novoStatus === 'inativo' ? 'desativar' : 'reativar';
  if (!confirm(`Deseja ${acao} o motorista ${nome}?`)) return;

  const { error } = await window.supabaseClient
    .from('motoristas')
    .update({ status: novoStatus })
    .eq('nome', nome);

  if (error) { alert('Erro: ' + error.message); return; }

  window.carregarMotoristas();
  // recarrega frota/meta também
  if (window.carregarDados) window.carregarDados();
};
window.exportarPdfDomFeriados = function () {
    const bancoDados = window.bancoDadosCloud;
    const domInicio = document.getElementById('dataDomInicio')?.value;
    const domFim    = document.getElementById('dataDomFim')?.value;
    const ferInicio = document.getElementById('dataFerInicio')?.value;
    const ferFim    = document.getElementById('dataFerFim')?.value;

    let registrosDom = [], registrosFer = [];
    let fatTotalDom = 0, fatTotalFer = 0;

    for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
    const dataObj   = new Date(dataStr + 'T00:00:00');
    const isDomingo = dataObj.getDay() === 0;
    for (const [mot, dados] of Object.entries(dadosDia)) {
        const trabalhou = dados.servicos > 0;
        const temStatus = dados.status && dados.status !== 'normal';
        // Ignora dias sem nenhum dado relevante
        if (!trabalhou && !temStatus && !isDomingo && !dados.isFeriado) continue;

        const obj = {
            dataStr,
            nome:    mot,
            caixas:  dados.tipoVeiculo !== 'cacamba' ? dados.servicos : 0,
            viagens: dados.tipoVeiculo === 'cacamba' ? dados.servicos : 0,
            valor:   dados.valor || 0,
            valorExtra: dados.valorExtra || 0,
            trabalhou,
            status:  dados.status || 'normal',
        };
        if (isDomingo && !dados.isFeriado) {
            if (!domInicio || !domFim || dataEstaNoIntervalo(dataStr, domInicio, domFim)) {
                registrosDom.push(obj);
                fatTotalDom += obj.valor;
            }
        }
        if (dados.isFeriado) {
            if (!ferInicio || !ferFim || dataEstaNoIntervalo(dataStr, ferInicio, ferFim)) {
                registrosFer.push(obj);
                fatTotalFer += obj.valor;
            }
        }
    }
}

    const ordenar = (lista) => lista.sort((a, b) => a.nome.localeCompare(b.nome) || new Date(a.dataStr) - new Date(b.dataStr));
    ordenar(registrosDom);
    ordenar(registrosFer);

    const fmt     = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const fmtData = (s) => { const [y, m, d] = s.split('-'); return d + '/' + m + '/' + y; };

    function gerarTabela(lista, total) {
    if (lista.length === 0) return '<p style="color:#888;font-style:italic;">Nenhum registro no período.</p>';

    // Agrupa por motorista
    const porMot = {};
    lista.forEach(function(r) {
        if (!porMot[r.nome]) porMot[r.nome] = [];
        porMot[r.nome].push(r);
    });

    let html = '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
    html += '<thead><tr style="background:#f1f5f9;">'
          + '<th style="text-align:left;padding:7px 10px;border:1px solid #ddd;">Motorista</th>'
          + '<th style="padding:7px 10px;border:1px solid #ddd;">Data</th>'
          + '<th style="padding:7px 10px;border:1px solid #ddd;">Qtd</th>'
          + '<th style="padding:7px 10px;border:1px solid #ddd;">Valor</th>'
          + '</tr></thead><tbody>';

    Object.entries(porMot).forEach(function([nome, registros]) {
        let subtotal = 0;
        registros.forEach(function(r, i) {
            subtotal += r.valor || 0;
            const isFirst = i === 0;
            const qtd = r.caixas > 0 ? (r.caixas + ' cx') : (r.viagens + ' vg');
            const obs = r.valorExtra > 0
                ? '<br><span style="font-size:11px;color:#7c3aed;font-weight:600;">Extra: ' + fmt(r.valorExtra) + '</span>'
                : '';
            html += '<tr style="background:' + (isFirst ? '#f8fafc' : '#fff') + ';">'
                  + '<td style="padding:6px 10px;border:1px solid #ddd;font-weight:' + (isFirst ? '700' : '400') + ';color:' + (isFirst ? '#1e293b' : '#475569') + ';">' + (isFirst ? nome : '') + '</td>'
                  + '<td style="padding:6px 10px;border:1px solid #ddd;text-align:center;">' + fmtData(r.dataStr) + '</td>'
                  + '<td style="padding:6px 10px;border:1px solid #ddd;text-align:center;">' + qtd + '</td>'
                  + '<td style="padding:6px 10px;border:1px solid #ddd;text-align:right;color:#dc2626;font-weight:600;">' + fmt(r.valor) + obs + '</td>'
                  + '</tr>';
        });
        // Linha de subtotal por motorista
        html += '<tr style="background:#fef9c3;">'
              + '<td colspan="3" style="padding:5px 10px;border:1px solid #ddd;text-align:right;font-weight:700;color:#92400e;font-size:12px;">Subtotal ' + nome + ':</td>'
              + '<td style="padding:5px 10px;border:1px solid #ddd;text-align:right;font-weight:700;color:#92400e;">' + fmt(subtotal) + '</td>'
              + '</tr>';
    });

    html += '</tbody><tfoot><tr>'
          + '<td colspan="3" style="padding:8px 10px;border:1px solid #ddd;text-align:right;font-weight:700;">Total Geral:</td>'
          + '<td style="padding:8px 10px;border:1px solid #ddd;text-align:right;font-weight:700;color:#dc2626;">' + fmt(total) + '</td>'
          + '</tr></tfoot></table>';
    return html;
}

    const periodoDom = (domInicio && domFim) ? (fmtData(domInicio) + ' – ' + fmtData(domFim)) : 'Todo o período';
    const periodoFer = (ferInicio && ferFim)  ? (fmtData(ferInicio) + ' – ' + fmtData(ferFim)) : 'Todo o período';

    const conteudo = '<html><head><meta charset="UTF-8">'
        + '<style>body{font-family:Arial,sans-serif;padding:30px;color:#1e293b;}'
        + 'h1{font-size:20px;margin-bottom:4px;}'
        + 'h2{font-size:15px;margin:28px 0 10px;color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:6px;}'
        + '.sub{font-size:12px;color:#64748b;margin-bottom:20px;}</style>'
        + '</head><body>'
        + '<h1>Domingos &amp; Feriados — Relatório RH</h1>'
        + '<div class="sub">Gerado em ' + new Date().toLocaleString('pt-BR') + '</div>'
        + '<h2>☀️ Domingos <span style="font-size:12px;font-weight:400;color:#64748b;">(' + periodoDom + ')</span></h2>'
        + gerarTabela(registrosDom, fatTotalDom)
        + '<h2 style="margin-top:36px;">🎉 Feriados <span style="font-size:12px;font-weight:400;color:#64748b;">(' + periodoFer + ')</span></h2>'
        + gerarTabela(registrosFer, fatTotalFer)
        + '<div style="margin-top:24px;padding:12px 16px;background:#f1f5f9;border-radius:8px;text-align:right;font-size:15px;font-weight:700;">Total Geral: <span style="color:#dc2626;">' + fmt(fatTotalDom + fatTotalFer) + '</span></div>'
        + '</body></html>';

    const win = window.open('', '_blank');
    win.document.write(conteudo);
    win.document.close();
    win.print();
};
// ─── RELATÓRIO DE FALTAS / ATESTADOS ───────────────────────────────────────

window.popularSelectFaltas = function () {
    const sel = document.getElementById('filtroFaltasMot');
    if (!sel) return;
    const atual = sel.value;
    sel.innerHTML = '<option value="todos">Todos os Motoristas</option>';
    (window.motoristas || []).forEach(m => {
        const opt = document.createElement('option');
        opt.value = m; opt.textContent = m;
        sel.appendChild(opt);
    });
    if (atual) sel.value = atual;
};

window.renderizarRelatorioFaltas = function () {
    const banco   = window.bancoDadosCloud || {};
    const motFilt = document.getElementById('filtroFaltasMot')?.value || 'todos';
    const inicio  = document.getElementById('filtroFaltasInicio')?.value || '';
    const fim     = document.getElementById('filtroFaltasFim')?.value || '';
    const cont    = document.getElementById('tabelaFaltasContainer');
    if (!cont) return;

    const fmtD = s => { const [y,m,d] = s.split('-'); return d+'/'+m+'/'+y; };
    const statusLabel = { falta:'Falta', atestado:'Atestado', folga:'Folga',
        polioff:'Poli OFF', licenca:'Férias', desligado:'Desligado' };
    const statusColor = { falta:'#dc2626', atestado:'#d97706', folga:'#64748b',
        polioff:'#ea580c', licenca:'#7c3aed', desligado:'#991b1b' };

    // Coleta registros com falta ou atestado (dias úteis — seg a sáb)
    const registros = [];
    for (const [dataStr, dadosDia] of Object.entries(banco)) {
        const dataObj = new Date(dataStr + 'T00:00:00');
        const dow = dataObj.getDay();
        if (dow === 0) continue; // ignora domingos aqui
        if (inicio && dataStr < inicio) continue;
        if (fim    && dataStr > fim)    continue;
        for (const [mot, dados] of Object.entries(dadosDia)) {
            if (motFilt !== 'todos' && mot !== motFilt) continue;
            if (!dados.status || dados.status === 'normal') continue;
            registros.push({ dataStr, mot, dados });
        }
    }
    registros.sort((a, b) => a.mot.localeCompare(b.mot) || a.dataStr.localeCompare(b.dataStr));

    if (registros.length === 0) {
        cont.innerHTML = '<p style="color:#94a3b8;font-style:italic;">Nenhum registro de falta ou atestado no período.</p>';
        return;
    }

    let html = '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
    html += '<thead><tr style="background:#f1f5f9;">'
        + '<th style="text-align:left;padding:8px 10px;border:1px solid #ddd;">Motorista</th>'
        + '<th style="padding:8px 10px;border:1px solid #ddd;">Data</th>'
        + '<th style="padding:8px 10px;border:1px solid #ddd;">Status</th>'
        + '<th style="padding:8px 10px;border:1px solid #ddd;">Observação</th>'
        + '<th style="padding:8px 10px;border:1px solid #ddd;">Anexo</th>'
        + '</tr></thead><tbody>';

    let nomePrev = '';
    registros.forEach(function(r) {
        const isNovo = r.mot !== nomePrev;
        if (isNovo) nomePrev = r.mot;
        const label = statusLabel[r.dados.status] || r.dados.status;
        const cor   = statusColor[r.dados.status] || '#475569';
        const obs   = r.dados.observacao || '—';
        const anexo = r.dados.anexoUrl
            ? `<a href="${r.dados.anexoUrl}" target="_blank" style="color:#2563eb;font-weight:600;text-decoration:underline;">Ver anexo</a>`
            : '<span style="color:#94a3b8;font-style:italic;">Não anexado</span>';

        html += '<tr style="background:' + (isNovo ? '#f8fafc' : '#fff') + ';">'
            + '<td style="padding:6px 10px;border:1px solid #ddd;font-weight:' + (isNovo?'700':'400') + ';color:' + (isNovo?'#1e293b':'#475569') + ';">' + (isNovo ? r.mot : '') + '</td>'
            + '<td style="padding:6px 10px;border:1px solid #ddd;text-align:center;">' + fmtD(r.dataStr) + '</td>'
            + '<td style="padding:6px 10px;border:1px solid #ddd;text-align:center;"><span style="background:' + cor + ';color:#fff;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700;">' + label + '</span></td>'
            + '<td style="padding:6px 10px;border:1px solid #ddd;font-size:12px;color:#475569;max-width:200px;">' + obs + '</td>'
            + '<td style="padding:6px 10px;border:1px solid #ddd;text-align:center;">' + anexo + '</td>'
            + '</tr>';
    });
    html += '</tbody></table>';
    cont.innerHTML = html;
};

window.exportarPdfFaltasAtestados = function (tipo) {
    const banco   = window.bancoDadosCloud || {};
    const motFilt = document.getElementById('filtroFaltasMot')?.value || 'todos';
    const inicio  = document.getElementById('filtroFaltasInicio')?.value || '';
    const fim     = document.getElementById('filtroFaltasFim')?.value || '';

    const fmtD = s => { const [y,m,d] = s.split('-'); return d+'/'+m+'/'+y; };
    const fmt  = v => (v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const statusLabel = { falta:'Falta', atestado:'Atestado', folga:'Folga',
        polioff:'Poli OFF', ferias:'Férias', desligado:'Desligado' };
    const statusColor = { falta:'#dc2626', atestado:'#d97706', folga:'#64748b',
        polioff:'#ea580c', ferias:'#7c3aed', desligado:'#991b1b' };

    const tiposFiltro = tipo === 'todos' ? ['falta','atestado','folga','polioff','ferias','desligado']
        : tipo === 'falta'    ? ['falta']
        : ['atestado'];

    const registros = [];
    for (const [dataStr, dadosDia] of Object.entries(banco)) {
        const dataObj = new Date(dataStr + 'T00:00:00');
        if (dataObj.getDay() === 0) continue;
        if (inicio && dataStr < inicio) continue;
        if (fim    && dataStr > fim)    continue;
        for (const [mot, dados] of Object.entries(dadosDia)) {
            if (motFilt !== 'todos' && mot !== motFilt) continue;
            if (!dados.status || !tiposFiltro.includes(dados.status)) continue;
            registros.push({ dataStr, mot, dados });
        }
    }
    registros.sort((a, b) => a.mot.localeCompare(b.mot) || a.dataStr.localeCompare(b.dataStr));

    const titulos = { falta:'Relatório de Faltas', atestado:'Relatório de Atestados', todos:'Relatório de Faltas e Atestados' };
    const periodoTxt = (inicio && fim) ? (fmtD(inicio) + ' a ' + fmtD(fim)) : 'Todo o período';
    const motTxt = motFilt === 'todos' ? 'Todos os motoristas' : motFilt;

    let linhas = '';
    if (registros.length === 0) {
        linhas = '<tr><td colspan="5" style="padding:16px;text-align:center;color:#94a3b8;font-style:italic;">Nenhum registro encontrado.</td></tr>';
    } else {
        let nomePrev = '';
        registros.forEach(function(r) {
            const isNovo = r.mot !== nomePrev;
            if (isNovo) nomePrev = r.mot;
            const label = statusLabel[r.dados.status] || r.dados.status;
            const cor   = statusColor[r.dados.status] || '#475569';
            const obs   = r.dados.observacao || '—';
            const anexoTxt = r.dados.anexoUrl
                ? `<a href="${r.dados.anexoUrl}" style="color:#2563eb;">Ver anexo</a>`
                : '<span style="color:#94a3b8;font-style:italic;">Não anexado</span>';
            linhas += '<tr style="background:' + (isNovo ? '#f8fafc' : '#fff') + ';">'
                + '<td style="padding:6px 10px;border:1px solid #ddd;font-weight:' + (isNovo?'700':'400') + ';">' + (isNovo ? r.mot : '') + '</td>'
                + '<td style="padding:6px 10px;border:1px solid #ddd;text-align:center;">' + fmtD(r.dataStr) + '</td>'
                + '<td style="padding:6px 10px;border:1px solid #ddd;text-align:center;"><span style="background:' + cor + ';color:#fff;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">' + label + '</span></td>'
                + '<td style="padding:6px 10px;border:1px solid #ddd;font-size:12px;color:#475569;">' + obs + '</td>'
                + '<td style="padding:6px 10px;border:1px solid #ddd;text-align:center;">' + anexoTxt + '</td>'
                + '</tr>';
        });
    }

    const conteudo = `<html><head><meta charset="UTF-8">
<style>
body{font-family:Arial,sans-serif;padding:30px;color:#1e293b;}
h1{font-size:20px;margin-bottom:4px;}
.sub{font-size:12px;color:#64748b;margin-bottom:20px;}
table{width:100%;border-collapse:collapse;font-size:13px;}
th{background:#f1f5f9;padding:8px 10px;border:1px solid #ddd;text-align:center;}
th:first-child{text-align:left;}
</style></head><body>
<h1>${titulos[tipo]}</h1>
<div class="sub">
    Período: ${periodoTxt} &nbsp;|&nbsp; Motorista: ${motTxt}<br>
    Gerado em ${new Date().toLocaleString('pt-BR')}
</div>
<table>
<thead><tr>
<th style="text-align:left;">Motorista</th>
<th>Data</th><th>Status</th><th>Observação</th><th>Anexo</th>
</tr></thead>
<tbody>${linhas}</tbody>
</table>
</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(conteudo);
    win.document.close();
    win.print();
};

// ========== CAMINHÕES ==========

window.caminhoesCache = [];

window.carregarCaminhoes = async function() {
    try {
        // Garante o cache de motoristas
        if (!window.motoristasCache || window.motoristasCache.length === 0) {
            const { data: mots } = await window.supabaseClient
                .from('motoristas')
                .select('*')
                .eq('status', 'ativo')
                .order('nome');
            window.motoristasCache = mots || [];
        }

        const { data, error } = await window.supabaseClient
            .from('caminhoes')
            .select('*')
            .order('placa');
        if (error) throw error;

        window.caminhoesCache = data || [];
        window.renderizarTabelaCaminhoes(window.caminhoesCache);
        window.popularSelectMotoristaCaminhao();

        const total = data.length;
        const ativos = data.filter(c => c.status === 'ativo').length;
        document.getElementById('totalCaminhoes').textContent = total;
        document.getElementById('totalCaminhoesAtivos').textContent = ativos;
        document.getElementById('totalCaminhoesInativos').textContent = total - ativos;

        if (window.lucide) window.lucide.createIcons();
    } catch (err) {
        console.error('Erro ao carregar caminhões:', err);
        alert('Erro ao carregar caminhões: ' + err.message);
    }
};

window.renderizarTabelaCaminhoes = function(lista = []) {
    const tbody = document.getElementById('tabelaCaminhoes');
    if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:#999;">Nenhum caminhão cadastrado</td></tr>';
        return;
    }
    const badgeStatus = { ativo: '#16a34a', manutencao: '#d97706', inativo: '#dc2626' };
    const labelStatus = { ativo: 'Ativo', manutencao: 'Manutenção', inativo: 'Inativo' };
    tbody.innerHTML = lista.map(c => `
        <tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:12px;font-weight:600;color:var(--gray-100);">${c.placa}</td>
            <td style="padding:12px;color:var(--gray-300);">${c.modelo || '—'} ${c.ano ? '(' + c.ano + ')' : ''}</td>
            <td style="padding:12px;text-align:center;">
                <span style="background:${badgeStatus[c.status] || '#64748b'};color:#fff;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;">
                    ${labelStatus[c.status] || c.status}
                </span>
            </td>
            <td style="padding:12px;color:var(--gray-300);">${c.motorista_fixo || '—'}</td>
            <td style="padding:12px;text-align:center;">
                ${c.doc_url
                    ? `<a href="${c.doc_url}" target="_blank" title="${c.doc_nome || 'Ver documento'}" style="color:#0ea5e9;font-size:18px;">📄</a>`
                    : '<span style="color:#64748b;font-size:12px;">—</span>'}
            </td>
            <td style="padding:12px;text-align:center;">
                <button onclick="window.editarCaminhao('${c.id}')" style="background:none;border:none;cursor:pointer;color:#0ea5e9;font-size:16px;" title="Editar">✏️</button>
                <button onclick="window.excluirCaminhao('${c.id}')" style="background:none;border:none;cursor:pointer;color:#dc2626;font-size:16px;" title="Excluir">🗑️</button>
            </td>
        </tr>
    `).join('');
};

window.popularSelectMotoristaCaminhao = function() {
    const sel = document.getElementById('cadCamMotoristaFixo');
    if (!sel) return;
    const atual = sel.value;
    const ativos = (window.motoristasCache || []).filter(m => m.status === 'ativo');
    sel.innerHTML = '<option value="">— Nenhum —</option>'
        + ativos.map(m => `<option value="${m.nome}" ${m.nome === atual ? 'selected' : ''}>${m.nome}</option>`).join('');
};

window.salvarCaminhao = async function() {
    const placa = document.getElementById('cadCamPlaca').value.trim().toUpperCase();
    if (!placa) return alert('Placa é obrigatória.');

    const id      = document.getElementById('cadCamId').value;
    const modelo  = document.getElementById('cadCamModelo').value.trim();
    const ano     = document.getElementById('cadCamAno').value || null;
    const status  = document.getElementById('cadCamStatus').value;
    const moto    = document.getElementById('cadCamMotoristaFixo').value;
    const obs     = document.getElementById('cadCamObs').value.trim();
    const arquivo = document.getElementById('cadCamDoc').files[0];
    const btn     = document.getElementById('btnSalvarCaminhao');
    btn.disabled  = true;
    btn.textContent = 'Salvando...';

    try {
        let doc_url  = id ? (window.caminhoesCache.find(c => c.id === id)?.doc_url || null) : null;
        let doc_nome = id ? (window.caminhoesCache.find(c => c.id === id)?.doc_nome || null) : null;

        // Upload do arquivo se houver
        if (arquivo) {
            const ext  = arquivo.name.split('.').pop();
            const path = `caminhoes/${placa}_${Date.now()}.${ext}`;
            const { error: upErr } = await window.supabaseClient.storage
                .from('caminhoes-docs')
                .upload(path, arquivo, { upsert: true });
            if (upErr) throw upErr;
            const { data: urlData } = window.supabaseClient.storage
                .from('caminhoes-docs')
                .getPublicUrl(path);
            doc_url  = urlData.publicUrl;
            doc_nome = arquivo.name;
        }

        const payload = { placa, modelo, ano: ano ? parseInt(ano) : null, status, motorista_fixo: moto || null, doc_url, doc_nome, obs };

        let erro;
        if (id) {
            ({ error: erro } = await window.supabaseClient.from('caminhoes').update(payload).eq('id', id));
        } else {
            ({ error: erro } = await window.supabaseClient.from('caminhoes').insert(payload));
        }
        if (erro) throw erro;

        window.limparFormCaminhao();
        await window.carregarCaminhoes();
    } catch (err) {
        alert('Erro ao salvar: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="save" style="width:16px;height:16px;"></i> Salvar Caminhão';
        if (window.lucide) window.lucide.createIcons();
    }
};

window.editarCaminhao = function(id) {
    const c = window.caminhoesCache.find(x => x.id === id);
    if (!c) return;
    document.getElementById('cadCamId').value            = c.id;
    document.getElementById('cadCamPlaca').value         = c.placa;
    document.getElementById('cadCamModelo').value        = c.modelo || '';
    document.getElementById('cadCamAno').value           = c.ano || '';
    document.getElementById('cadCamStatus').value        = c.status || 'ativo';
    document.getElementById('cadCamObs').value           = c.obs || '';
    document.getElementById('labelFormCaminhao').textContent = 'Editar Caminhão';
    document.getElementById('btnSalvarCaminhao').innerHTML = '<i data-lucide="save" style="width:16px;height:16px;"></i> Atualizar Caminhão';
    // Motorista fixo
    window.popularSelectMotoristaCaminhao();
    document.getElementById('cadCamMotoristaFixo').value = c.motorista_fixo || '';
    // Mostra doc atual
    const docDiv = document.getElementById('docAtualCaminhao');
    docDiv.innerHTML = c.doc_url ? `Doc atual: <a href="${c.doc_url}" target="_blank" style="color:#0ea5e9;">${c.doc_nome || 'Ver'}</a>` : '';
    if (window.lucide) window.lucide.createIcons();
    // Scroll pro form
    document.getElementById('cadCamPlaca').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.excluirCaminhao = async function(id) {
    if (!confirm('Excluir este caminhão? Esta ação não pode ser desfeita.')) return;
    const { error } = await window.supabaseClient.from('caminhoes').delete().eq('id', id);
    if (error) return alert('Erro ao excluir: ' + error.message);
    await window.carregarCaminhoes();
};

window.limparFormCaminhao = function() {
    ['cadCamId','cadCamPlaca','cadCamModelo','cadCamAno','cadCamObs'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('cadCamStatus').value = 'ativo';
    document.getElementById('cadCamMotoristaFixo').value = '';
    document.getElementById('cadCamDoc').value = '';
    document.getElementById('docAtualCaminhao').innerHTML = '';
    document.getElementById('labelFormCaminhao').textContent = 'Novo Caminhão';
    document.getElementById('btnSalvarCaminhao').innerHTML = '<i data-lucide="save" style="width:16px;height:16px;"></i> Salvar Caminhão';
    if (window.lucide) window.lucide.createIcons();
};

window.filtrarTabelaCaminhoes = function() {
    const busca = document.getElementById('buscaCaminhao').value.toLowerCase();
    const filtrada = window.caminhoesCache.filter(c =>
        c.placa.toLowerCase().includes(busca) ||
        (c.modelo || '').toLowerCase().includes(busca)
    );
    window.renderizarTabelaCaminhoes(filtrada);
};