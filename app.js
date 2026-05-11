import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCchiBta11qw0ZaXGtJed6fcOTQbye2r8c",
    authDomain: "metas-de-motorista.firebaseapp.com",
    projectId: "metas-de-motorista",
    storageBucket: "metas-de-motorista.firebasestorage.app",
    messagingSenderId: "754155461930",
    appId: "1:754155461930:web:481fe9861a17ef444dd253"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const docRef = doc(db, "sistema", "dados_logistica");

// Listas base originais
const motRayannaBase = ["ADRIELSON", "EMERSON", "JACKSON", "JAMERSON", "JOAO VICTOR", "JOELITON", "JONES", "LUIZ RODRIGUES", "MANSUETO ROSALVES", "MARCELO ANDRE", "MARIO", "MATHEUS", "RÉGIO", "ROBERTO CARLOS"];
const motJuliaBase = ["BRUNO", "ELCIDES", "LUIZ RODRIGO", "MARCONI", "MAYKEL", "PLATINIS"];
const motOutrosBase = ["CLOVIS", "RODRIGO"]; 

// Listas Dinâmicas
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
window.motoristasCustom = {}; // Salva novos motoristas
window.motoristasInativos = []; // Salva quem foi desativado

onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        window.bancoDadosCloud = data.lancamentos || {};
        window.configMesesCloud = data.configs || {};
        window.configSlaCloud = data.slas || {};
        window.motoristasCustom = data.motoristasCustom || {};
        window.motoristasInativos = data.motoristasInativos || [];
    } else {
        window.bancoDadosCloud = {};
        window.configMesesCloud = {};
        window.configSlaCloud = {};
        window.motoristasCustom = {};
        window.motoristasInativos = [];
        
        setDoc(docRef, {
            lancamentos: {}, configs: {}, slas: {}, motoristasCustom: {}, motoristasInativos: []
        }).catch(err => console.error(err));
    }

    // Reconstrói as listas de motoristas com as atualizações da nuvem
    window.reconstruirListasMotoristas();

    if(window.motoristaSelecionado) {
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

    setTimeout(() => { if(document.getElementById('loader')) document.getElementById('loader').style.opacity = '0'; }, 300);
    setTimeout(() => { if(document.getElementById('loader')) document.getElementById('loader').style.display = 'none'; }, 800);
}, (error) => {
    console.error("ERRO DO FIREBASE:", error);
    alert("Erro ao conectar no banco de dados!\n\nMotivo: " + error.message);
    if(document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
});

window.syncToFirebase = function() {
    setDoc(docRef, {
        lancamentos: window.bancoDadosCloud,
        configs: window.configMesesCloud,
        slas: window.configSlaCloud,
        motoristasCustom: window.motoristasCustom,
        motoristasInativos: window.motoristasInativos
    }).catch(err => alert("Erro ao salvar: " + err.message));
}

// LOGICA DE RECONSTRUIR AS LISTAS DE MOTORISTAS DINAMICAMENTE
window.reconstruirListasMotoristas = function() {
    window.motRayanna = [...motRayannaBase];
    window.motJulia = [...motJuliaBase];
    window.motOutros = [...motOutrosBase];

    // Adiciona os manuais customizados
    for(let mot in window.motoristasCustom) {
        let turno = window.motoristasCustom[mot];
        if(turno === 'dia') window.motRayanna.push(mot);
        else if(turno === 'noite') window.motJulia.push(mot);
        else if(turno === 'especial') window.motOutros.push(mot);
    }

    // Remove os inativos
    window.motRayanna = window.motRayanna.filter(m => !window.motoristasInativos.includes(m));
    window.motJulia = window.motJulia.filter(m => !window.motoristasInativos.includes(m));
    window.motOutros = window.motOutros.filter(m => !window.motoristasInativos.includes(m));

    window.motoristas = [...window.motRayanna, ...window.motJulia, ...window.motOutros].sort();
    
    window.renderizarSidebar();
    
    // Atualiza a caixinha de projeção
    const selProjMot = document.getElementById('filtroProjMot');
    if(selProjMot) {
        let selecionadoAntes = selProjMot.value;
        selProjMot.innerHTML = '<option value="">Selecione...</option>';
        window.motoristas.forEach(m => {
            let opt = document.createElement('option');
            opt.value = m; opt.textContent = m;
            selProjMot.appendChild(opt);
        });
        if(window.motoristas.includes(selecionadoAntes)) selProjMot.value = selecionadoAntes;
    }
}

// GERENCIADOR DE MOTORISTAS
window.gerenciarMotoristas = function() {
    let acao = prompt("GERENCIAR MOTORISTAS\n\n1 = Adicionar Novo Motorista\n2 = Desativar Motorista (Ocultar)\n3 = Reativar Motorista\n\nDigite o número da ação:");
    
    if (acao === '1') {
        let nome = prompt("Qual o NOME do novo motorista?");
        if (!nome) return;
        nome = nome.toUpperCase().trim();
        let turno = prompt("Qual o TURNO dele?\n(Digite: dia, noite ou especial)").toLowerCase().trim();
        
        if (['dia', 'noite', 'especial'].includes(turno)) {
            window.motoristasCustom[nome] = turno;
            window.syncToFirebase();
            window.reconstruirListasMotoristas();
            alert(`✅ ${nome} adicionado com sucesso ao turno ${turno}!`);
        } else {
            alert("❌ Turno inválido. Operação cancelada.");
        }
    } 
    else if (acao === '2') {
        let nome = prompt("Digite o nome EXATO do motorista para desativar:\n(O histórico e os rankings passados não serão perdidos)");
        if (!nome) return;
        nome = nome.toUpperCase().trim();
        
        if (window.motoristas.includes(nome)) {
            window.motoristasInativos.push(nome);
            window.syncToFirebase();
            window.reconstruirListasMotoristas();
            alert(`🛑 ${nome} foi desativado e removido das listas.`);
        } else {
            alert("❌ Motorista não encontrado na lista.");
        }
    }
    else if (acao === '3') {
        let inativos = window.motoristasInativos.join(", ");
        if (!inativos) { alert("Não há motoristas desativados."); return; }
        
        let nome = prompt(`MOTORISTAS DESATIVADOS:\n${inativos}\n\nDigite o nome de quem deseja REATIVAR:`).toUpperCase().trim();
        if (window.motoristasInativos.includes(nome)) {
            window.motoristasInativos = window.motoristasInativos.filter(m => m !== nome);
            window.syncToFirebase();
            window.reconstruirListasMotoristas();
            alert(`♻️ ${nome} foi reativado com sucesso!`);
        } else {
            alert("❌ Nome não encontrado na lista de inativos.");
        }
    }
    lucide.createIcons();
}

window.getMetaDiaria = function(nome) {
    return nome === "ROBERTO CARLOS" ? 4 : 8;
}

const dataHoje = new Date();
const offset = dataHoje.getTimezoneOffset() * 60000;
const dataLocal = new Date(dataHoje.getTime() - offset);
const hojeStr = dataLocal.toISOString().split('T')[0];
const anoMesAtual = hojeStr.substring(0, 7);
const startStr = `${anoMesAtual}-01`;

