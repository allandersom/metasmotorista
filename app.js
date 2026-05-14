import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

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
const storage = getStorage(app);
const docRef = doc(db, "sistema", "dados_logistica");

// NOMES ATUALIZADOS COMPLETOS
const motRayannaBase = ["EMERSON JOSE", "JACKSON MOREIRA", "JAMERSON DA SILVA", "JOÃO VICTOR MARTINS", "JOELITON PEREIRA", "JONES ALBUQUERQUE", "LUIZ RODRIGUES", "MANSUETO ROSALVES", "MARCELO ANDRE", "MARIO GOMES", "MATHEUS FELIPE", "ADRIELSON ALVES", "ROBERTO CARLOS", "RÉGIO JOSÉ"];
const motJuliaBase = ["ELCIDES JOSE", "LUIZ RODRIGO", "MARCONI JOSE", "PLATINIS NILSON", "BRUNO HENRIQUE", "MAYKEL DE SOUZA"];
const motOutrosBase = ["CLOVIS RIBEIRO", "RODRIGO FRANCISCO"]; 

window.motRayanna = []; window.motJulia = []; window.motOutros = []; window.motoristas = [];
window.motoristaSelecionado = null; window.chartInstanciaInd = null; window.chartInstanciaGeral = null; window.diasUteisTravado = true;

window.bancoDadosCloud = {}; window.configMesesCloud = {}; window.configSlaCloud = {}; 
window.motoristasCustom = {}; window.motoristasInativos = []; 

window.calcularPontosMotorista = function(nome, servicos, tipoVeiculo) {
    let metaMot = window.getMetaDiaria(nome); 
    if (tipoVeiculo === 'cacamba') return servicos * (metaMot / 4);
    if (tipoVeiculo === 'poli_duplo') return servicos / 2;
    if (tipoVeiculo === 'misto') return servicos * (metaMot / 6); 
    return servicos; 
}

onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        window.bancoDadosCloud = data.lancamentos || {}; window.configMesesCloud = data.configs || {};
        window.configSlaCloud = data.slas || {}; window.motoristasCustom = data.motoristasCustom || {}; window.motoristasInativos = data.motoristasInativos || [];
    } else {
        window.bancoDadosCloud = {}; window.configMesesCloud = {}; window.configSlaCloud = {}; window.motoristasCustom = {}; window.motoristasInativos = [];
        setDoc(docRef, { lancamentos: {}, configs: {}, slas: {}, motoristasCustom: {}, motoristasInativos: [] }).catch(err => console.error(err));
    }

    window.reconstruirListasMotoristas();

    if(window.motoristaSelecionado) {
        window.carregarHistoricoMotorista(); window.atualizarResumosDoMotorista(); window.atualizarGraficosProjecao(); window.atualizarSlaInput();
    }
    window.sincronizarMesFiltro(); window.atualizarResumosGlobais(); window.gerarRankingPeriodo(); window.gerarRankingMensal(); window.gerarPainelFeriados();

    setTimeout(() => { if(document.getElementById('loader')) document.getElementById('loader').style.opacity = '0'; }, 300);
    setTimeout(() => { if(document.getElementById('loader')) document.getElementById('loader').style.display = 'none'; }, 800);
}, (error) => {
    console.error("ERRO DO FIREBASE:", error);
    if(document.getElementById('loader')) document.getElementById('loader').style.display = 'none';
});

window.syncToFirebase = function() {
    setDoc(docRef, {
        lancamentos: window.bancoDadosCloud, configs: window.configMesesCloud, slas: window.configSlaCloud, motoristasCustom: window.motoristasCustom, motoristasInativos: window.motoristasInativos
    }).catch(err => alert("Erro ao salvar: " + err.message));
}

// ================= MODAL SISTEMA & IMPORTAÇÃO IA =================
window.abrirModalSistema = function() { document.getElementById('modalSistema').classList.remove('hidden'); lucide.createIcons(); }
window.fecharModalSistema = function() { document.getElementById('modalSistema').classList.add('hidden'); document.getElementById('codigoIA').value = ''; }