if(document.getElementById('dataGlobal')) document.getElementById('dataGlobal').value = anoMesAtual;
if(document.getElementById('dataLancamento')) document.getElementById('dataLancamento').value = hojeStr;
if(document.getElementById('dataRankingInicio')) document.getElementById('dataRankingInicio').value = hojeStr;
if(document.getElementById('dataRankingFim')) document.getElementById('dataRankingFim').value = hojeStr;
if(document.getElementById('mesFiltro')) document.getElementById('mesFiltro').value = anoMesAtual;
if(document.getElementById('dataDomInicio')) document.getElementById('dataDomInicio').value = startStr;
if(document.getElementById('dataDomFim')) document.getElementById('dataDomFim').value = hojeStr;
if(document.getElementById('dataFerInicio')) document.getElementById('dataFerInicio').value = startStr;
if(document.getElementById('dataFerFim')) document.getElementById('dataFerFim').value = hojeStr;

window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    if(sidebar.classList.contains('w-[280px]')) {
        sidebar.classList.remove('w-[280px]');
        sidebar.classList.add('w-0');
    } else {
        sidebar.classList.remove('w-0');
        sidebar.classList.add('w-[280px]');
    }
}

window.renderizarSidebar = function() {
    const ul = document.getElementById('listaMotoristas');
    const selectFiltro = document.getElementById('filtroTurno');
    if(!ul) return;
    ul.innerHTML = '';

    let filtroVal = selectFiltro ? selectFiltro.value : 'todos';

    function criarGrupo(titulo, lista, icone) {
        if(lista.length === 0) return;
        const tituloEl = document.createElement('div');
        tituloEl.innerHTML = `${icone} ${titulo}`;
        ul.appendChild(tituloEl);

        [...lista].sort().forEach(mot => {
            const li = document.createElement('li');
            li.className = 'driver-item';
            if (mot === window.motoristaSelecionado) li.classList.add('active');
            li.textContent = mot;
            li.onclick = () => window.selecionarMotorista(mot, li);
            ul.appendChild(li);
        });
    }

    if(filtroVal === 'todos' || filtroVal === 'dia') criarGrupo('Dia', window.motRayanna, '☀️');
    if(filtroVal === 'todos' || filtroVal === 'noite') criarGrupo('Noite', window.motJulia, '🌙');
    if(filtroVal === 'todos' || filtroVal === 'especial') criarGrupo('Especial (Caçamba)', window.motOutros, '🚛');
}

window.toggleTravaGlobais = function() {
    window.diasUteisTravado = !window.diasUteisTravado;
    const inLanc = document.getElementById('inputDiasUteisLanc');
    const inRank = document.getElementById('inputDiasUteisRank');
    const btnLanc = document.getElementById('btnTravaLanc');
    const btnRank = document.getElementById('btnTravaRank');
    
    if(!inLanc || !inRank) return;

    if(window.diasUteisTravado) {
        inLanc.setAttribute('readonly', 'true');
        inRank.setAttribute('readonly', 'true');
        if(btnLanc) btnLanc.innerHTML = '<i data-lucide="lock" class="w-5 h-5"></i>';
        if(btnRank) btnRank.innerHTML = '<i data-lucide="lock" class="w-5 h-5"></i>';
    } else {
        inLanc.removeAttribute('readonly');
        inRank.removeAttribute('readonly');
        if(btnLanc) btnLanc.innerHTML = '<i data-lucide="unlock" class="w-5 h-5"></i>';
        if(btnRank) btnRank.innerHTML = '<i data-lucide="unlock" class="w-5 h-5"></i>';
        if(document.getElementById('viewLancamentos') && document.getElementById('viewLancamentos').style.display !== 'none') inLanc.focus();
        else inRank.focus();
    }
    lucide.createIcons();
}

window.toggleTravaSla = function() {
    if(!window.motoristaSelecionado) { alert("Selecione um motorista primeiro!"); return; }
    
    const inSla = document.getElementById('inputSlaMotorista');
    const btnSla = document.getElementById('btnTravaSla');
    if(!inSla || !btnSla) return;

    const elMes = document.getElementById('dataGlobal');
    let mesFiltroStr = elMes && elMes.value ? elMes.value.substring(0, 7) : new Date().toISOString().substring(0, 7);
    let chaveComMes = window.motoristaSelecionado + "_" + mesFiltroStr;

    if(inSla.hasAttribute('readonly')) {
        inSla.removeAttribute('readonly');
        btnSla.innerHTML = '<i data-lucide="unlock" class="w-4 h-4"></i>';
        btnSla.className = 'text-amber-500 hover:text-amber-700 bg-white p-2 rounded-lg shadow-sm border border-amber-100 transition-colors shrink-0';
        
        delete window.configSlaCloud[chaveComMes];
        window.syncToFirebase();
        
        inSla.value = window.carregarDiasUteis(mesFiltroStr);
        window.atualizarResumosDoMotorista();
    } else {
        inSla.setAttribute('readonly', 'true');
        btnSla.innerHTML = '<i data-lucide="lock" class="w-4 h-4"></i>';
        btnSla.className = 'bg-red-100 text-red-600 hover:text-red-700 p-2 rounded-lg shadow-sm border border-red-200 transition-colors shrink-0';
        window.salvarSlaMotorista();
    }
    lucide.createIcons();
}

window.atualizarSlaInput = function() {
    if(!window.motoristaSelecionado) return;
    
    const elMes = document.getElementById('dataGlobal');
    let mesFiltroStr = elMes && elMes.value ? elMes.value.substring(0, 7) : new Date().toISOString().substring(0, 7);
    
    let globalSla = window.carregarDiasUteis(mesFiltroStr);
    let chaveComMes = window.motoristaSelecionado + "_" + mesFiltroStr;
    let customSla = window.configSlaCloud[chaveComMes];
    
    const inSla = document.getElementById('inputSlaMotorista');
    const btnSla = document.getElementById('btnTravaSla');
    
    if(inSla && btnSla) {
        if(customSla) {
            inSla.value = customSla;
            inSla.setAttribute('readonly', 'true');
            btnSla.innerHTML = '<i data-lucide="lock" class="w-4 h-4"></i>';
            btnSla.className = 'bg-red-100 text-red-600 hover:text-red-700 p-2 rounded-lg shadow-sm border border-red-200 transition-colors shrink-0';
        } else {
            inSla.value = globalSla;
            inSla.removeAttribute('readonly');
            btnSla.innerHTML = '<i data-lucide="unlock" class="w-4 h-4"></i>';
            btnSla.className = 'text-amber-500 hover:text-amber-700 bg-white p-2 rounded-lg shadow-sm border border-amber-100 transition-colors shrink-0';
        }
    }
    lucide.createIcons();
}

window.salvarSlaMotorista = function() {
    if(!window.motoristaSelecionado) return;
    
    const inSla = document.getElementById('inputSlaMotorista');
    const btnSla = document.getElementById('btnTravaSla');
    const elMes = document.getElementById('dataGlobal');
    let mesFiltroStr = elMes && elMes.value ? elMes.value.substring(0, 7) : new Date().toISOString().substring(0, 7);

    if(!inSla) return;
    let val = parseInt(inSla.value);
    let chaveComMes = window.motoristaSelecionado + "_" + mesFiltroStr;
    
    if(val > 0) {
        window.configSlaCloud[chaveComMes] = val;
        window.syncToFirebase();
        
        inSla.setAttribute('readonly', 'true');
        if(btnSla) {
            btnSla.innerHTML = '<i data-lucide="lock" class="w-4 h-4"></i>';
            btnSla.className = 'bg-red-100 text-red-600 hover:text-red-700 p-2 rounded-lg shadow-sm border border-red-200 transition-colors shrink-0';
            lucide.createIcons();
        }
        window.atualizarResumosDoMotorista();
    }
}

window.carregarDiasUteis = function(anoMesStr) {
    let dias = window.configMesesCloud[anoMesStr] || 22; 
    if(document.getElementById('inputDiasUteisLanc')) document.getElementById('inputDiasUteisLanc').value = dias;
    if(document.getElementById('inputDiasUteisRank')) document.getElementById('inputDiasUteisRank').value = dias;
    return dias;
}

window.salvarDiasUteis = function(origem) {
    let valor = origem === 'lanc' ? document.getElementById('inputDiasUteisLanc').value : document.getElementById('inputDiasUteisRank').value;
    let isLancamento = document.getElementById('viewLancamentos') && document.getElementById('viewLancamentos').style.display !== 'none';
    let inputRef = isLancamento ? document.getElementById('dataGlobal') : document.getElementById('mesFiltro');
    
    if(!inputRef) return;
    let anoMesStr = inputRef.value;
    window.configMesesCloud[anoMesStr] = parseInt(valor) || 22;
    window.syncToFirebase();
    window.atualizarResumosGlobais();
    window.atualizarSlaInput();
}

window.sincronizarMesData = function() {
    const dtG = document.getElementById('dataGlobal');
    const msF = document.getElementById('mesFiltro');
    if(!dtG || !msF) return;
    let anoMesStr = dtG.value;
    msF.value = anoMesStr;
    window.carregarDiasUteis(anoMesStr);
}

window.sincronizarMesFiltro = function() {
    const msF = document.getElementById('mesFiltro');
    if(!msF) return;
    let anoMesStr = msF.value;
    window.carregarDiasUteis(anoMesStr);
}

window.calcularPrevisao = function(totalSoma, anoMesStr, diasUteisAlvo) {
    if (totalSoma === 0) return 0;
    const dataAtual = new Date();
    const anoAtual = dataAtual.getFullYear();
    const mesAtual = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const strAtual = `${anoAtual}-${mesAtual}`;
    
    let diasUteisTotais = diasUteisAlvo || window.carregarDiasUteis(anoMesStr);
    let diasUteisCorridos = 0;

    if (anoMesStr < strAtual) {
        diasUteisCorridos = diasUteisTotais; 
    } else if (anoMesStr > strAtual) {
        return 0; 
    } else {
        let diaHoje = dataAtual.getDate();
        let diasNoMes = new Date(anoAtual, mesAtual, 0).getDate();
        let progresso = diaHoje / diasNoMes; 
        diasUteisCorridos = Math.max(1, Math.round(diasUteisTotais * progresso));
    }
    return Math.round((totalSoma / diasUteisCorridos) * diasUteisTotais);
}

window.mudarAba = function(aba) {
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
    if(document.getElementById('viewLancamentos')) document.getElementById('viewLancamentos').style.display = 'none';
    if(document.getElementById('viewRankings')) document.getElementById('viewRankings').style.display = 'none';
    if(document.getElementById('viewDomFeriados')) document.getElementById('viewDomFeriados').style.display = 'none';
    if(document.getElementById('viewProjecao')) document.getElementById('viewProjecao').style.display = 'none';

    if (aba === 'lancamentos') {
        if(document.getElementById('btnTabLancamentos')) document.getElementById('btnTabLancamentos').classList.add('active');
        if(document.getElementById('viewLancamentos')) document.getElementById('viewLancamentos').style.display = 'block';
    } else if (aba === 'rankings') {
        if(document.getElementById('btnTabRankings')) document.getElementById('btnTabRankings').classList.add('active');
        if(document.getElementById('viewRankings')) document.getElementById('viewRankings').style.display = 'block';
        window.gerarRankingPeriodo();
        window.gerarRankingMensal(); 
    } else if (aba === 'domferiados') {
        if(document.getElementById('btnTabDomFeriados')) document.getElementById('btnTabDomFeriados').classList.add('active');
        if(document.getElementById('viewDomFeriados')) document.getElementById('viewDomFeriados').style.display = 'block';
        window.gerarPainelFeriados();
    } else if (aba === 'projecao') {
        if(document.getElementById('btnTabProjecao')) document.getElementById('btnTabProjecao').classList.add('active');
        if(document.getElementById('viewProjecao')) document.getElementById('viewProjecao').style.display = 'block';
        window.atualizarGraficosProjecao();
    }
}

window.filtrarMotoristas = function() {
    const busca = document.getElementById('buscaMotorista');
    if(!busca) return;
    const input = busca.value.toUpperCase();
    const itensLista = document.querySelectorAll('.driver-item');
    itensLista.forEach(item => {
        const nome = item.textContent || item.innerText;
        item.style.display = (nome.toUpperCase().indexOf(input) > -1) ? "" : "none";
    });
}

window.selecionarMotorista = function(nome, elementoLista) {
    window.motoristaSelecionado = nome;
    document.querySelectorAll('.driver-item').forEach(el => el.classList.remove('active'));
    elementoLista.classList.add('active');
    
    if(document.getElementById('estadoVazio')) document.getElementById('estadoVazio').style.display = 'none';
    if(document.getElementById('conteudoMotorista')) document.getElementById('conteudoMotorista').style.display = 'block';
    if(document.getElementById('nomeMotoristaDisplay')) document.getElementById('nomeMotoristaDisplay').textContent = nome;
    
    const selectVeiculo = document.getElementById('tipoVeiculo');
    if(selectVeiculo) {
        let metaPoli = window.getMetaDiaria(nome);
        
        if(window.motOutros.includes(nome)) { 
            selectVeiculo.innerHTML = `<option value="cacamba">Caminhão Caçamba (Meta 4 Vg)</option>`;
            selectVeiculo.value = "cacamba";
        } else {
            selectVeiculo.innerHTML = `
                <option value="poliguindaste">Poliguindaste Simples (Meta ${metaPoli} Cx)</option>
                <option value="poli_duplo">Poliguindaste Duplo (Meta 8 Cx)</option>
            `;
            selectVeiculo.value = "poliguindaste";
        }
    }

    if(document.getElementById('filtroProjMot')) document.getElementById('filtroProjMot').value = nome;
    
    window.atualizarSlaInput();
    window.carregarHistoricoMotorista();
    window.atualizarResumosDoMotorista();
    window.atualizarGraficosProjecao();
}

window.selecionarMotoristaProjecao = function(nome) {
    if(!nome) return;
    const itensLista = document.querySelectorAll('.driver-item');
    itensLista.forEach(item => {
        if(item.textContent === nome) window.selecionarMotorista(nome, item);
    });
}