window.gerarBackup = function() {
    const dadosStr = JSON.stringify(window.bancoDadosCloud, null, 2);
    const blob = new Blob([dadosStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `backup_sgc_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    alert("Backup gerado com sucesso! Guarde o arquivo .json em um local seguro.");
}

// BOTÃO VERMELHO DO PÂNICO CORRIGIDO COM AWAIT
window.apagarTudo = async function() {
    let senha = prompt("⚠️ CUIDADO EXTREMO! Isso vai apagar TODOS os lançamentos de TODOS os meses do sistema.\n\nPara confirmar, digite a palavra: APAGAR");
    
    if (senha === 'APAGAR') {
        window.bancoDadosCloud = {}; // Zera os dados localmente
        
        try {
            // AWAIT: Obriga o navegador a esperar o Firebase confirmar que apagou tudo lá na nuvem!
            await setDoc(docRef, {
                lancamentos: {}, 
                configs: window.configMesesCloud, 
                slas: window.configSlaCloud, 
                motoristasCustom: window.motoristasCustom, 
                motoristasInativos: window.motoristasInativos
            });
            alert("Base de dados zerada com sucesso!");
            window.fecharModalSistema();
            location.reload(); // Só recarrega a página depois que a nuvem já estiver vazia
        } catch(e) {
            alert("Erro ao tentar apagar: " + e.message);
        }
    } else if (senha !== null) {
        alert("Palavra incorreta. Ação cancelada, nada foi apagado.");
    }
}

// A FUNÇÃO MESTRA DE LEITURA DA INTELIGÊNCIA ARTIFICIAL (CORRIGIDA)
window.importarDadosIA = function() {
    const jsonText = document.getElementById('codigoIA').value.trim();
    if (!jsonText) { alert("Cole o código gerado pela IA antes de importar!"); return; }

    let dados;
    try {
        dados = JSON.parse(jsonText);
    } catch(e) {
        alert("Erro no código! Certifique-se de copiar exatamente o bloco de código que a IA mandou.");
        return;
    }

    if(document.getElementById('loader')) { document.getElementById('loader').style.display = 'flex'; document.getElementById('loader').style.opacity = '1'; }

    let banco = window.bancoDadosCloud;
    dados.sort((a, b) => new Date(a.data) - new Date(b.data));

    let inseridos = 0;
    dados.forEach(lanc => {
        let dataStr = lanc.data;
        let mot = lanc.motorista.toUpperCase().trim();
        if (!window.motoristas.includes(mot)) return; 
        
        if (!banco[dataStr]) banco[dataStr] = {};

        let statusFinal = (lanc.status || 'normal').toLowerCase();
        let servicosFinais = parseInt(lanc.qtd);
        if (isNaN(servicosFinais)) servicosFinais = 0;
        
        let isFeriadoFinal = lanc.isFeriado === true;
        let tipoVeiculoFinal = lanc.veiculo || (window.motOutros.includes(mot) ? 'cacamba' : 'poliguindaste');
        let valorExtraFinal = parseFloat(lanc.extra) || 0;
        let observacaoFinal = lanc.observacao || "";

        if (statusFinal !== 'normal') {
            servicosFinais = 0;
            valorExtraFinal = 0;
        }

        let dataObj = new Date(dataStr + 'T00:00:00');
        let diaSemana = dataObj.getDay();
        let isDomingo = diaSemana === 0;
        let isSabado = diaSemana === 6;

        // 🔥 CORREÇÃO DA META AQUI! AGORA ELE PUXA 8 PRA TODOS E 4 PRO ROBERTO CARLOS
        let metaFinanceira = window.getMetaDiaria(mot); 
        let valorExtraPorUnidade = 10;
        
        if (tipoVeiculoFinal === 'cacamba') { metaFinanceira = 4; valorExtraPorUnidade = 20; }
        else if (tipoVeiculoFinal === 'poli_duplo') { metaFinanceira = 8; valorExtraPorUnidade = 10; }
        else if (tipoVeiculoFinal === 'misto') { metaFinanceira = 6; valorExtraPorUnidade = 10; }

        let valorNormalBase = 0; let bateuMetaSemana = false;

        if (statusFinal === 'normal') {
            if (isDomingo || isFeriadoFinal) {
                valorNormalBase = servicosFinais * 30;
            } else if (isSabado) {
                let pontosFeitosSemana = 0; let qtdFeriadosSemana = 0;
                for (let i = 1; i <= 5; i++) {
                    let d = new Date(dataObj); d.setDate(dataObj.getDate() - (6 - i));
                    let dStr = window.formatarDataParaBusca(d);
                    let lancamentoDia = banco[dStr]?.[mot];
                    if (lancamentoDia && lancamentoDia.status === 'normal') {
                        if (lancamentoDia.isFeriado) qtdFeriadosSemana++;
                        else pontosFeitosSemana += window.calcularPontosMotorista(mot, lancamentoDia.servicos, lancamentoDia.tipoVeiculo);
                    }
                }
                let metaBaseMotorista = window.getMetaDiaria(mot);
                let metaSemanalPontos = (5 - qtdFeriadosSemana) * metaBaseMotorista;
                let pontosFaltantes = Math.max(0, metaSemanalPontos - pontosFeitosSemana);

                let divisorParaFisico = 1;
                if(tipoVeiculoFinal === 'poli_duplo') divisorParaFisico = 0.5;
                if(tipoVeiculoFinal === 'cacamba') divisorParaFisico = metaBaseMotorista / 4;
                if(tipoVeiculoFinal === 'misto') divisorParaFisico = metaBaseMotorista / 6;

                let servicosFaltantesFisicos = pontosFaltantes / divisorParaFisico;
                let servicosParaMeta = Math.min(servicosFinais, servicosFaltantesFisicos);
                let servicosBonus = Math.max(0, servicosFinais - servicosFaltantesFisicos);

                let calcServicosNormais = 0;
                if (servicosParaMeta >= metaFinanceira) { calcServicosNormais = 50 + ((servicosParaMeta - metaFinanceira) * valorExtraPorUnidade); if(calcServicosNormais < 50) calcServicosNormais = 50; }
                let calcServicosBonus = servicosBonus * (valorExtraPorUnidade * 2);

                valorNormalBase = calcServicosNormais + calcServicosBonus;
                bateuMetaSemana = servicosBonus > 0;
            } else {
                if (servicosFinais >= metaFinanceira) { valorNormalBase = 50 + ((servicosFinais - metaFinanceira) * valorExtraPorUnidade); }
            }
        }

        let valorFinal = valorNormalBase + valorExtraFinal;

        banco[dataStr][mot] = {
            servicos: servicosFinais,
            valor: valorFinal,
            isFeriado: isFeriadoFinal,
            ganhouBonusSemana: bateuMetaSemana,
            tipoVeiculo: tipoVeiculoFinal,
            valorExtra: valorExtraFinal,
            pontos: window.calcularPontosMotorista(mot, servicosFinais, tipoVeiculoFinal),
            observacao: observacaoFinal,
            status: statusFinal
        };
        inseridos++;
    });

    window.syncToFirebase();
    window.sincronizarMesFiltro(); window.atualizarResumosGlobais(); window.gerarRankingPeriodo(); window.gerarRankingMensal(); window.gerarPainelFeriados();
    if(window.motoristaSelecionado) { window.carregarHistoricoMotorista(); window.atualizarResumosDoMotorista(); window.atualizarGraficosProjecao(); }

    if(document.getElementById('loader')) { document.getElementById('loader').style.opacity = '0'; setTimeout(()=> document.getElementById('loader').style.display = 'none', 300); }
    window.fecharModalSistema();
    alert(`Sucesso! ${inseridos} lançamentos da IA foram injetados no sistema.`);
}
// =================================================================

window.gerenciarMotoristas = function() { window.abrirModalGerenciar(); }
window.abrirModalGerenciar = function() {
    const modal = document.getElementById('modalGerenciar'); const selDesativar = document.getElementById('desativarMotNome'); const selReativar = document.getElementById('reativarMotNome');
    selDesativar.innerHTML = '<option value="">Selecione quem desativar...</option>'; selReativar.innerHTML = '<option value="">Selecione quem reativar...</option>';
    window.motoristas.forEach(m => { if(!window.motoristasInativos.includes(m)) selDesativar.innerHTML += `<option value="${m}">${m}</option>`; });
    window.motoristasInativos.forEach(m => { selReativar.innerHTML += `<option value="${m}">${m}</option>`; });
    modal.classList.remove('hidden'); lucide.createIcons();
}
window.fecharModalGerenciar = function() { document.getElementById('modalGerenciar').classList.add('hidden'); document.getElementById('novoMotNome').value = ''; }
window.addMotoristaModal = function() {
    let nome = document.getElementById('novoMotNome').value.toUpperCase().trim(); let turno = document.getElementById('novoMotTurno').value;
    if (!nome) return; window.motoristasCustom[nome] = turno; window.syncToFirebase(); window.reconstruirListasMotoristas(); window.fecharModalGerenciar();
}
window.desativarMotoristaModal = function() {
    let nome = document.getElementById('desativarMotNome').value; if (!nome) return; window.motoristasInativos.push(nome); window.syncToFirebase(); window.reconstruirListasMotoristas(); window.fecharModalGerenciar();
}
window.reativarMotoristaModal = function() {
    let nome = document.getElementById('reativarMotNome').value; if (!nome) return; window.motoristasInativos = window.motoristasInativos.filter(m => m !== nome); window.syncToFirebase(); window.reconstruirListasMotoristas(); window.fecharModalGerenciar();
}

window.reconstruirListasMotoristas = function() {
    window.motRayanna = [...motRayannaBase]; window.motJulia = [...motJuliaBase]; window.motOutros = [...motOutrosBase];
    for(let mot in window.motoristasCustom) {
        let turno = window.motoristasCustom[mot];
        if(turno === 'dia' && !window.motRayanna.includes(mot)) window.motRayanna.push(mot);
        else if(turno === 'noite' && !window.motJulia.includes(mot)) window.motJulia.push(mot);
        else if(turno === 'especial' && !window.motOutros.includes(mot)) window.motOutros.push(mot);
    }
    window.motoristas = [...window.motRayanna, ...window.motJulia, ...window.motOutros].sort();
    window.renderizarSidebar();
    
    const selProjMot = document.getElementById('filtroProjMot');
    if(selProjMot) {
        let selecionadoAntes = selProjMot.value; selProjMot.innerHTML = '<option value="">Selecione...</option>';
        window.motoristas.forEach(m => { let opt = document.createElement('option'); opt.value = m; opt.textContent = m; selProjMot.appendChild(opt); });
        if(window.motoristas.includes(selecionadoAntes)) selProjMot.value = selecionadoAntes;
    }
}

window.getMetaDiaria = function(nome) { return nome === "ROBERTO CARLOS" ? 4 : 8; }

const dataHoje = new Date(); const offset = dataHoje.getTimezoneOffset() * 60000; const dataLocal = new Date(dataHoje.getTime() - offset);
const hojeStr = dataLocal.toISOString().split('T')[0]; const anoMesAtual = hojeStr.substring(0, 7); const startStr = `${anoMesAtual}-01`;

if(document.getElementById('dataGlobal')) document.getElementById('dataGlobal').value = anoMesAtual; 
if(document.getElementById('dataLancamento')) document.getElementById('dataLancamento').value = hojeStr;
if(document.getElementById('dataRankingInicio')) document.getElementById('dataRankingInicio').value = hojeStr;
if(document.getElementById('dataRankingFim')) document.getElementById('dataRankingFim').value = hojeStr;
if(document.getElementById('mesFiltro')) document.getElementById('mesFiltro').value = anoMesAtual;
if(document.getElementById('dataDomInicio')) document.getElementById('dataDomInicio').value = startStr;
if(document.getElementById('dataDomFim')) document.getElementById('dataDomFim').value = hojeStr;
if(document.getElementById('dataFerInicio')) document.getElementById('dataFerInicio').value = startStr;
if(document.getElementById('dataFerFim')) document.getElementById('dataFerFim').value = hojeStr;
if(document.getElementById('dataProjInicio')) document.getElementById('dataProjInicio').value = startStr;
if(document.getElementById('dataProjFim')) document.getElementById('dataProjFim').value = hojeStr;

window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    if(sidebar.classList.contains('w-[280px]')) { sidebar.classList.remove('w-[280px]'); sidebar.classList.add('w-0'); } 
    else { sidebar.classList.remove('w-0'); sidebar.classList.add('w-[280px]'); }
}

window.motoristaTemLancamentoNoMes = function(nome, mes) {
    for (let data in window.bancoDadosCloud) { if (data.startsWith(mes) && window.bancoDadosCloud[data][nome]) return true; }
    return false;
}

window.renderizarSidebar = function() {
    const ul = document.getElementById('listaMotoristas'); const selectFiltro = document.getElementById('filtroTurno');
    if(!ul) return; ul.innerHTML = '';
    let filtroVal = selectFiltro ? selectFiltro.value : 'todos'; const elMes = document.getElementById('dataGlobal');
    let mesAtualFiltro = elMes && elMes.value ? elMes.value.substring(0, 7) : anoMesAtual;

    function criarGrupo(titulo, lista, icone) {
        let listaFiltrada = lista.filter(mot => { let isInativo = window.motoristasInativos.includes(mot); let temLancamento = window.motoristaTemLancamentoNoMes(mot, mesAtualFiltro); return !(isInativo && !temLancamento); }).sort();
        if(listaFiltrada.length === 0) return;
        const tituloEl = document.createElement('div'); tituloEl.innerHTML = `${icone} ${titulo}`; ul.appendChild(tituloEl);
        listaFiltrada.forEach(mot => {
            let isInativo = window.motoristasInativos.includes(mot); const li = document.createElement('li'); li.className = 'driver-item';
            if (mot === window.motoristaSelecionado) li.classList.add('active');
            if(isInativo) li.innerHTML = `<span class="text-red-500 w-full block font-black leading-tight">${mot} <span class="text-[9px] opacity-70 ml-1 bg-red-100 px-1 rounded">(Inativo)</span></span>`;
            else li.textContent = mot;
            li.onclick = () => window.selecionarMotorista(mot, li); ul.appendChild(li);
        });
    }
    if(filtroVal === 'todos' || filtroVal === 'dia') criarGrupo('Dia (Rayanna)', window.motRayanna, '☀️');
    if(filtroVal === 'todos' || filtroVal === 'noite') criarGrupo('Noite (Júlia)', window.motJulia, '🌙');
    if(filtroVal === 'todos' || filtroVal === 'especial') criarGrupo('Especial (Caçamba)', window.motOutros, '🚛');
    lucide.createIcons();
}

window.toggleTravaGlobais = function() {
    window.diasUteisTravado = !window.diasUteisTravado;
    const inLanc = document.getElementById('inputDiasUteisLanc'); const inRank = document.getElementById('inputDiasUteisRank');
    const btnLanc = document.getElementById('btnTravaLanc'); const btnRank = document.getElementById('btnTravaRank');
    if(!inLanc || !inRank) return;
    if(window.diasUteisTravado) {
        inLanc.setAttribute('readonly', 'true'); inRank.setAttribute('readonly', 'true');
        if(btnLanc) btnLanc.innerHTML = '<i data-lucide="lock" class="w-5 h-5"></i>'; if(btnRank) btnRank.innerHTML = '<i data-lucide="lock" class="w-5 h-5"></i>';
    } else {
        inLanc.removeAttribute('readonly'); inRank.removeAttribute('readonly');
        if(btnLanc) btnLanc.innerHTML = '<i data-lucide="unlock" class="w-5 h-5"></i>'; if(btnRank) btnRank.innerHTML = '<i data-lucide="unlock" class="w-5 h-5"></i>';
        if(document.getElementById('viewLancamentos') && document.getElementById('viewLancamentos').style.display !== 'none') inLanc.focus(); else inRank.focus();
    }
    lucide.createIcons();
}

window.toggleTravaSla = function() {
    if(!window.motoristaSelecionado) { alert("Selecione um motorista primeiro!"); return; }
    const inSla = document.getElementById('inputSlaMotorista'); const btnSla = document.getElementById('btnTravaSla'); if(!inSla || !btnSla) return;
    const elMes = document.getElementById('dataGlobal'); let mesFiltroStr = elMes && elMes.value ? elMes.value.substring(0, 7) : new Date().toISOString().substring(0, 7);
    let chaveComMes = window.motoristaSelecionado + "_" + mesFiltroStr;
    if(inSla.hasAttribute('readonly')) {
        inSla.removeAttribute('readonly'); btnSla.innerHTML = '<i data-lucide="unlock" class="w-4 h-4"></i>'; btnSla.className = 'text-amber-500 hover:text-amber-700 bg-white p-2 rounded-lg shadow-sm border border-amber-100 transition-colors shrink-0';
        delete window.configSlaCloud[chaveComMes]; window.syncToFirebase(); inSla.value = window.carregarDiasUteis(mesFiltroStr); window.atualizarResumosDoMotorista();
    } else {
        inSla.setAttribute('readonly', 'true'); btnSla.innerHTML = '<i data-lucide="lock" class="w-4 h-4"></i>'; btnSla.className = 'bg-red-100 text-red-600 hover:text-red-700 p-2 rounded-lg shadow-sm border border-red-200 transition-colors shrink-0'; window.salvarSlaMotorista();
    }
    lucide.createIcons();
}

window.atualizarSlaInput = function() {
    if(!window.motoristaSelecionado) return;
    const elMes = document.getElementById('dataGlobal'); let mesFiltroStr = elMes && elMes.value ? elMes.value.substring(0, 7) : new Date().toISOString().substring(0, 7);
    let globalSla = window.carregarDiasUteis(mesFiltroStr); let chaveComMes = window.motoristaSelecionado + "_" + mesFiltroStr; let customSla = window.configSlaCloud[chaveComMes];
    const inSla = document.getElementById('inputSlaMotorista'); const btnSla = document.getElementById('btnTravaSla');
    if(inSla && btnSla) {
        if(customSla) { inSla.value = customSla; inSla.setAttribute('readonly', 'true'); btnSla.innerHTML = '<i data-lucide="lock" class="w-4 h-4"></i>'; btnSla.className = 'bg-red-100 text-red-600 hover:text-red-700 p-2 rounded-lg shadow-sm border border-red-200 transition-colors shrink-0'; } 
        else { inSla.value = globalSla; inSla.removeAttribute('readonly'); btnSla.innerHTML = '<i data-lucide="unlock" class="w-4 h-4"></i>'; btnSla.className = 'text-amber-500 hover:text-amber-700 bg-white p-2 rounded-lg shadow-sm border border-amber-100 transition-colors shrink-0'; }
    }
    lucide.createIcons();
}

window.salvarSlaMotorista = function() {
    if(!window.motoristaSelecionado) return;
    const inSla = document.getElementById('inputSlaMotorista'); const btnSla = document.getElementById('btnTravaSla'); const elMes = document.getElementById('dataGlobal');
    let mesFiltroStr = elMes && elMes.value ? elMes.value.substring(0, 7) : new Date().toISOString().substring(0, 7);
    if(!inSla) return; let val = parseInt(inSla.value); let chaveComMes = window.motoristaSelecionado + "_" + mesFiltroStr;
    if(val > 0) { window.configSlaCloud[chaveComMes] = val; window.syncToFirebase(); inSla.setAttribute('readonly', 'true');
        if(btnSla) { btnSla.innerHTML = '<i data-lucide="lock" class="w-4 h-4"></i>'; btnSla.className = 'bg-red-100 text-red-600 hover:text-red-700 p-2 rounded-lg shadow-sm border border-red-200 transition-colors shrink-0'; lucide.createIcons(); }
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
    if(!inputRef) return; let anoMesStr = inputRef.value; window.configMesesCloud[anoMesStr] = parseInt(valor) || 22; window.syncToFirebase(); window.atualizarResumosGlobais(); window.atualizarSlaInput();
}

window.sincronizarMesData = function() {
    const dtG = document.getElementById('dataGlobal'); const msF = document.getElementById('mesFiltro'); if(!dtG || !msF) return;
    let anoMesStr = dtG.value; msF.value = anoMesStr; window.carregarDiasUteis(anoMesStr); window.renderizarSidebar();
}

window.sincronizarMesFiltro = function() {
    const msF = document.getElementById('mesFiltro'); if(!msF) return; let anoMesStr = msF.value; window.carregarDiasUteis(anoMesStr); window.renderizarSidebar();
}

window.calcularPrevisao = function(totalSoma, anoMesStr, diasUteisAlvo) {
    if (totalSoma === 0) return 0;
    const dataAtual = new Date(); const anoAtual = dataAtual.getFullYear(); const mesAtual = String(dataAtual.getMonth() + 1).padStart(2, '0'); const strAtual = `${anoAtual}-${mesAtual}`;
    let diasUteisTotais = diasUteisAlvo || window.carregarDiasUteis(anoMesStr); let diasUteisCorridos = 0;
    if (anoMesStr < strAtual) { diasUteisCorridos = diasUteisTotais; } else if (anoMesStr > strAtual) { return 0; } else {
        let diaHoje = dataAtual.getDate(); let diasNoMes = new Date(anoAtual, mesAtual, 0).getDate(); let progresso = diaHoje / diasNoMes; 
        diasUteisCorridos = Math.max(1, Math.round(diasUteisTotais * progresso));
    }
    return Math.round((totalSoma / diasUteisCorridos) * diasUteisTotais);
}

window.mudarAba = function(aba) {
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
    ['viewLancamentos','viewRankings','viewDomFeriados','viewProjecao'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).style.display = 'none'; });
    if (aba === 'lancamentos') { if(document.getElementById('btnTabLancamentos')) document.getElementById('btnTabLancamentos').classList.add('active'); if(document.getElementById('viewLancamentos')) document.getElementById('viewLancamentos').style.display = 'block'; } 
    else if (aba === 'rankings') { if(document.getElementById('btnTabRankings')) document.getElementById('btnTabRankings').classList.add('active'); if(document.getElementById('viewRankings')) document.getElementById('viewRankings').style.display = 'block'; window.gerarRankingPeriodo(); window.gerarRankingMensal(); } 
    else if (aba === 'domferiados') { if(document.getElementById('btnTabDomFeriados')) document.getElementById('btnTabDomFeriados').classList.add('active'); if(document.getElementById('viewDomFeriados')) document.getElementById('viewDomFeriados').style.display = 'block'; window.gerarPainelFeriados(); } 
    else if (aba === 'projecao') { if(document.getElementById('btnTabProjecao')) document.getElementById('btnTabProjecao').classList.add('active'); if(document.getElementById('viewProjecao')) document.getElementById('viewProjecao').style.display = 'block'; window.atualizarGraficosProjecao(); }
}

window.filtrarMotoristas = function() {
    const busca = document.getElementById('buscaMotorista'); if(!busca) return;
    const input = busca.value.toUpperCase(); const itensLista = document.querySelectorAll('.driver-item');
    itensLista.forEach(item => { const nome = item.textContent || item.innerText; item.style.display = (nome.toUpperCase().indexOf(input) > -1) ? "" : "none"; });
}

window.selecionarMotorista = function(nome, elementoLista) {
    window.motoristaSelecionado = nome;
    document.querySelectorAll('.driver-item').forEach(el => el.classList.remove('active'));
    if(elementoLista) elementoLista.classList.add('active');
    
    if(document.getElementById('estadoVazio')) document.getElementById('estadoVazio').style.display = 'none';
    if(document.getElementById('conteudoMotorista')) document.getElementById('conteudoMotorista').style.display = 'block';
    if(document.getElementById('nomeMotoristaDisplay')) document.getElementById('nomeMotoristaDisplay').textContent = nome;
    
    const selectVeiculo = document.getElementById('tipoVeiculo');
    if(selectVeiculo) {
        selectVeiculo.innerHTML = `
            <option value="poliguindaste">Poliguindaste Simples (Meta 4 Cx p/ Faturamento)</option>
            <option value="poli_duplo">Poliguindaste Duplo (Meta 8 Cx p/ Faturamento)</option>
            <option value="cacamba">Caminhão Caçamba (Meta 4 Vg p/ Faturamento)</option>
        `;
        if(window.motOutros.includes(nome)) { selectVeiculo.value = "cacamba"; } else { selectVeiculo.value = "poliguindaste"; }
    }

    if(document.getElementById('filtroProjMot')) document.getElementById('filtroProjMot').value = nome;
    window.atualizarSlaInput(); window.carregarHistoricoMotorista(); window.atualizarResumosDoMotorista(); window.atualizarGraficosProjecao();
}

window.selecionarMotoristaProjecao = function(nome) { if(!nome) return; window.selecionarMotorista(nome, null); }
window.formatarDataParaBusca = function(data) { const ano = data.getFullYear(); const mes = String(data.getMonth() + 1).padStart(2, '0'); const dia = String(data.getDate()).padStart(2, '0'); return `${ano}-${mes}-${dia}`; }
window.formatarDataParaExibicao = function(dataStr) { const partes = dataStr.split('-'); return `${partes[2]}/${partes[1]}/${partes[0]}`; }

// ================= SALVAMENTO COMPLEXO COM ANEXOS E STATUS =================
window.salvarLancamento = async function() {
    if (!window.motoristaSelecionado) { alert("Selecione um motorista primeiro!"); return; }
    const elData = document.getElementById('dataLancamento'); const dataStr = elData ? elData.value : null;
    if (!dataStr) { alert("Preencha a data do serviço."); return; }

    const statusInput = document.getElementById('statusServico').value;
    let tipoVeiculoInput = document.getElementById('tipoVeiculo').value;
    let servicosRaw = document.getElementById('servicos').value; 
    let valorExtraInput = parseFloat(document.getElementById('valorExtra').value.replace(',','.')) || 0;
    let isFeriadoInput = document.getElementById('feriado') ? document.getElementById('feriado').checked : false;
    let observacaoInput = document.getElementById('observacao') ? document.getElementById('observacao').value.trim() : "";
    let fileInput = document.getElementById('anexoObs');

    if (statusInput === "normal" && servicosRaw === "" && valorExtraInput === 0 && observacaoInput === "" && (!fileInput || fileInput.files.length === 0)) {
        alert("Preencha a quantidade (pode ser 0), valor extra, anexo ou coloque uma observação."); return;
    }

    let servicosInput = parseInt(servicosRaw);
    if (isNaN(servicosInput)) servicosInput = 0;

    if (statusInput !== 'normal') { servicosInput = 0; valorExtraInput = 0; }

    let linkAnexo = "";
    if (fileInput && fileInput.files.length > 0) {
        let file = fileInput.files[0];
        document.getElementById('btnSalvarL').innerHTML = `<div class="spinner w-4 h-4 border-2"></div> Salvando Foto...`;
        document.getElementById('btnSalvarL').disabled = true;
        try {
            let storageRef = ref(storage, 'anexos/' + Date.now() + '_' + file.name);
            await uploadBytes(storageRef, file);
            linkAnexo = await getDownloadURL(storageRef);
        } catch (e) {
            alert("Erro ao fazer upload da foto. Verifique as regras do Firebase Storage!");
            document.getElementById('btnSalvarL').innerHTML = `<i data-lucide="save" class="w-4 h-4 shrink-0"></i> Gravar`;
            document.getElementById('btnSalvarL').disabled = false;
            return;
        }
        document.getElementById('btnSalvarL').innerHTML = `<i data-lucide="save" class="w-4 h-4 shrink-0"></i> Gravar`;
        document.getElementById('btnSalvarL').disabled = false;
    }

    let bancoDados = window.bancoDadosCloud;
    if (!bancoDados[dataStr]) bancoDados[dataStr] = {};
    let lancamentoExistente = bancoDados[dataStr][window.motoristaSelecionado];

    let servicosFinais = servicosInput;
    let valorExtraFinal = valorExtraInput;
    let isFeriadoFinal = isFeriadoInput;
    let observacaoFinal = observacaoInput;
    let tipoVeiculoFinal = tipoVeiculoInput;
    let linkAnexoFinal = linkAnexo;
    let statusFinal = statusInput;

    if (lancamentoExistente) {
        if (lancamentoExistente.status !== 'normal' && statusInput === 'normal') {
            servicosFinais = servicosInput; valorExtraFinal = valorExtraInput;
        } else {
            servicosFinais += (lancamentoExistente.servicos || 0); valorExtraFinal += (lancamentoExistente.valorExtra || 0);
        }
        isFeriadoFinal = isFeriadoInput || lancamentoExistente.isFeriado; 
        if (lancamentoExistente.observacao && observacaoInput) observacaoFinal = lancamentoExistente.observacao + " | " + observacaoInput;
        else if (lancamentoExistente.observacao) observacaoFinal = lancamentoExistente.observacao;
        if (lancamentoExistente.linkAnexo && !linkAnexo) linkAnexoFinal = lancamentoExistente.linkAnexo;
        if (lancamentoExistente.tipoVeiculo && lancamentoExistente.tipoVeiculo !== tipoVeiculoInput && statusInput === 'normal') {
            tipoVeiculoFinal = 'misto'; if(!observacaoFinal.includes("[MISTO]")) observacaoFinal = "[MISTO] " + observacaoFinal;
        } else { tipoVeiculoFinal = lancamentoExistente.tipoVeiculo; }
    }

    const dataObj = new Date(dataStr + 'T00:00:00'); const diaSemana = dataObj.getDay(); const isDomingo = diaSemana === 0; const isSabado = diaSemana === 6;
    
    let metaFinanceira = 4; let valorExtraPorUnidade = 10;
    if (tipoVeiculoFinal === 'cacamba') { metaFinanceira = 4; valorExtraPorUnidade = 20; } 
    else if (tipoVeiculoFinal === 'poli_duplo') { metaFinanceira = 8; valorExtraPorUnidade = 10; } 
    else if (tipoVeiculoFinal === 'misto') { metaFinanceira = 6; valorExtraPorUnidade = 10; }

    let valorNormalBase = 0; let bateuMetaSemana = false;

    if (statusFinal === 'normal') {
        if (isDomingo || isFeriadoFinal) { valorNormalBase = servicosFinais * 30; } 
        else if (isSabado) {
            let pontosFeitosSemana = 0; let qtdFeriadosSemana = 0;
            for (let i = 1; i <= 5; i++) {
                let d = new Date(dataObj); d.setDate(dataObj.getDate() - (6 - i));
                let dStr = window.formatarDataParaBusca(d); let lancamentoDia = bancoDados[dStr]?.[window.motoristaSelecionado];
                if (lancamentoDia && (!lancamentoDia.status || lancamentoDia.status === 'normal')) {
                    if (lancamentoDia.isFeriado) { qtdFeriadosSemana++; } 
                    else { 
                        let srv = isNaN(lancamentoDia.servicos) ? 0 : lancamentoDia.servicos;
                        pontosFeitosSemana += window.calcularPontosMotorista(window.motoristaSelecionado, srv, lancamentoDia.tipoVeiculo);
                    }
                }
            }
            let metaBaseMotorista = window.getMetaDiaria(window.motoristaSelecionado); let metaSemanalPontos = (5 - qtdFeriadosSemana) * metaBaseMotorista; 
            let pontosFaltantes = Math.max(0, metaSemanalPontos - pontosFeitosSemana);
            let divisorParaFisico = 1;
            if(tipoVeiculoFinal === 'poli_duplo') divisorParaFisico = 0.5;
            if(tipoVeiculoFinal === 'cacamba') divisorParaFisico = metaBaseMotorista / 4;
            if(tipoVeiculoFinal === 'misto') divisorParaFisico = metaBaseMotorista / 6;

            let servicosFaltantesFisicos = pontosFaltantes / divisorParaFisico;
            let servicosParaMeta = Math.min(servicosFinais, servicosFaltantesFisicos);
            let servicosBonus = Math.max(0, servicosFinais - servicosFaltantesFisicos);

            let calcServicosNormais = 0;
            if (servicosParaMeta >= metaFinanceira) { calcServicosNormais = 50 + ((servicosParaMeta - metaFinanceira) * valorExtraPorUnidade); if(calcServicosNormais < 50) calcServicosNormais = 50; }
            let calcServicosBonus = servicosBonus * (valorExtraPorUnidade * 2); 

            valorNormalBase = calcServicosNormais + calcServicosBonus; bateuMetaSemana = servicosBonus > 0;
        } 
        else {
            if (servicosFinais >= metaFinanceira) { valorNormalBase = 50 + ((servicosFinais - metaFinanceira) * valorExtraPorUnidade); }
        }
    }
    
    let valorFinal = valorNormalBase + valorExtraFinal;

    bancoDados[dataStr][window.motoristaSelecionado] = {
        servicos: servicosFinais, valor: valorFinal, isFeriado: isFeriadoFinal, ganhouBonusSemana: bateuMetaSemana, tipoVeiculo: tipoVeiculoFinal, valorExtra: valorExtraFinal,
        pontos: window.calcularPontosMotorista(window.motoristaSelecionado, servicosFinais, tipoVeiculoFinal),
        observacao: observacaoFinal, linkAnexo: linkAnexoFinal, status: statusFinal
    };

    window.syncToFirebase();
    
    if(document.getElementById('servicos')) document.getElementById('servicos').value = ''; if(document.getElementById('valorExtra')) document.getElementById('valorExtra').value = '';
    if(document.getElementById('observacao')) document.getElementById('observacao').value = ''; if(document.getElementById('feriado')) document.getElementById('feriado').checked = false;
    if(document.getElementById('statusServico')) document.getElementById('statusServico').value = 'normal'; if(document.getElementById('anexoObs')) document.getElementById('anexoObs').value = '';
    if(document.getElementById('nomeAnexo')) document.getElementById('nomeAnexo').classList.add('hidden');
}
// ====================================================================

window.carregarHistoricoMotorista = function() {
    if (!window.motoristaSelecionado) return;
    const tbody = document.querySelector('#tabelaHistorico tbody');
    if(!tbody) return; tbody.innerHTML = ''; 
    const bancoDados = window.bancoDadosCloud;
    const elMes = document.getElementById('dataGlobal');
    const mesFiltroStr = elMes && elMes.value ? elMes.value.substring(0, 7) : new Date().toISOString().substring(0, 7);

    let historico = [];
    for (const data in bancoDados) { if (data.startsWith(mesFiltroStr) && bancoDados[data][window.motoristaSelecionado]) { historico.push({ data: data, dados: bancoDados[data][window.motoristaSelecionado] }); } }
    historico.sort((a, b) => new Date(b.data) - new Date(a.data));

    if (historico.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-slate-400 font-medium py-8">Nenhum lançamento encontrado neste mês.</td></tr>'; return;
    }

    historico.forEach(item => {
        const tr = document.createElement('tr');
        let tagsDia = ''; const dataObj = new Date(item.data + 'T00:00:00');
        if (dataObj.getDay() === 0) tagsDia += '<span class="badge-feriado">DOMINGO</span> ';
        if (item.dados.isFeriado) tagsDia += '<span class="badge-feriado">FERIADO</span> ';
        if (item.dados.ganhouBonusSemana) tagsDia += '<span class="badge-meta">META SAB BATIDA</span>';
        if (tagsDia === '') tagsDia = 'Normal';

        let tagStatus = '';
        if (item.dados.status === 'falta') tagStatus = '<span class="bg-red-500 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase">Falta</span>';
        else if (item.dados.status === 'folga') tagStatus = '<span class="bg-slate-500 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase">Folga</span>';
        else if (item.dados.status === 'atestado') tagStatus = '<span class="bg-yellow-400 text-slate-800 px-2 py-0.5 rounded text-[10px] font-black uppercase">Atestado</span>';
        else if (item.dados.status === 'polioff') tagStatus = '<span class="bg-orange-500 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase">Poli OFF</span>';
        else if (item.dados.status === 'licenca') tagStatus = '<span class="bg-purple-500 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase">Licença</span>';

        let tagVeiculo = 'POLIGUINDASTE';
        if (item.dados.tipoVeiculo === 'cacamba') tagVeiculo = 'CAÇAMBA';
        if (item.dados.tipoVeiculo === 'poli_duplo') tagVeiculo = 'POLI. DUPLO';
        if (item.dados.tipoVeiculo === 'misto') tagVeiculo = 'VEÍC. MISTO';

        let stringColuna2 = tagStatus ? tagStatus : `<span class="badge-veiculo">${tagVeiculo}</span><br><span class="inline-block mt-1">${tagsDia}</span>`;

        let qtdText = item.dados.tipoVeiculo === 'cacamba' ? `${item.dados.servicos} vg` : `${item.dados.servicos} cx`;
        if (item.dados.status && item.dados.status !== 'normal') qtdText = "-";

        let extraTxt = item.dados.valorExtra > 0 ? `+ R$ ${item.dados.valorExtra.toFixed(2).replace('.',',')}` : '-';
        let obsText = item.dados.observacao ? item.dados.observacao : '-';
        
        let linkAnexo = "";
        if(item.dados.linkAnexo) {
            linkAnexo = `<a href="${item.dados.linkAnexo}" target="_blank" class="text-blue-500 hover:text-blue-700 block mt-1"><i data-lucide="image" class="w-3 h-3 inline"></i> Ver Anexo</a>`;
        }

        tr.innerHTML = `
            <td class="text-slate-800 font-bold">${window.formatarDataParaExibicao(item.data)}</td>
            <td>${stringColuna2}</td>
            <td class="text-center font-black">${qtdText}</td>
            <td class="text-center text-blue-600 font-bold">${extraTxt}</td>
            <td class="text-right text-emerald-600 font-black text-sm">R$ ${item.dados.valor.toFixed(2).replace('.', ',')}</td>
            <td class="text-xs text-slate-500 max-w-[150px] truncate" title="${obsText}">${obsText} ${linkAnexo}</td>
            <td class="text-center"><button class="btn-delete" onclick="window.deletarLancamentoEspecifico('${item.data}')">Excluir</button></td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
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
    const elLanc = document.getElementById('dataLancamento'); if(!elLanc) return;
    const dataRefStr = elLanc.value; if (!dataRefStr) return;
    const bancoDados = window.bancoDadosCloud;
    
    let totalDia = 0;
    if (bancoDados[dataRefStr] && bancoDados[dataRefStr][window.motoristaSelecionado]) totalDia = bancoDados[dataRefStr][window.motoristaSelecionado].valor;
    if(document.getElementById('motoristaTotalDia')) document.getElementById('motoristaTotalDia').innerText = `R$ ${totalDia.toFixed(2).replace('.', ',')}`;

    let totalSemana = 0; const dataObj = new Date(dataRefStr + 'T00:00:00');
    const diffParaSegunda = (dataObj.getDay() === 0) ? -6 : 1 - dataObj.getDay();
    const dataSegunda = new Date(dataObj); dataSegunda.setDate(dataObj.getDate() + diffParaSegunda);

    for (let i = 0; i < 7; i++) {
        const diaCheck = new Date(dataSegunda); diaCheck.setDate(dataSegunda.getDate() + i);
        const diaCheckStr = window.formatarDataParaBusca(diaCheck);
        if (bancoDados[diaCheckStr] && bancoDados[diaCheckStr][window.motoristaSelecionado]) totalSemana += bancoDados[diaCheckStr][window.motoristaSelecionado].valor;
    }
    if(document.getElementById('motoristaTotalSemana')) document.getElementById('motoristaTotalSemana').innerText = `R$ ${totalSemana.toFixed(2).replace('.', ',')}`;

    const elMes = document.getElementById('dataGlobal');
    const anoMesFiltro = elMes && elMes.value ? elMes.value.substring(0, 7) : dataRefStr.substring(0, 7);
    
    let totalCaixasMes = 0; let totalViagensMes = 0; let totalFatMes = 0; let totalPontosMes = 0;

    for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
        if (dataStr.startsWith(anoMesFiltro)) {
            const dObj = new Date(dataStr + 'T00:00:00');
            if (dadosDia[window.motoristaSelecionado]) {
                let r = dadosDia[window.motoristaSelecionado];
                if (dObj.getDay() !== 0 && !r.isFeriado && (!r.status || r.status === 'normal')) {
                    if(r.tipoVeiculo === 'cacamba') totalViagensMes += r.servicos;
                    else totalCaixasMes += r.servicos;
                    totalPontosMes += (r.pontos !== undefined) ? r.pontos : window.calcularPontosMotorista(window.motoristaSelecionado, r.servicos, r.tipoVeiculo);
                }
                totalFatMes += r.valor;
            }
        }
    }

    let metaDiaria = window.getMetaDiaria(window.motoristaSelecionado);
    let diasUteisGlobais = window.carregarDiasUteis(anoMesFiltro);
    let chaveComMes = window.motoristaSelecionado + "_" + anoMesFiltro;
    let diasUteisMotorista = window.configSlaCloud[chaveComMes] || diasUteisGlobais;
    let metaMensalPontos = diasUteisMotorista * metaDiaria; 
    let previsaoPontos = window.calcularPrevisao(totalPontosMes, anoMesFiltro, diasUteisMotorista);

    let textoMeta = "";
    if (window.motOutros.includes(window.motoristaSelecionado)) {
        textoMeta = `${metaMensalPontos / 2} vg`;
        if(document.getElementById('motoristaCaixasMes')) document.getElementById('motoristaCaixasMes').innerText = `${totalCaixasMes} cx | ${totalViagensMes} vg`;
        if(document.getElementById('motoristaPrevisaoMes')) document.getElementById('motoristaPrevisaoMes').innerText = `${previsaoPontos / 2} vg`;
    } else {
        textoMeta = `${metaMensalPontos} cx`;
        if(document.getElementById('motoristaCaixasMes')) document.getElementById('motoristaCaixasMes').innerText = `${totalCaixasMes} cx`;
        let exibeCaixas = (totalPontosMes > 0 && totalCaixasMes > totalPontosMes) ? Math.round(previsaoPontos * (totalCaixasMes / totalPontosMes)) : previsaoPontos;
        if(document.getElementById('motoristaPrevisaoMes')) document.getElementById('motoristaPrevisaoMes').innerText = `${exibeCaixas} cx`;
    }
    if(document.getElementById('motoristaMetaMes')) document.getElementById('motoristaMetaMes').innerText = `Meta (Elo): ${textoMeta} | Fat: R$ ${totalFatMes.toFixed(2).replace('.', ',')}`;
}

window.atualizarResumosGlobais = function() {
    const elLanc = document.getElementById('dataLancamento'); const dataRefStr = elLanc ? elLanc.value : null;
    const elGlobal = document.getElementById('dataGlobal'); const mesGlobalStr = elGlobal ? elGlobal.value.substring(0, 7) : (dataRefStr ? dataRefStr.substring(0, 7) : null);
    if(!mesGlobalStr) return; const bancoDados = window.bancoDadosCloud;
    let totalDiaGlobal = 0; let caixasDiaGlobal = 0; let totalMesGlobal = 0; let caixasMesGlobal = 0;

    if (dataRefStr && bancoDados[dataRefStr]) {
        for (const mot in bancoDados[dataRefStr]) {
            totalDiaGlobal += bancoDados[dataRefStr][mot].valor;
            if(bancoDados[dataRefStr][mot].tipoVeiculo !== 'cacamba' && (!bancoDados[dataRefStr][mot].status || bancoDados[dataRefStr][mot].status === 'normal')) {
                caixasDiaGlobal += bancoDados[dataRefStr][mot].servicos;
            }
        }
    }

    for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
        if (dataStr.startsWith(mesGlobalStr)) {
            for (const mot in dadosDia) { 
                totalMesGlobal += dadosDia[mot].valor; 
                if(dadosDia[mot].tipoVeiculo !== 'cacamba' && (!dadosDia[mot].status || dadosDia[mot].status === 'normal')) {
                    caixasMesGlobal += dadosDia[mot].servicos;
                }
            }
        }
    }
    
    if(document.getElementById('totalDiaGlobal')) { document.getElementById('totalDiaGlobal').innerText = `R$ ${totalDiaGlobal.toFixed(2).replace('.', ',')}`; document.getElementById('totalDiaGlobal').previousElementSibling.innerText = "TOTAL FROTA (DIA SEL.)"; }
    if(document.getElementById('caixasDiaGlobal')) { document.getElementById('caixasDiaGlobal').innerText = `${caixasDiaGlobal} cx`; }
    if(document.getElementById('totalSemanaGlobal')) { document.getElementById('totalSemanaGlobal').innerText = `R$ ${totalMesGlobal.toFixed(2).replace('.', ',')}`; document.getElementById('totalSemanaGlobal').previousElementSibling.innerText = "TOTAL FROTA (MÊS)"; }
    if(document.getElementById('caixasSemanaGlobal')) { document.getElementById('caixasSemanaGlobal').innerText = `${caixasMesGlobal} cx`; }
}