window.formatarDataParaBusca = function(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

window.formatarDataParaExibicao = function(dataStr) {
    const partes = dataStr.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

window.salvarLancamento = function() {
    if (!window.motoristaSelecionado) { alert("Selecione um motorista primeiro!"); return; }
    
    const elData = document.getElementById('dataLancamento');
    const dataStr = elData ? elData.value : null;
    if (!dataStr) { alert("Preencha a data do serviço."); return; }

    let tipoVeiculoInput = document.getElementById('tipoVeiculo').value;
    let servicosInput = parseInt(document.getElementById('servicos').value) || 0;
    let valorExtraInput = parseFloat(document.getElementById('valorExtra').value.replace(',','.')) || 0;
    let isFeriadoInput = document.getElementById('feriado') ? document.getElementById('feriado').checked : false;
    let observacaoInput = document.getElementById('observacao') ? document.getElementById('observacao').value.trim() : "";

    if (servicosInput === 0 && valorExtraInput === 0 && observacaoInput === "") {
        alert("Preencha serviços, valor extra ou observação.");
        return;
    }

    let bancoDados = window.bancoDadosCloud;
    if (!bancoDados[dataStr]) bancoDados[dataStr] = {};

    let lancamentoExistente = bancoDados[dataStr][window.motoristaSelecionado];

    let servicosFinais = servicosInput;
    let valorExtraFinal = valorExtraInput;
    let isFeriadoFinal = isFeriadoInput;
    let observacaoFinal = observacaoInput;
    let tipoVeiculoFinal = tipoVeiculoInput;

    if (lancamentoExistente) {
        servicosFinais += (lancamentoExistente.servicos || 0);
        valorExtraFinal += (lancamentoExistente.valorExtra || 0);
        isFeriadoFinal = isFeriadoInput || lancamentoExistente.isFeriado; 
        
        if (lancamentoExistente.observacao && observacaoInput) {
            observacaoFinal = lancamentoExistente.observacao + " | " + observacaoInput;
        } else if (lancamentoExistente.observacao) {
            observacaoFinal = lancamentoExistente.observacao;
        }

        if (lancamentoExistente.tipoVeiculo && lancamentoExistente.tipoVeiculo !== tipoVeiculoInput) {
            tipoVeiculoFinal = 'misto';
            if(!observacaoFinal.includes("[MISTO]")) observacaoFinal = "[MISTO] " + observacaoFinal;
        } else {
            tipoVeiculoFinal = lancamentoExistente.tipoVeiculo;
        }
    }

    const dataObj = new Date(dataStr + 'T00:00:00');
    const diaSemana = dataObj.getDay(); 
    const isDomingo = diaSemana === 0;
    const isSabado = diaSemana === 6;
    
    const metaBaseMotorista = window.getMetaDiaria(window.motoristaSelecionado);
    let metaBaseLancamento = metaBaseMotorista;
    let multiplicadorExtra = 10;

    if (tipoVeiculoFinal === 'cacamba') {
        metaBaseLancamento = 4;
        multiplicadorExtra = 20;
    } else if (tipoVeiculoFinal === 'poli_duplo') {
        metaBaseLancamento = 8;
        multiplicadorExtra = 10;
    } else if (tipoVeiculoFinal === 'misto') {
        metaBaseLancamento = 6; 
        multiplicadorExtra = 10;
    }

    let valorNormalBase = 0;
    let bateuMetaSemana = false;

    if (isDomingo || isFeriadoFinal) {
        valorNormalBase = servicosFinais * 30; 
    } 
    else if (isSabado) {
        let caixasSegSex = 0;
        let viagensSegSex = 0;
        let qtdFeriadosSemana = 0;
        
        for (let i = 1; i <= 5; i++) {
            let d = new Date(dataObj);
            d.setDate(dataObj.getDate() - (6 - i));
            let dStr = window.formatarDataParaBusca(d);
            let lancamentoDia = bancoDados[dStr]?.[window.motoristaSelecionado];
            
            if (lancamentoDia) {
                if (lancamentoDia.isFeriado) { 
                    qtdFeriadosSemana++; 
                } else { 
                    let srv = isNaN(lancamentoDia.servicos) ? 0 : lancamentoDia.servicos;
                    if(lancamentoDia.tipoVeiculo === 'cacamba') viagensSegSex += srv;
                    else caixasSegSex += srv;
                }
            }
        }

        let pontosFeitosSemana = caixasSegSex + (viagensSegSex * 2);
        let metaSemanalPontos = (5 - qtdFeriadosSemana) * metaBaseMotorista; 
        let pontosFaltantes = Math.max(0, metaSemanalPontos - pontosFeitosSemana);

        let pontosDesteSabado = (tipoVeiculoFinal === 'cacamba') ? servicosFinais * 2 : servicosFinais;
        let pontosParaMeta = Math.min(pontosDesteSabado, pontosFaltantes);
        let pontosBonus = Math.max(0, pontosDesteSabado - pontosFaltantes);

        let calcServicosNormais = 0;
        if (pontosParaMeta >= metaBaseMotorista) { 
            let equivalenciaReal = (tipoVeiculoFinal === 'cacamba') ? (pontosParaMeta / 2) : pontosParaMeta;
            calcServicosNormais = 50 + ((equivalenciaReal - metaBaseLancamento) * multiplicadorExtra);
            if(calcServicosNormais < 50) calcServicosNormais = 50; 
        }
        
        let calcServicosBonus = 0;
        if(tipoVeiculoFinal === 'cacamba'){
            calcServicosBonus = (pontosBonus / 2) * 20; 
        } else {
            calcServicosBonus = pontosBonus * 20; 
        }

        valorNormalBase = calcServicosNormais + calcServicosBonus;
        bateuMetaSemana = pontosBonus > 0;
    } 
    else {
        if (servicosFinais >= metaBaseLancamento) { 
            valorNormalBase = 50 + ((servicosFinais - metaBaseLancamento) * multiplicadorExtra); 
        }
    }
    
    let valorFinal = valorNormalBase + valorExtraFinal;

    bancoDados[dataStr][window.motoristaSelecionado] = {
        servicos: servicosFinais, 
        valor: valorFinal, 
        isFeriado: isFeriadoFinal, 
        ganhouBonusSemana: bateuMetaSemana,
        tipoVeiculo: tipoVeiculoFinal,
        valorExtra: valorExtraFinal,
        observacao: observacaoFinal
    };

    window.syncToFirebase();
    
    if(document.getElementById('servicos')) document.getElementById('servicos').value = '';
    if(document.getElementById('valorExtra')) document.getElementById('valorExtra').value = '';
    if(document.getElementById('observacao')) document.getElementById('observacao').value = '';
    if(document.getElementById('feriado')) document.getElementById('feriado').checked = false;
}

window.carregarHistoricoMotorista = function() {
    if (!window.motoristaSelecionado) return;
    const tbody = document.querySelector('#tabelaHistorico tbody');
    if(!tbody) return;
    tbody.innerHTML = ''; 
    const bancoDados = window.bancoDadosCloud;
    
    const elMes = document.getElementById('dataGlobal');
    const mesFiltroStr = elMes && elMes.value ? elMes.value.substring(0, 7) : new Date().toISOString().substring(0, 7);

    let historico = [];

    for (const data in bancoDados) {
        if (data.startsWith(mesFiltroStr) && bancoDados[data][window.motoristaSelecionado]) {
            historico.push({ data: data, dados: bancoDados[data][window.motoristaSelecionado] });
        }
    }
    historico.sort((a, b) => new Date(b.data) - new Date(a.data));

    if (historico.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-slate-400 font-medium py-8">Nenhum lançamento encontrado neste mês.</td></tr>';
        return;
    }

    historico.forEach(item => {
        const tr = document.createElement('tr');
        
        let tagsDia = '';
        const dataObj = new Date(item.data + 'T00:00:00');
        if (dataObj.getDay() === 0) tagsDia += '<span class="badge-feriado">DOMINGO</span> ';
        if (item.dados.isFeriado) tagsDia += '<span class="badge-feriado">FERIADO</span> ';
        if (item.dados.ganhouBonusSemana) tagsDia += '<span class="badge-meta">META SAB BATIDA</span>';
        if (tagsDia === '') tagsDia = 'Normal';

        let tagVeiculo = 'POLIGUINDASTE';
        if (item.dados.tipoVeiculo === 'cacamba') tagVeiculo = 'CAÇAMBA';
        if (item.dados.tipoVeiculo === 'poli_duplo') tagVeiculo = 'POLI. DUPLO';
        if (item.dados.tipoVeiculo === 'misto') tagVeiculo = 'VEÍC. MISTO';

        let qtdText = item.dados.tipoVeiculo === 'cacamba' ? `${item.dados.servicos} vg` : `${item.dados.servicos} cx`;
        let extraTxt = item.dados.valorExtra > 0 ? `+ R$ ${item.dados.valorExtra.toFixed(2).replace('.',',')}` : '-';
        let obsText = item.dados.observacao ? item.dados.observacao : '-';

        tr.innerHTML = `
            <td class="text-slate-800 font-bold">${window.formatarDataParaExibicao(item.data)}</td>
            <td><span class="badge-veiculo">${tagVeiculo}</span><br><span class="inline-block mt-1">${tagsDia}</span></td>
            <td class="text-center font-black">${qtdText}</td>
            <td class="text-center text-blue-600 font-bold">${extraTxt}</td>
            <td class="text-right text-emerald-600 font-black text-sm">R$ ${item.dados.valor.toFixed(2).replace('.', ',')}</td>
            <td class="text-xs text-slate-500 max-w-[150px] truncate" title="${obsText}">${obsText}</td>
            <td class="text-center"><button class="btn-delete" onclick="window.deletarLancamentoEspecifico('${item.data}')">Excluir</button></td>
        `;
        tbody.appendChild(tr);
    });
}

window.deletarLancamentoEspecifico = function(dataStr) {
    if(confirm(`Deseja apagar o lançamento do dia ${window.formatarDataParaExibicao(dataStr)}?`)) {
        let bancoDados = window.bancoDadosCloud;
        delete bancoDados[dataStr][window.motoristaSelecionado];
        if(Object.keys(bancoDados[dataStr]).length === 0) delete bancoDados[dataStr];
        window.syncToFirebase();
    }
}

window.atualizarResumosDoMotorista = function() {
    if (!window.motoristaSelecionado) return;
    const elLanc = document.getElementById('dataLancamento');
    if(!elLanc) return;
    const dataRefStr = elLanc.value;
    if (!dataRefStr) return;
    const bancoDados = window.bancoDadosCloud;
    
    let totalDia = 0;
    if (bancoDados[dataRefStr] && bancoDados[dataRefStr][window.motoristaSelecionado]) {
        totalDia = bancoDados[dataRefStr][window.motoristaSelecionado].valor;
    }
    if(document.getElementById('motoristaTotalDia')) document.getElementById('motoristaTotalDia').innerText = `R$ ${totalDia.toFixed(2).replace('.', ',')}`;

    let totalSemana = 0;
    const dataObj = new Date(dataRefStr + 'T00:00:00');
    const diffParaSegunda = (dataObj.getDay() === 0) ? -6 : 1 - dataObj.getDay();
    const dataSegunda = new Date(dataObj);
    dataSegunda.setDate(dataObj.getDate() + diffParaSegunda);

    for (let i = 0; i < 7; i++) {
        const diaCheck = new Date(dataSegunda);
        diaCheck.setDate(dataSegunda.getDate() + i);
        const diaCheckStr = window.formatarDataParaBusca(diaCheck);
        if (bancoDados[diaCheckStr] && bancoDados[diaCheckStr][window.motoristaSelecionado]) {
            totalSemana += bancoDados[diaCheckStr][window.motoristaSelecionado].valor;
        }
    }
    if(document.getElementById('motoristaTotalSemana')) document.getElementById('motoristaTotalSemana').innerText = `R$ ${totalSemana.toFixed(2).replace('.', ',')}`;

    const elMes = document.getElementById('dataGlobal');
    const anoMesFiltro = elMes && elMes.value ? elMes.value.substring(0, 7) : dataRefStr.substring(0, 7);
    
    let totalCaixasMes = 0;
    let totalViagensMes = 0;
    let totalFatMes = 0;

    for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
        if (dataStr.startsWith(anoMesFiltro)) {
            const dObj = new Date(dataStr + 'T00:00:00');
            if (dadosDia[window.motoristaSelecionado]) {
                if (dObj.getDay() !== 0 && !dadosDia[window.motoristaSelecionado].isFeriado) {
                    if(dadosDia[window.motoristaSelecionado].tipoVeiculo === 'cacamba') totalViagensMes += dadosDia[window.motoristaSelecionado].servicos;
                    else totalCaixasMes += dadosDia[window.motoristaSelecionado].servicos;
                    totalFatMes += dadosDia[window.motoristaSelecionado].valor;
                }
            }
        }
    }

    let metaDiaria = window.getMetaDiaria(window.motoristaSelecionado);
    let diasUteisGlobais = window.carregarDiasUteis(anoMesFiltro);
    let chaveComMes = window.motoristaSelecionado + "_" + anoMesFiltro;
    let diasUteisMotorista = window.configSlaCloud[chaveComMes] || diasUteisGlobais;
    
    let metaMensalPontos = diasUteisMotorista * metaDiaria; 

    let previsaoCaixas = window.calcularPrevisao(totalCaixasMes, anoMesFiltro, diasUteisMotorista);
    let previsaoViagens = window.calcularPrevisao(totalViagensMes, anoMesFiltro, diasUteisMotorista);

    let textoMeta = "";
    if (window.motOutros.includes(window.motoristaSelecionado)) {
        textoMeta = `${metaMensalPontos / 2} vg`;
        if(document.getElementById('motoristaCaixasMes')) document.getElementById('motoristaCaixasMes').innerText = `${totalCaixasMes} cx | ${totalViagensMes} vg`;
        if(document.getElementById('motoristaPrevisaoMes')) document.getElementById('motoristaPrevisaoMes').innerText = `${previsaoCaixas} cx | ${previsaoViagens} vg`;
    } else {
        textoMeta = `${metaMensalPontos} cx`;
        if(document.getElementById('motoristaCaixasMes')) document.getElementById('motoristaCaixasMes').innerText = `${totalCaixasMes} cx`;
        if(document.getElementById('motoristaPrevisaoMes')) document.getElementById('motoristaPrevisaoMes').innerText = `${previsaoCaixas} cx`;
    }
    
    if(document.getElementById('motoristaMetaMes')) document.getElementById('motoristaMetaMes').innerText = `Meta Mensal: ${textoMeta} | Fat: R$ ${totalFatMes.toFixed(2).replace('.', ',')}`;
}

window.atualizarResumosGlobais = function() {
    const elGlobal = document.getElementById('dataGlobal');
    if(!elGlobal) return;
    const mesGlobalStr = elGlobal.value.substring(0, 7); 
    if(!mesGlobalStr) return;
    const bancoDados = window.bancoDadosCloud;
    
    let totalMesGlobal = 0;
    let caixasMesGlobal = 0;

    for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
        if (dataStr.startsWith(mesGlobalStr)) {
            for (const mot in dadosDia) { 
                totalMesGlobal += dadosDia[mot].valor; 
                if(dadosDia[mot].tipoVeiculo !== 'cacamba') {
                    caixasMesGlobal += dadosDia[mot].servicos;
                }
            }
        }
    }
    
    if(document.getElementById('totalDiaGlobal')) {
        document.getElementById('totalDiaGlobal').innerText = `R$ ${totalMesGlobal.toFixed(2).replace('.', ',')}`;
        document.getElementById('totalDiaGlobal').previousElementSibling.innerText = "TOTAL FROTA (MÊS)";
    }
    if(document.getElementById('caixasDiaGlobal')) {
        document.getElementById('caixasDiaGlobal').innerText = `${caixasMesGlobal} cx`;
    }

    if(document.getElementById('totalSemanaGlobal')) {
        document.getElementById('totalSemanaGlobal').innerText = `R$ ${totalMesGlobal.toFixed(2).replace('.', ',')}`;
        document.getElementById('totalSemanaGlobal').previousElementSibling.innerText = "TOTAL FROTA (MÊS)";
    }
    if(document.getElementById('caixasSemanaGlobal')) {
        document.getElementById('caixasSemanaGlobal').innerText = `${caixasMesGlobal} cx`;
    }
}

window.gerarRankingPeriodo = function() {
    const elInicio = document.getElementById('dataRankingInicio');
    const elFim = document.getElementById('dataRankingFim');
    if(!elInicio || !elFim) return;
    const inicio = elInicio.value;
    const fim = elFim.value;
    if(!inicio || !fim) return;

    const bancoDados = window.bancoDadosCloud;
    let rankPeriodo = {};
    
    for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
        if (dataStr >= inicio && dataStr <= fim) {
            const isDomingo = new Date(dataStr + 'T00:00:00').getDay() === 0;
            for (const [mot, dados] of Object.entries(dadosDia)) {
                if (isDomingo || dados.isFeriado) continue;

                if (!rankPeriodo[mot]) rankPeriodo[mot] = { caixas: 0, viagens: 0, valor: 0, extra: 0, diasTrab: 0 };
                if(dados.tipoVeiculo === 'cacamba') rankPeriodo[mot].viagens += dados.servicos;
                else rankPeriodo[mot].caixas += dados.servicos;
                
                rankPeriodo[mot].valor += dados.valor;
                rankPeriodo[mot].extra += dados.valorExtra || 0;
                rankPeriodo[mot].diasTrab += 1;
            }
        }
    }

    let rankArray = Object.keys(rankPeriodo).map(mot => {
        let pontosFeitos = rankPeriodo[mot].caixas + (rankPeriodo[mot].viagens * 2);
        let metaTotalPeriodo = window.getMetaDiaria(mot) * rankPeriodo[mot].diasTrab;
        let porcentagem = metaTotalPeriodo > 0 ? (pontosFeitos / metaTotalPeriodo) * 100 : 0;
        return { nome: mot, ...rankPeriodo[mot], porcentagem: porcentagem };
    });
    
    rankArray.sort((a,b) => b.porcentagem - a.porcentagem);
    
    const divLista = document.getElementById('listaRankingDiario');
    if(!divLista) return;
    divLista.innerHTML = '';

    if(rankArray.length === 0) {
        divLista.innerHTML = '<div class="text-center text-slate-400 py-8 font-medium">Nenhum serviço normal no período. 😴</div>';
        return;
    }

    rankArray.forEach((mot, index) => {
        let porcentagemStr = mot.porcentagem.toFixed(2).replace('.', ',');

        let classeBarra = '';
        if(mot.porcentagem >= 100) classeBarra = 'meta-batida';
        else if (mot.porcentagem >= 80) classeBarra = 'meta-excedida'; 
        else classeBarra = 'meta-ruim'; 

        let larguraBarra = mot.porcentagem > 100 ? 100 : mot.porcentagem; 
        let extraBadge = mot.extra > 0 ? `<span class="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded ml-2">+ Extra R$ ${mot.extra}</span>` : '';
        
        let textoQtd = "";
        if (window.motOutros.includes(mot.nome)) {
            if(mot.caixas > 0 && mot.viagens > 0) textoQtd = `${mot.caixas} cx | ${mot.viagens} vg`;
            else if (mot.caixas > 0) textoQtd = `${mot.caixas} cx | 0 vg`;
            else textoQtd = `0 cx | ${mot.viagens} vg`;
        } else {
            textoQtd = `${mot.caixas} cx`;
        }

        const linha = document.createElement('div');
        linha.className = 'diario-row';
        linha.innerHTML = `
            <div class="diario-top">
                <span class="diario-nome">#${index + 1} - ${mot.nome} <span class="text-blue-500 font-black">(${textoQtd})</span> ${extraBadge}</span>
                <span class="diario-faturamento">R$ ${mot.valor.toFixed(2).replace('.', ',')}</span>
            </div>
            <div class="progress-wrapper">
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill ${classeBarra}" style="width: ${larguraBarra}%;"></div>
                </div>
                <span class="progress-text" title="Baseado nos dias trabalhados">${porcentagemStr}%</span>
            </div>
        `;
        divLista.appendChild(linha);
    });
}