window.gerarRankingPeriodo = function() {
    const elInicio = document.getElementById('dataRankingInicio'); const elFim = document.getElementById('dataRankingFim');
    if(!elInicio || !elFim) return; const inicio = elInicio.value; const fim = elFim.value; if(!inicio || !fim) return;
    const bancoDados = window.bancoDadosCloud; let rankPeriodo = {};
    
    for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
        if (dataStr >= inicio && dataStr <= fim) {
            const isDomingo = new Date(dataStr + 'T00:00:00').getDay() === 0;
            for (const [mot, dados] of Object.entries(dadosDia)) {
                if (!rankPeriodo[mot]) rankPeriodo[mot] = { caixas: 0, viagens: 0, valor: 0, extra: 0, diasTrab: 0, pontos: 0 };
                
                // MUDANÇA DAQUI: Soma o valor e o extra MESMO se for domingo/feriado!
                rankPeriodo[mot].valor += dados.valor;
                rankPeriodo[mot].extra += dados.valorExtra || 0;

                // Mas só soma as CAIXAS e a META se for dia útil e tiver trabalhado
                if (!isDomingo && !dados.isFeriado && (!dados.status || dados.status === 'normal')) {
                    if(dados.tipoVeiculo === 'cacamba') rankPeriodo[mot].viagens += dados.servicos;
                    else rankPeriodo[mot].caixas += dados.servicos;
                    rankPeriodo[mot].pontos += (dados.pontos !== undefined) ? dados.pontos : window.calcularPontosMotorista(mot, dados.servicos, dados.tipoVeiculo);
                    rankPeriodo[mot].diasTrab += 1;
                }
            }
        }
    }

    let rankArray = Object.keys(rankPeriodo).map(mot => {
        let metaTotalPeriodo = window.getMetaDiaria(mot) * rankPeriodo[mot].diasTrab;
        let porcentagem = metaTotalPeriodo > 0 ? (rankPeriodo[mot].pontos / metaTotalPeriodo) * 100 : 0;
        return { nome: mot, ...rankPeriodo[mot], porcentagem: porcentagem };
    })
    .filter(item => item.pontos > 0 || item.valor > 0); // Só mostra quem faturou ou fez ponto

    rankArray.sort((a,b) => b.porcentagem - a.porcentagem);
    const divLista = document.getElementById('listaRankingDiario'); if(!divLista) return; divLista.innerHTML = '';
    if(rankArray.length === 0) { divLista.innerHTML = '<div class="text-center text-slate-400 py-8 font-medium">Nenhum serviço normal no período. 😴</div>'; return; }

    rankArray.forEach((mot, index) => {
        let porcentagemStr = mot.porcentagem.toFixed(2).replace('.', ',');
        let classeBarra = ''; if(mot.porcentagem >= 100) classeBarra = 'meta-batida'; else if (mot.porcentagem >= 80) classeBarra = 'meta-excedida'; else classeBarra = 'meta-ruim'; 
        let larguraBarra = mot.porcentagem > 100 ? 100 : mot.porcentagem; 
        let extraBadge = mot.extra > 0 ? `<span class="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded ml-2">+ Extra R$ ${mot.extra}</span>` : '';
        let textoQtd = "";
        if (window.motOutros.includes(mot.nome)) {
            if(mot.caixas > 0 && mot.viagens > 0) textoQtd = `${mot.caixas} cx | ${mot.viagens} vg`; else if (mot.caixas > 0) textoQtd = `${mot.caixas} cx | 0 vg`; else textoQtd = `0 cx | ${mot.viagens} vg`;
        } else { textoQtd = `${mot.caixas} cx`; }

        const linha = document.createElement('div'); linha.className = 'diario-row';
        linha.innerHTML = `
            <div class="diario-top"><span class="diario-nome">#${index + 1} - ${mot.nome} <span class="text-blue-500 font-black">(${textoQtd})</span> ${extraBadge}</span><span class="diario-faturamento">R$ ${mot.valor.toFixed(2).replace('.', ',')}</span></div>
            <div class="progress-wrapper"><div class="progress-bar-bg"><div class="progress-bar-fill ${classeBarra}" style="width: ${larguraBarra}%;"></div></div><span class="progress-text" title="Baseado nos dias trabalhados">${porcentagemStr}%</span></div>
        `;
        divLista.appendChild(linha);
    });
}