window.obterRankElo = function(percentual) {
    if (percentual >= 100) return { nome: 'Radiante', classe: 'elo-radiante' };
    if (percentual >= 80) return { nome: 'Diamante', classe: 'elo-diamante' };
    return { nome: 'Bronze', classe: 'elo-bronze' };
}

window.gerarRankingMensal = function() {
    const elFiltro = document.getElementById('mesFiltro');
    if(!elFiltro) return;
    const mesFiltro = elFiltro.value; 
    if (!mesFiltro) return;

    let diasUteisGlobais = window.carregarDiasUteis(mesFiltro);

    const bancoDados = window.bancoDadosCloud;
    let acumuladoMes = {};
    let totalCaixasFrota = 0;
    let totalViagensFrota = 0;
    let totalFatMesFrota = 0;

    window.motoristas.forEach(m => acumuladoMes[m] = { caixas: 0, viagens: 0, valor: 0 });

    for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
        if (dataStr.startsWith(mesFiltro)) {
            const isDomingo = new Date(dataStr + 'T00:00:00').getDay() === 0;
            for (const [mot, dados] of Object.entries(dadosDia)) {
                if (!isDomingo && !dados.isFeriado) {
                    if (acumuladoMes[mot]) {
                        if(dados.tipoVeiculo === 'cacamba') {
                            acumuladoMes[mot].viagens += dados.servicos;
                            totalViagensFrota += dados.servicos;
                        } else {
                            acumuladoMes[mot].caixas += dados.servicos;
                            totalCaixasFrota += dados.servicos; 
                        }
                        acumuladoMes[mot].valor += dados.valor;
                        totalFatMesFrota += dados.valor;
                    }
                }
            }
        }
    }

    if(document.getElementById('totalViagensMesGlobal')) document.getElementById('totalViagensMesGlobal').innerText = `${totalViagensFrota} vg`;
    if(document.getElementById('totalFatMensalLeaderboard')) document.getElementById('totalFatMensalLeaderboard').innerText = `R$ ${totalFatMesFrota.toFixed(2).replace('.', ',')}`;

    let ptsRayanna = 0, feitasRayanna = 0;
    window.motRayanna.forEach(mot => {
        let diasUteisMotorista = window.configSlaCloud[mot + "_" + mesFiltro] || diasUteisGlobais;
        ptsRayanna += window.getMetaDiaria(mot) * diasUteisMotorista;
        if(acumuladoMes[mot]) feitasRayanna += acumuladoMes[mot].caixas + (acumuladoMes[mot].viagens * 2);
    });

    let ptsJulia = 0, feitasJulia = 0;
    window.motJulia.forEach(mot => {
        let diasUteisMotorista = window.configSlaCloud[mot + "_" + mesFiltro] || diasUteisGlobais;
        ptsJulia += window.getMetaDiaria(mot) * diasUteisMotorista;
        if(acumuladoMes[mot]) feitasJulia += acumuladoMes[mot].caixas + (acumuladoMes[mot].viagens * 2);
    });

    let ptsGeral = ptsRayanna + ptsJulia;
    let feitasGeral = feitasRayanna + feitasJulia;

    function renderizarMeta(feitas, meta, elValor, elFalta) {
        let perc = meta > 0 ? ((feitas / meta) * 100).toFixed(1) : 0;
        let faltam = Math.max(0, meta - feitas);
        if(document.getElementById(elValor)) document.getElementById(elValor).innerText = `${feitas} / ${meta} cx`;
        if(document.getElementById(elFalta)) document.getElementById(elFalta).innerText = `${perc}% | Faltam ${faltam}`;
    }

    renderizarMeta(feitasGeral, ptsGeral, 'metaGeralGlobal', 'faltaGeralGlobal');
    renderizarMeta(feitasRayanna, ptsRayanna, 'metaRayannaGlobal', 'faltaRayannaGlobal');
    renderizarMeta(feitasJulia, ptsJulia, 'metaJuliaGlobal', 'faltaJuliaGlobal');

    let rankFinal = Object.keys(acumuladoMes)
        .map(mot => {
            let pts = acumuladoMes[mot].caixas + (acumuladoMes[mot].viagens * 2);
            let diasUteisMotorista = window.configSlaCloud[mot + "_" + mesFiltro] || diasUteisGlobais;
            let metaMensalPontos = diasUteisMotorista * window.getMetaDiaria(mot);
            let percentualMeta = metaMensalPontos > 0 ? ((pts / metaMensalPontos) * 100) : 0;
            
            return { 
                nome: mot, 
                caixas: acumuladoMes[mot].caixas, 
                viagens: acumuladoMes[mot].viagens, 
                valor: acumuladoMes[mot].valor, 
                pontos: pts, 
                percentual: percentualMeta,
                diasBase: diasUteisMotorista 
            };
        })
        .filter(item => item.pontos > 0 || item.caixas > 0 || item.viagens > 0)
        .sort((a, b) => b.percentual - a.percentual); 

    const divLista = document.getElementById('listaLeaderboard');
    if(!divLista) return;
    divLista.innerHTML = '';

    if(rankFinal.length === 0) {
        divLista.innerHTML = '<div class="text-center text-slate-400 py-8 font-medium">Sem registros válidos. O elo de todo mundo é Ferro! 🥶</div>';
        return;
    }

    rankFinal.forEach((mot, index) => {
        const eloInfo = window.obterRankElo(mot.percentual);
        let percentualStr = mot.percentual.toFixed(2).replace('.', ',');
        
        let corPercent, bgPercent, borderPercent;
        if (mot.percentual >= 100) { corPercent = '#10b981'; bgPercent = '#d1fae5'; borderPercent = '#a7f3d0'; } 
        else if (mot.percentual >= 80) { corPercent = '#d97706'; bgPercent = '#fef3c7'; borderPercent = '#fde68a'; } 
        else { corPercent = '#ef4444'; bgPercent = '#fee2e2'; borderPercent = '#fca5a5'; }

        let textoQtd = "";
        if (window.motOutros.includes(mot.nome)) {
            if(mot.caixas > 0 && mot.viagens > 0) textoQtd = `${mot.caixas} cx | ${mot.viagens} vg`;
            else if (mot.caixas > 0) textoQtd = `${mot.caixas} cx | 0 vg`;
            else textoQtd = `0 cx | ${mot.viagens} vg`;
        } else {
            textoQtd = `${mot.caixas} cx`;
        }

        let htmlFaltam = "";
        let metaMensalPontos = mot.diasBase * window.getMetaDiaria(mot.nome);
        let faltam = metaMensalPontos - mot.pontos;
        
        if (faltam > 0) {
            let txtFaltam = "";
            if (window.motOutros.includes(mot.nome)) {
                txtFaltam = `Faltam ${Math.ceil(faltam / 2)} vg`;
            } else {
                txtFaltam = `Faltam ${faltam} cx`;
            }
            htmlFaltam = `<span class="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded ml-2 font-bold">${txtFaltam}</span>`;
        } else {
            htmlFaltam = `<span class="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded ml-2 font-bold">Meta Batida!</span>`;
        }

        const linha = document.createElement('div');
        linha.className = 'elo-row';
        linha.innerHTML = `
            <div class="posicao">#${index + 1}</div>
            <div class="nome-motorista-rank">
                ${mot.nome}
                <span class="valor-sub">Fat: R$ ${mot.valor.toFixed(2).replace('.', ',')}</span>
            </div>
            <div><span class="badge-elo ${eloInfo.classe}">${eloInfo.nome}</span></div>
            <div class="valor-destaque text-blue-500 flex items-center">
                ${textoQtd}
                <span class="badge-percent text-[11px]" style="background:${bgPercent}; color:${corPercent}; border-color:${borderPercent};" title="Meta Atingida (SLA: ${mot.diasBase} dias)">${percentualStr}%</span>
                ${htmlFaltam}
            </div>
        `;
        divLista.appendChild(linha);
    });
}

window.gerarPainelFeriados = function() {
    const domInicio = document.getElementById('dataDomInicio') ? document.getElementById('dataDomInicio').value : null;
    const domFim = document.getElementById('dataDomFim') ? document.getElementById('dataDomFim').value : null;
    const ferInicio = document.getElementById('dataFerInicio') ? document.getElementById('dataFerInicio').value : null;
    const ferFim = document.getElementById('dataFerFim') ? document.getElementById('dataFerFim').value : null;

    const bancoDados = window.bancoDadosCloud;
    let registrosDom = [];
    let registrosFer = [];
    let fatTotalDom = 0, fatTotalFer = 0;

    for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
        const dataObj = new Date(dataStr + 'T00:00:00');
        const isDomingo = dataObj.getDay() === 0;

        for (const [mot, dados] of Object.entries(dadosDia)) {
            let obj = {
                dataStr: dataStr,
                nome: mot,
                caixas: dados.tipoVeiculo !== 'cacamba' ? dados.servicos : 0,
                viagens: dados.tipoVeiculo === 'cacamba' ? dados.servicos : 0,
                valor: dados.valor
            };

            if (isDomingo && !dados.isFeriado) {
                if (!domInicio || !domFim || (dataStr >= domInicio && dataStr <= domFim)) {
                    registrosDom.push(obj);
                    fatTotalDom += dados.valor;
                }
            }
            if (dados.isFeriado) {
                if (!ferInicio || !ferFim || (dataStr >= ferInicio && dataStr <= ferFim)) {
                    registrosFer.push(obj);
                    fatTotalFer += dados.valor;
                }
            }
        }
    }

    if(document.getElementById('totalFatDom')) document.getElementById('totalFatDom').innerText = `R$ ${fatTotalDom.toFixed(2).replace('.', ',')}`;
    if(document.getElementById('totalFatFer')) document.getElementById('totalFatFer').innerText = `R$ ${fatTotalFer.toFixed(2).replace('.', ',')}`;
    if(document.getElementById('totalGeralDomFer')) document.getElementById('totalGeralDomFer').innerText = `R$ ${(fatTotalDom + fatTotalFer).toFixed(2).replace('.', ',')}`;

    function renderizarLista(listaRegistros, idElemento, msgVazia) {
        listaRegistros.sort((a, b) => {
            if(a.dataStr !== b.dataStr) return new Date(b.dataStr) - new Date(a.dataStr);
            return b.valor - a.valor;
        });

        const divLista = document.getElementById(idElemento);
        if(!divLista) return;
        divLista.innerHTML = '';

        if(listaRegistros.length === 0) {
            divLista.innerHTML = `<div class="text-center text-slate-400 py-8 font-medium">${msgVazia}</div>`;
            return;
        }

        listaRegistros.forEach((mot) => {
            let textoQtd = "";
            if (window.motOutros.includes(mot.nome)) {
                if(mot.caixas > 0 && mot.viagens > 0) textoQtd = `${mot.caixas} cx | ${mot.viagens} vg`;
                else if (mot.caixas > 0) textoQtd = `${mot.caixas} cx | 0 vg`;
                else textoQtd = `0 cx | ${mot.viagens} vg`;
            } else {
                textoQtd = `${mot.caixas} cx`;
            }

            let dataFormatada = window.formatarDataParaExibicao(mot.dataStr);
            const linha = document.createElement('div');
            linha.className = 'diario-row';
            linha.innerHTML = `
                <div class="diario-top" style="margin:0;">
                    <span class="diario-nome" style="display:flex; align-items:center; gap:8px;">
                        <span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-black">${dataFormatada}</span>
                        ${mot.nome} <span class="text-blue-500">(${textoQtd})</span>
                    </span>
                    <span class="diario-faturamento text-red-500">R$ ${mot.valor.toFixed(2).replace('.', ',')}</span>
                </div>
            `;
            divLista.appendChild(linha);
        });
    }

    renderizarLista(registrosDom, 'listaDomingos', 'Nenhum serviço em domingos no período selecionado. 😴');
    renderizarLista(registrosFer, 'listaFeriados', 'Nenhum serviço em feriados no período selecionado. 😴');
}