window.obterRankElo = function(percentual) {
    if (percentual >= 100) return { nome: 'Radiante', classe: 'elo-radiante' }; if (percentual >= 80) return { nome: 'Diamante', classe: 'elo-diamante' }; return { nome: 'Bronze', classe: 'elo-bronze' };
}

window.gerarRankingMensal = function() {
    const elFiltro = document.getElementById('mesFiltro'); if(!elFiltro) return; const mesFiltro = elFiltro.value; if (!mesFiltro) return;
    let diasUteisGlobais = window.carregarDiasUteis(mesFiltro); const bancoDados = window.bancoDadosCloud;
    
    let acumuladoMes = {}; 
    let totalCaixasFrota = 0; let totalViagensFrota = 0; let totalFatMesFrota = 0;
    
    // 1. Descobrir qual foi o PRIMEIRO dia útil do mês no sistema
    let todasDatasMes = Object.keys(bancoDados).filter(d => d.startsWith(mesFiltro)).sort();
    let primeiroDiaUtilComDados = null;
    
    for(let data of todasDatasMes) {
        let dObj = new Date(data + 'T00:00:00');
        let temFeriado = Object.values(bancoDados[data]).some(l => l.isFeriado);
        if(dObj.getDay() !== 0 && !temFeriado) {
            primeiroDiaUtilComDados = data;
            break;
        }
    }

    window.motoristas.forEach(m => {
        acumuladoMes[m] = { 
            caixas: 0, viagens: 0, valor: 0, pontos: 0, 
            diasAptosMotorista: 0, // Conta apenas dias que ele estava apto a rodar
            comecouComPoliOff: false,
            foiDesligado: false
        };
    });

    for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
        if (dataStr.startsWith(mesFiltro)) {
            const isDomingo = new Date(dataStr + 'T00:00:00').getDay() === 0;
            for (const [mot, dados] of Object.entries(dadosDia)) {
                if (acumuladoMes[mot]) {
                    
                    let statusMot = (dados.status || 'normal').toLowerCase();

                    // REGRA 1: Verifica se no primeiro dia útil o cara já começou com Poli Off
                    if (dataStr === primeiroDiaUtilComDados && statusMot === 'polioff') {
                        acumuladoMes[mot].comecouComPoliOff = true;
                    }
                    // REGRA 2: Verifica se foi desligado da empresa
                    if (statusMot === 'desligado') {
                        acumuladoMes[mot].foiDesligado = true;
                    }

                    // CONTAGEM DE DIAS DE META PROPORCIONAL:
                    // Se não for domingo nem feriado...
                    if (!isDomingo && !dados.isFeriado) {
                        // Só conta como dia apto se NÃO foi desligado e NÃO estava com o caminhão quebrado (polioff)
                        if (statusMot !== 'desligado' && statusMot !== 'polioff') {
                            acumuladoMes[mot].diasAptosMotorista++;
                        }
                    }

                    if (!isDomingo && !dados.isFeriado && statusMot === 'normal') {
                        if(dados.tipoVeiculo === 'cacamba') { acumuladoMes[mot].viagens += dados.servicos; totalViagensFrota += dados.servicos; } 
                        else { acumuladoMes[mot].caixas += dados.servicos; totalCaixasFrota += dados.servicos; }
                        acumuladoMes[mot].pontos += (dados.pontos !== undefined) ? dados.pontos : window.calcularPontosMotorista(mot, dados.servicos, dados.tipoVeiculo);
                    }
                    acumuladoMes[mot].valor += dados.valor;
                    totalFatMesFrota += dados.valor;
                }
            }
        }
    }

    // A MÁGICA ACONTECE AQUI: Função que decide qual é a Meta de cada Motorista
    function getSlaMotorista(mot, mesFiltro, info) {
        // Se você travou manualmente a meta dele no botão do cadeado, o sistema obedece
        if (window.configSlaCloud[mot + "_" + mesFiltro]) return window.configSlaCloud[mot + "_" + mesFiltro];
        
        // Se ele caiu em uma das duas exceções, a meta vira proporcional!
        if (info && (info.comecouComPoliOff || info.foiDesligado)) {
            return info.diasAptosMotorista > 0 ? info.diasAptosMotorista : diasUteisGlobais;
        }
        
        // Se ele trabalhou normal, leva a meta global (cheia)
        return diasUteisGlobais; 
    }

    let ptsRayanna = 0, feitasRayanna = 0;
    window.motRayanna.forEach(mot => { 
        let info = acumuladoMes[mot];
        let diasUteisMotorista = getSlaMotorista(mot, mesFiltro, info);
        ptsRayanna += window.getMetaDiaria(mot) * diasUteisMotorista; 
        if(info) feitasRayanna += info.pontos; 
    });
    
    let ptsJulia = 0, feitasJulia = 0;
    window.motJulia.forEach(mot => { 
        let info = acumuladoMes[mot];
        let diasUteisMotorista = getSlaMotorista(mot, mesFiltro, info);
        ptsJulia += window.getMetaDiaria(mot) * diasUteisMotorista; 
        if(info) feitasJulia += info.pontos; 
    });

    let ptsGeral = ptsRayanna + ptsJulia; let feitasGeral = feitasRayanna + feitasJulia;

    if(document.getElementById('totalViagensMesGlobal')) document.getElementById('totalViagensMesGlobal').innerText = `${totalViagensFrota} vg`;
    if(document.getElementById('totalFatMensalLeaderboard')) document.getElementById('totalFatMensalLeaderboard').innerText = `R$ ${totalFatMesFrota.toFixed(2).replace('.', ',')}`;

    function renderizarMeta(feitas, meta, elValor, elFalta) {
        let perc = meta > 0 ? ((feitas / meta) * 100).toFixed(1) : 0; let faltam = Math.max(0, meta - feitas);
        if(document.getElementById(elValor)) document.getElementById(elValor).innerText = `${Math.round(feitas)} / ${meta} cx`;
        if(document.getElementById(elFalta)) document.getElementById(elFalta).innerText = `${perc}% | Faltam ${Math.round(faltam)} cx`;
    }
    renderizarMeta(feitasGeral, ptsGeral, 'metaGeralGlobal', 'faltaGeralGlobal'); 
    renderizarMeta(feitasRayanna, ptsRayanna, 'metaRayannaGlobal', 'faltaRayannaGlobal'); 
    renderizarMeta(feitasJulia, ptsJulia, 'metaJuliaGlobal', 'faltaJuliaGlobal');

    let rankFinal = Object.keys(acumuladoMes)
        .map(mot => {
            let info = acumuladoMes[mot];
            let diasUteisMotorista = getSlaMotorista(mot, mesFiltro, info);
            let metaMensalPontos = diasUteisMotorista * window.getMetaDiaria(mot);
            let percentualMeta = metaMensalPontos > 0 ? ((info.pontos / metaMensalPontos) * 100) : 0;
            return { nome: mot, caixas: info.caixas, viagens: info.viagens, valor: info.valor, pontos: info.pontos, percentual: percentualMeta, diasBase: diasUteisMotorista };
        })
        .filter(item => item.pontos > 0 || item.valor > 0)
        .sort((a, b) => b.percentual - a.percentual); 

    const divLista = document.getElementById('listaLeaderboard'); if(!divLista) return; divLista.innerHTML = '';
    if(rankFinal.length === 0) { divLista.innerHTML = '<div class="text-center text-slate-400 py-8 font-medium">Sem registros válidos. O elo de todo mundo é Ferro! 🥶</div>'; return; }

    rankFinal.forEach((mot, index) => {
        const eloInfo = window.obterRankElo(mot.percentual); let percentualStr = mot.percentual.toFixed(2).replace('.', ',');
        let corPercent, bgPercent, borderPercent;
        if (mot.percentual >= 100) { corPercent = '#10b981'; bgPercent = '#d1fae5'; borderPercent = '#a7f3d0'; } else if (mot.percentual >= 80) { corPercent = '#d97706'; bgPercent = '#fef3c7'; borderPercent = '#fde68a'; } else { corPercent = '#ef4444'; bgPercent = '#fee2e2'; borderPercent = '#fca5a5'; }

        let textoQtd = "";
        if (window.motOutros.includes(mot.nome)) { if(mot.caixas > 0 && mot.viagens > 0) textoQtd = `${mot.caixas} cx | ${mot.viagens} vg`; else if (mot.caixas > 0) textoQtd = `${mot.caixas} cx | 0 vg`; else textoQtd = `0 cx | ${mot.viagens} vg`; } 
        else { textoQtd = `${mot.caixas} cx`; }

        let htmlFaltam = ""; let metaMensalPontos = mot.diasBase * window.getMetaDiaria(mot.nome); let faltam = metaMensalPontos - mot.pontos;
        if (faltam > 0) {
            let txtFaltam = window.motOutros.includes(mot.nome) ? `Faltam ${Math.ceil(faltam / 2)} vg` : `Faltam ${Math.ceil(faltam)} cx`;
            htmlFaltam = `<span class="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded ml-2 font-bold">${txtFaltam}</span>`;
        } else { htmlFaltam = `<span class="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded ml-2 font-bold">Meta OK!</span>`; }

        const linha = document.createElement('div'); linha.className = 'elo-row';
        linha.innerHTML = `<div class="posicao">#${index + 1}</div><div class="nome-motorista-rank">${mot.nome}<span class="valor-sub">Fat: R$ ${mot.valor.toFixed(2).replace('.', ',')}</span></div><div><span class="badge-elo ${eloInfo.classe}">${eloInfo.nome}</span></div><div class="valor-destaque text-blue-500 flex items-center">${textoQtd}<span class="badge-percent text-[11px]" style="background:${bgPercent}; color:${corPercent}; border-color:${borderPercent};" title="Meta Atingida (SLA: ${mot.diasBase} dias)">${percentualStr}%</span>${htmlFaltam}</div>`;
        divLista.appendChild(linha);
    });
}