window.atualizarGraficosProjecao = function() {
    const bancoDados = window.bancoDadosCloud;
    const elFiltro = document.getElementById('mesFiltro');
    const mesAtualStr = elFiltro ? elFiltro.value : new Date().toISOString().substring(0, 7);
    
    const filtroTurno = document.getElementById('filtroProjTurno') ? document.getElementById('filtroProjTurno').value : 'todos';

    let [ano, mes] = mesAtualStr.split('-');
    let dataPassado = new Date(ano, parseInt(mes) - 2, 1);
    let mesPassadoStr = dataPassado.getFullYear() + "-" + String(dataPassado.getMonth() + 1).padStart(2, '0');

    let dadosEvolucaoInd = [];
    let mapGeral = {};
    let stats = { atual: 0, passado: 0 };

    if(document.getElementById('projecaoNomeMotorista')) {
        document.getElementById('projecaoNomeMotorista').innerText = window.motoristaSelecionado || "Ninguém Selecionado";
    }

    for (const [data, motoristasDia] of Object.entries(bancoDados)) {
        let isMesAtual = data.startsWith(mesAtualStr);
        let isMesPassado = data.startsWith(mesPassadoStr);
        let pontosDiaGeral = 0;
        
        for (const [mot, dados] of Object.entries(motoristasDia)) {
            let pts = dados.tipoVeiculo === 'cacamba' ? dados.servicos * 2 : dados.servicos;
            let qtdReal = dados.servicos;
            
            if (mot === window.motoristaSelecionado) {
                if (isMesAtual && !dados.isFeriado && new Date(data + 'T00:00:00').getDay() !== 0) {
                    stats.atual += qtdReal;
                }
                if (isMesPassado && !dados.isFeriado && new Date(data + 'T00:00:00').getDay() !== 0) {
                    stats.passado += qtdReal;
                }
                if (isMesAtual) {
                    dadosEvolucaoInd.push({ dataStr: data, pontos: pts });
                }
            }
            
            let incluirNoGeral = false;
            if (filtroTurno === 'todos') incluirNoGeral = true;
            else if (filtroTurno === 'dia' && window.motRayanna.includes(mot)) incluirNoGeral = true;
            else if (filtroTurno === 'noite' && window.motJulia.includes(mot)) incluirNoGeral = true;
            else if (filtroTurno === 'especial' && window.motOutros.includes(mot)) incluirNoGeral = true;

            if (isMesAtual && incluirNoGeral) {
                pontosDiaGeral += pts;
            }
        }
        if (isMesAtual) {
            mapGeral[data] = pontosDiaGeral;
        }
    }

    let txtSufixo = (window.motOutros.includes(window.motoristaSelecionado)) ? " vg" : " cx";
    
    if(document.getElementById('statMesAtual')) document.getElementById('statMesAtual').innerText = stats.atual + txtSufixo;
    if(document.getElementById('statMesPassado')) document.getElementById('statMesPassado').innerText = stats.passado + txtSufixo;
    
    let elCrescimento = document.getElementById('statCrescimento');
    if(elCrescimento) {
        if (!window.motoristaSelecionado) {
            elCrescimento.innerHTML = `<span class="text-slate-500 bg-slate-100 px-3 py-1 rounded-xl text-sm font-bold">Selecione na lista</span>`;
        } else {
            let diff = stats.atual - stats.passado;
            if (diff > 0) {
                elCrescimento.innerHTML = `<span class="text-emerald-600 bg-emerald-100 px-3 py-1 rounded-xl text-sm font-bold">+${diff}${txtSufixo} a mais</span><span class="text-xs text-slate-500 font-medium">que o mês anterior</span>`;
            } else if (diff < 0) {
                let numeroPositivo = Math.abs(diff);
                elCrescimento.innerHTML = `<span class="text-red-600 bg-red-100 px-3 py-1 rounded-xl text-sm font-bold">-${numeroPositivo}${txtSufixo} a menos</span><span class="text-xs text-slate-500 font-medium">que o mês anterior</span>`;
            } else {
                elCrescimento.innerHTML = `<span class="text-slate-600 bg-slate-100 px-3 py-1 rounded-xl text-sm font-bold">Empatado</span><span class="text-xs text-slate-500 font-medium">com o mês anterior</span>`;
            }
        }
    }

    dadosEvolucaoInd.sort((a, b) => new Date(a.dataStr) - new Date(b.dataStr));
    const labelsInd = dadosEvolucaoInd.map(d => window.formatarDataParaExibicao(d.dataStr).substring(0, 5));
    const dataInd = dadosEvolucaoInd.map(d => d.pontos);

    let arrayGeral = Object.keys(mapGeral).map(k => ({ dataStr: k, pontos: mapGeral[k] }));
    arrayGeral.sort((a, b) => new Date(a.dataStr) - new Date(b.dataStr));
    const labelsGeral = arrayGeral.map(d => window.formatarDataParaExibicao(d.dataStr).substring(0, 5));
    const dataGeral = arrayGeral.map(d => d.pontos);

    Chart.defaults.font.family = "'Inter', sans-serif";

    const ctxInd = document.getElementById('chartEvolucaoIndividual');
    if (ctxInd) {
        if (window.chartInstanciaInd) window.chartInstanciaInd.destroy();
        window.chartInstanciaInd = new Chart(ctxInd.getContext('2d'), {
            type: 'line',
            data: {
                labels: labelsInd,
                datasets: [{
                    label: 'Volume (Pontos)',
                    data: dataInd,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#2563eb',
                    fill: true,
                    tension: 0.3 
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } }
        });
    }

    const ctxGeral = document.getElementById('chartEvolucaoGeral');
    if (ctxGeral) {
        if (window.chartInstanciaGeral) window.chartInstanciaGeral.destroy();
        
        let nomeTurnoGrafico = 'Frota Completa';
        if(filtroTurno === 'dia') nomeTurnoGrafico = 'Turno Dia (Rayanna)';
        if(filtroTurno === 'noite') nomeTurnoGrafico = 'Turno Noite (Júlia)';
        if(filtroTurno === 'especial') nomeTurnoGrafico = 'Especial (Caçamba)';

        window.chartInstanciaGeral = new Chart(ctxGeral.getContext('2d'), {
            type: 'line',
            data: {
                labels: labelsGeral,
                datasets: [{
                    label: nomeTurnoGrafico + ' (Pontos)',
                    data: dataGeral,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#10b981',
                    fill: true,
                    tension: 0.3 
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } }
        });
    }
}