window.gerarPainelFeriados = function() {
    const domInicio = document.getElementById('dataDomInicio') ? document.getElementById('dataDomInicio').value : null; const domFim = document.getElementById('dataDomFim') ? document.getElementById('dataDomFim').value : null;
    const ferInicio = document.getElementById('dataFerInicio') ? document.getElementById('dataFerInicio').value : null; const ferFim = document.getElementById('dataFerFim') ? document.getElementById('dataFerFim').value : null;
    const bancoDados = window.bancoDadosCloud; let registrosDom = []; let registrosFer = []; let fatTotalDom = 0, fatTotalFer = 0;

    for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
        const dataObj = new Date(dataStr + 'T00:00:00'); const isDomingo = dataObj.getDay() === 0;
        for (const [mot, dados] of Object.entries(dadosDia)) {
            // Continua exibindo domingos na aba só se tiver feito dinheiro
            if (!(dados.servicos > 0) && (!dados.status || dados.status === 'normal')) continue; 

            let obj = { dataStr: dataStr, nome: mot, caixas: dados.tipoVeiculo !== 'cacamba' ? dados.servicos : 0, viagens: dados.tipoVeiculo === 'cacamba' ? dados.servicos : 0, valor: dados.valor, status: dados.status };
            if (isDomingo && !dados.isFeriado) { if (!domInicio || !domFim || (dataStr >= domInicio && dataStr <= domFim)) { registrosDom.push(obj); fatTotalDom += dados.valor; } }
            if (dados.isFeriado) { if (!ferInicio || !ferFim || (dataStr >= ferInicio && dataStr <= ferFim)) { registrosFer.push(obj); fatTotalFer += dados.valor; } }
        }
    }

    if(document.getElementById('totalFatDom')) document.getElementById('totalFatDom').innerText = `R$ ${fatTotalDom.toFixed(2).replace('.', ',')}`;
    if(document.getElementById('totalFatFer')) document.getElementById('totalFatFer').innerText = `R$ ${fatTotalFer.toFixed(2).replace('.', ',')}`;
    if(document.getElementById('totalGeralDomFer')) document.getElementById('totalGeralDomFer').innerText = `R$ ${(fatTotalDom + fatTotalFer).toFixed(2).replace('.', ',')}`;

    function renderizarLista(listaRegistros, idElemento, msgVazia) {
        listaRegistros.sort((a, b) => { if(a.dataStr !== b.dataStr) return new Date(b.dataStr) - new Date(a.dataStr); return b.valor - a.valor; });
        const divLista = document.getElementById(idElemento); if(!divLista) return; divLista.innerHTML = '';
        if(listaRegistros.length === 0) { divLista.innerHTML = `<div class="text-center text-slate-400 py-8 font-medium">${msgVazia}</div>`; return; }

        listaRegistros.forEach((mot) => {
            let textoQtd = "";
            if(mot.status && mot.status !== 'normal') textoQtd = `<span class="bg-red-500 text-white px-2 py-0.5 rounded text-[10px] uppercase font-bold">${mot.status}</span>`;
            else if (window.motOutros.includes(mot.nome)) { if(mot.caixas > 0 && mot.viagens > 0) textoQtd = `${mot.caixas} cx | ${mot.viagens} vg`; else if (mot.caixas > 0) textoQtd = `${mot.caixas} cx | 0 vg`; else textoQtd = `0 cx | ${mot.viagens} vg`; } 
            else { textoQtd = `${mot.caixas} cx`; }

            let dataFormatada = window.formatarDataParaExibicao(mot.dataStr); const linha = document.createElement('div'); linha.className = 'diario-row';
            linha.innerHTML = `<div class="diario-top" style="margin:0;"><span class="diario-nome" style="display:flex; align-items:center; gap:8px;"><span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-black">${dataFormatada}</span>${mot.nome} <span class="text-blue-500">(${textoQtd})</span></span><span class="diario-faturamento text-red-500">R$ ${mot.valor.toFixed(2).replace('.', ',')}</span></div>`;
            divLista.appendChild(linha);
        });
    }

    renderizarLista(registrosDom, 'listaDomingos', 'Nenhum serviço em domingos no período selecionado. 😴');
    renderizarLista(registrosFer, 'listaFeriados', 'Nenhum serviço em feriados no período selecionado. 😴');
}

window.atualizarGraficosProjecao = function() {
    const bancoDados = window.bancoDadosCloud;
    const inicio = document.getElementById('dataProjInicio') ? document.getElementById('dataProjInicio').value : null;
    const fim = document.getElementById('dataProjFim') ? document.getElementById('dataProjFim').value : null;
    const filtroTurno = document.getElementById('filtroProjTurno') ? document.getElementById('filtroProjTurno').value : 'todos';

    if (!inicio || !fim) return;

    let dIni = new Date(inicio + 'T00:00:00'); let dFim = new Date(fim + 'T00:00:00');
    dIni.setMonth(dIni.getMonth() - 1); dFim.setMonth(dFim.getMonth() - 1);
    
    let inicioPassadoStr = window.formatarDataParaBusca(dIni); let fimPassadoStr = window.formatarDataParaBusca(dFim);
    let dadosEvolucaoInd = []; let mapGeral = {}; let stats = { atual: 0, passado: 0 };
    
    let diasTrabalhadosInd = 0; let diasMetaBatidaInd = 0; let somaServicosFisicosReal = 0; let maxServicosDiarios = 0; let dataRecordeFisico = '';
    let somaPontosDiaDaSemana = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }; const nomesDias = { 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };

    if(document.getElementById('projecaoNomeMotorista')) document.getElementById('projecaoNomeMotorista').innerText = window.motoristaSelecionado || "Ninguém Selecionado";

    for (const [data, motoristasDia] of Object.entries(bancoDados)) {
        let isPeriodoAtual = (data >= inicio && data <= fim); let isPeriodoPassado = (data >= inicioPassadoStr && data <= fimPassadoStr);
        let dataObj = new Date(data + 'T00:00:00'); let diaDaSemana = dataObj.getDay(); let pontosDiaGeral = 0;
        
        for (const [mot, dados] of Object.entries(motoristasDia)) {
            let statusN = (!dados.status || dados.status === 'normal');
            let pts = (dados.pontos !== undefined) ? dados.pontos : window.calcularPontosMotorista(mot, dados.servicos, dados.tipoVeiculo);
            let qtdReal = statusN ? dados.servicos : 0;
            
            if (mot === window.motoristaSelecionado) {
                if (isPeriodoAtual && !dados.isFeriado && diaDaSemana !== 0 && statusN) {
                    stats.atual += pts;
                    if (diaDaSemana >= 1 && diaDaSemana <= 5) {
                        diasTrabalhadosInd++;
                        if (pts >= window.getMetaDiaria(mot)) diasMetaBatidaInd++;
                        somaServicosFisicosReal += qtdReal;
                    }
                    if (qtdReal > maxServicosDiarios) { maxServicosDiarios = qtdReal; dataRecordeFisico = data; }
                }
                if (isPeriodoPassado && !dados.isFeriado && diaDaSemana !== 0 && statusN) { stats.passado += pts; }
                if (isPeriodoAtual && statusN) { dadosEvolucaoInd.push({ dataStr: data, pontos: pts }); }
            }
            
            let incluirNoGeral = false;
            if (filtroTurno === 'todos') incluirNoGeral = true;
            else if (filtroTurno === 'dia' && window.motRayanna.includes(mot)) incluirNoGeral = true;
            else if (filtroTurno === 'noite' && window.motJulia.includes(mot)) incluirNoGeral = true;
            else if (filtroTurno === 'especial' && window.motOutros.includes(mot)) incluirNoGeral = true;

            if (isPeriodoAtual && incluirNoGeral && !dados.isFeriado && diaDaSemana !== 0 && statusN) {
                pontosDiaGeral += pts; somaPontosDiaDaSemana[diaDaSemana] += pts; 
            }
        }
        if (isPeriodoAtual) mapGeral[data] = pontosDiaGeral;
    }

    let txtSufixo = (window.motOutros.includes(window.motoristaSelecionado)) ? " vg" : " cx";
    
    if(document.getElementById('statMesAtual')) document.getElementById('statMesAtual').innerText = Math.round(stats.atual) + txtSufixo;
    if(document.getElementById('statMesPassado')) document.getElementById('statMesPassado').innerText = Math.round(stats.passado) + txtSufixo;
    
    let elCrescimento = document.getElementById('statCrescimento');
    if(elCrescimento) {
        if (!window.motoristaSelecionado) { elCrescimento.innerHTML = `<span class="text-slate-500 bg-slate-100 px-3 py-1 rounded-xl text-sm font-bold">Selecione na lista</span>`; } 
        else {
            let diff = Math.round(stats.atual - stats.passado);
            if (diff > 0) elCrescimento.innerHTML = `<span class="text-emerald-600 bg-emerald-100 px-3 py-1 rounded-xl text-sm font-bold">+${diff}${txtSufixo}</span><span class="text-xs text-slate-500 font-medium">vs Per. Anterior</span>`;
            else if (diff < 0) elCrescimento.innerHTML = `<span class="text-red-600 bg-red-100 px-3 py-1 rounded-xl text-sm font-bold">-${Math.abs(diff)}${txtSufixo}</span><span class="text-xs text-slate-500 font-medium">vs Per. Anterior</span>`;
            else elCrescimento.innerHTML = `<span class="text-slate-600 bg-slate-100 px-3 py-1 rounded-xl text-sm font-bold">Empatado</span><span class="text-xs text-slate-500 font-medium">vs Per. Anterior</span>`;
        }
    }

    let winRate = diasTrabalhadosInd > 0 ? Math.round((diasMetaBatidaInd / diasTrabalhadosInd) * 100) : 0;
    if(document.getElementById('statWinRate')) {
        document.getElementById('statWinRate').innerText = `${winRate}%`; document.getElementById('statWinRateSub').innerText = `${diasMetaBatidaInd} metas batidas em ${diasTrabalhadosInd} dias úteis`;
    }

    let mediaReal = diasTrabalhadosInd > 0 ? (somaServicosFisicosReal / diasTrabalhadosInd).toFixed(1) : 0;
    let metaDiariaFixa = window.motoristaSelecionado ? window.getMetaDiaria(window.motoristaSelecionado) : 0;
    if(document.getElementById('statMediaReal')) {
        document.getElementById('statMediaReal').innerText = `${mediaReal} ${txtSufixo}/dia`;
        let metaVisual = window.motOutros.includes(window.motoristaSelecionado) ? (metaDiariaFixa / 2) + " vg" : metaDiariaFixa + " cx";
        document.getElementById('statMediaNec').innerText = `SLA pede: ${metaVisual} /dia`;
    }

    if(document.getElementById('statRecorde')) {
        document.getElementById('statRecorde').innerText = `${maxServicosDiarios} ${txtSufixo}`; document.getElementById('statRecordeData').innerText = dataRecordeFisico ? `Dia ${window.formatarDataParaExibicao(dataRecordeFisico)}` : "Sem registros";
    }

    let melhorDiaChave = Object.keys(somaPontosDiaDaSemana).reduce((a, b) => somaPontosDiaDaSemana[a] > somaPontosDiaDaSemana[b] ? a : b);
    let ptsMelhorDia = somaPontosDiaDaSemana[melhorDiaChave];
    if(document.getElementById('statMelhorDia')) {
        if (ptsMelhorDia > 0 && nomesDias[melhorDiaChave]) {
            document.getElementById('statMelhorDia').innerText = nomesDias[melhorDiaChave]; document.getElementById('statMelhorDiaPts').innerText = `${Math.round(ptsMelhorDia)} pts acumulados`;
        } else {
            document.getElementById('statMelhorDia').innerText = "N/A"; document.getElementById('statMelhorDiaPts').innerText = "Sem dados";
        }
    }

    dadosEvolucaoInd.sort((a, b) => new Date(a.dataStr) - new Date(b.dataStr));
    const labelsInd = dadosEvolucaoInd.map(d => window.formatarDataParaExibicao(d.dataStr).substring(0, 5)); const dataInd = dadosEvolucaoInd.map(d => d.pontos);
    let arrayGeral = Object.keys(mapGeral).map(k => ({ dataStr: k, pontos: mapGeral[k] })); arrayGeral.sort((a, b) => new Date(a.dataStr) - new Date(b.dataStr));
    const labelsGeral = arrayGeral.map(d => window.formatarDataParaExibicao(d.dataStr).substring(0, 5)); const dataGeral = arrayGeral.map(d => d.pontos);

    Chart.defaults.font.family = "'Inter', sans-serif";
    const ctxInd = document.getElementById('chartEvolucaoIndividual');
    if (ctxInd) {
        if (window.chartInstanciaInd) window.chartInstanciaInd.destroy();
        window.chartInstanciaInd = new Chart(ctxInd.getContext('2d'), { type: 'line', data: { labels: labelsInd, datasets: [{ label: 'Volume', data: dataInd, borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderWidth: 3, pointBackgroundColor: '#fff', pointBorderColor: '#2563eb', fill: true, tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } } });
    }
    const ctxGeral = document.getElementById('chartEvolucaoGeral');
    if (ctxGeral) {
        if (window.chartInstanciaGeral) window.chartInstanciaGeral.destroy();
        window.chartInstanciaGeral = new Chart(ctxGeral.getContext('2d'), { type: 'line', data: { labels: labelsGeral, datasets: [{ label: 'Frota', data: dataGeral, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 3, pointBackgroundColor: '#fff', pointBorderColor: '#10b981', fill: true, tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } } });
    }
}

// Função que lê o arquivo JSON e envia pro Firebase (CORRIGIDA PRO SEU SISTEMA)
window.processarRestauracaoBackup = function(event) {
    const arquivo = event.target.files[0];
    if (!arquivo) return;

    const leitor = new FileReader();
    
    leitor.onload = async function(e) {
        try {
            const dadosBackup = JSON.parse(e.target.result);
            
            // Verifica se o arquivo é um objeto (Backup) e não um array (Código da IA)
            if (typeof dadosBackup !== 'object' || Array.isArray(dadosBackup)) {
                alert("O arquivo selecionado não parece ser um backup válido gerado pelo botão do sistema.");
                document.getElementById('inputRestaurarBackup').value = '';
                return;
            }

            const qtdDias = Object.keys(dadosBackup).length;
            
            const confirmar = confirm(`✅ Arquivo de backup lido com sucesso!\nForam encontrados dados de ${qtdDias} dias diferentes.\n\n⚠️ ATENÇÃO: Isso vai SOBRESCREVER todos os lançamentos atuais com os dados deste backup.\n\nDeseja continuar?`);
            
            if (!confirmar) {
                document.getElementById('inputRestaurarBackup').value = '';
                return;
            }

            // Mostra a tela de carregamento
            if(document.getElementById('loader')) { document.getElementById('loader').style.display = 'flex'; document.getElementById('loader').style.opacity = '1'; }

            // Substitui os dados atuais pelos dados do Backup!
            window.bancoDadosCloud = dadosBackup;

            // Salva na nuvem usando a sua própria função já configurada
            window.syncToFirebase();

            // Atualiza todos os gráficos e tabelas da tela
            window.sincronizarMesFiltro(); 
            window.atualizarResumosGlobais(); 
            window.gerarRankingPeriodo(); 
            window.gerarRankingMensal(); 
            window.gerarPainelFeriados();
            if(window.motoristaSelecionado) { 
                window.carregarHistoricoMotorista(); 
                window.atualizarResumosDoMotorista(); 
                window.atualizarGraficosProjecao(); 
            }

            // Esconde a tela de carregamento
            if(document.getElementById('loader')) { document.getElementById('loader').style.opacity = '0'; setTimeout(()=> document.getElementById('loader').style.display = 'none', 300); }

            alert("🔥 Backup restaurado com sucesso! O painel já está atualizado.");
            document.getElementById('inputRestaurarBackup').value = '';

        } catch (erro) {
            console.error("Erro na restauração:", erro);
            alert("Deu ruim na leitura do arquivo! Verifique se é um arquivo .json válido.");
            if(document.getElementById('loader')) { document.getElementById('loader').style.opacity = '0'; setTimeout(()=> document.getElementById('loader').style.display = 'none', 300); }
        }
    };

    leitor.readAsText(arquivo);
}
