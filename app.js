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

// Listas separadas por Turno/Operadora
const motRayanna = ["ADRIELSON", "EMERSON", "JACKSON", "JAMERSON", "JOAO VICTOR", "JOELITON", "JONES", "LUIZ RODRIGUES", "MANSUETO", "MARCELO ANDRE", "MARIO", "MATHEUS", "RÉGIO", "ROBERTO CARLOS"];
const motJulia = ["BRUNO", "ELCIDES", "LUIZ RODRIGO", "MARCONI", "MAYKEL", "PLATINIS"];
const motOutros = ["CLOVIS", "RODRIGO"]; 

const motoristas = [...motRayanna, ...motJulia, ...motOutros].sort();

window.motoristaSelecionado = null;
window.chartInstanciaEvolucao = null;
window.diasUteisTravado = true;

window.bancoDadosCloud = {}; 
window.configMesesCloud = {};
window.configSlaCloud = {}; 

onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        window.bancoDadosCloud = data.lancamentos || {};
        window.configMesesCloud = data.configs || {};
        window.configSlaCloud = data.slas || {};
    } else {
        window.bancoDadosCloud = {};
        window.configMesesCloud = {};
        window.configSlaCloud = {};
        
        setDoc(docRef, {
            lancamentos: {},
            configs: {},
            slas: {}
        }).catch(err => {
            if(document.getElementById('loader-text')) {
                document.getElementById('loader-text').innerText = "ERRO DE PERMISSÃO NO FIREBASE!";
                document.getElementById('loader-text').style.color = "red";
            }
            console.error(err);
        });
    }

    if(window.motoristaSelecionado) {
        window.carregarHistoricoMotorista();
        window.atualizarResumosDoMotorista();
        window.atualizarGraficoEvolucao();
        window.atualizarSlaInput();
    }
    window.sincronizarMesFiltro();
    window.atualizarResumosGlobais();
    window.gerarRankingPeriodo();
    window.gerarRankingMensal();
    window.gerarPainelFeriados();

    setTimeout(() => {
        if(document.getElementById('loader')) {
            document.getElementById('loader').style.opacity = '0';
        }
    }, 300);
    setTimeout(() => {
        if(document.getElementById('loader')) {
            document.getElementById('loader').style.display = 'none';
        }
    }, 800);
    
}, (error) => {
    console.error("ERRO DO FIREBASE:", error);
    alert("Erro ao conectar no banco de dados!\n\nMotivo: " + error.message);
    if(document.getElementById('loader')) {
        document.getElementById('loader').style.display = 'none';
    }
});

window.syncToFirebase = function() {
    setDoc(docRef, {
        lancamentos: window.bancoDadosCloud,
        configs: window.configMesesCloud,
        slas: window.configSlaCloud
    }).catch(err => alert("Erro ao salvar: " + err.message));
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

if(document.getElementById('dataGlobal')) document.getElementById('dataGlobal').value = hojeStr;
if(document.getElementById('dataLancamento')) document.getElementById('dataLancamento').value = hojeStr;
if(document.getElementById('dataRankingInicio')) document.getElementById('dataRankingInicio').value = hojeStr;
if(document.getElementById('dataRankingFim')) document.getElementById('dataRankingFim').value = hojeStr;
if(document.getElementById('mesFiltro')) document.getElementById('mesFiltro').value = anoMesAtual;
if(document.getElementById('dataDomInicio')) document.getElementById('dataDomInicio').value = startStr;
if(document.getElementById('dataDomFim')) document.getElementById('dataDomFim').value = hojeStr;

window.renderizarSidebar = function() {
    const ul = document.getElementById('listaMotoristas');
    if(!ul) return;
    ul.innerHTML = '';

    // Função interna para criar os grupos visuais
    function criarGrupo(titulo, lista, icone) {
        if(lista.length === 0) return;
        
        // Cria o título do grupo
        const tituloEl = document.createElement('div');
        tituloEl.innerHTML = `${icone} ${titulo}`;
        tituloEl.style.cssText = 'font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin: 15px 0 5px 5px; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;';
        ul.appendChild(tituloEl);

        // Adiciona os motoristas em ordem alfabética dentro do grupo
        [...lista].sort().forEach(mot => {
            const li = document.createElement('li');
            li.className = 'driver-item';
            li.textContent = mot;
            li.onclick = () => window.selecionarMotorista(mot, li);
            ul.appendChild(li);
        });
    }

    // Chama a criação dos 3 grupos
    criarGrupo('Dia (Rayanna)', motRayanna, '☀️');
    criarGrupo('Noite (Júlia)', motJulia, '🌙');
    criarGrupo('Especial (Caçamba)', motOutros, '🚛');
}
window.renderizarSidebar();

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
        if(btnLanc) btnLanc.innerText = '🔒';
        if(btnRank) btnRank.innerText = '🔒';
    } else {
        inLanc.removeAttribute('readonly');
        inRank.removeAttribute('readonly');
        if(btnLanc) btnLanc.innerText = '🔓';
        if(btnRank) btnRank.innerText = '🔓';
        if(document.getElementById('viewLancamentos') && document.getElementById('viewLancamentos').style.display !== 'none') inLanc.focus();
        else inRank.focus();
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
    let anoMesStr = isLancamento ? inputRef.value.substring(0,7) : inputRef.value;
    window.configMesesCloud[anoMesStr] = parseInt(valor) || 22;
    window.syncToFirebase();
}

window.atualizarSlaInput = function() {
    if(!window.motoristaSelecionado) return;
    const dtLanc = document.getElementById('dataLancamento');
    if(!dtLanc) return;
    let anoMesStr = dtLanc.value.substring(0,7);
    let globalSla = window.carregarDiasUteis(anoMesStr);
    let customSla = window.configSlaCloud?.[anoMesStr]?.[window.motoristaSelecionado];
    if(document.getElementById('inputSlaMotorista')) document.getElementById('inputSlaMotorista').value = customSla || globalSla;
}

window.salvarSlaMotorista = function() {
    if(!window.motoristaSelecionado) return;
    const dtLanc = document.getElementById('dataLancamento');
    if(!dtLanc) return;
    let anoMesStr = dtLanc.value.substring(0,7);
    if(!anoMesStr) return;
    
    const inputSla = document.getElementById('inputSlaMotorista');
    if(!inputSla) return;
    
    let val = parseInt(inputSla.value);
    let globalSla = window.carregarDiasUteis(anoMesStr);

    if(!window.configSlaCloud[anoMesStr]) window.configSlaCloud[anoMesStr] = {};

    if(val > 0 && val !== globalSla) {
        window.configSlaCloud[anoMesStr][window.motoristaSelecionado] = val;
    } else {
        delete window.configSlaCloud[anoMesStr][window.motoristaSelecionado];
    }
    window.syncToFirebase();
}

window.sincronizarMesData = function() {
    const dtG = document.getElementById('dataGlobal');
    const msF = document.getElementById('mesFiltro');
    if(!dtG || !msF) return;
    let anoMesStr = dtG.value.substring(0,7);
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
    
    const dtG = document.getElementById('dataGlobal');
    if(dtG && document.getElementById('dataLancamento')) document.getElementById('dataLancamento').value = dtG.value;
    
    const selectVeiculo = document.getElementById('tipoVeiculo');
    if(selectVeiculo) {
        if(nome === "CLOVIS" || nome === "RODRIGO") { 
            selectVeiculo.innerHTML = '<option value="cacamba">Caminhão Caçamba (Meta 4 Vg)</option><option value="poliguindaste">Poliguindaste (Meta 8 Cx)</option>';
            selectVeiculo.value = "cacamba"; 
        } 
        else if (nome === "ROBERTO CARLOS") {
            selectVeiculo.innerHTML = '<option value="poliguindaste">Poliguindaste (Meta 4 Cx)</option>';
            selectVeiculo.value = "poliguindaste";
        }
        else { 
            selectVeiculo.innerHTML = '<option value="poliguindaste">Poliguindaste (Meta 8 Cx)</option>';
            selectVeiculo.value = "poliguindaste"; 
        }
    }
    
    window.atualizarSlaInput();
    window.carregarHistoricoMotorista();
    window.atualizarResumosDoMotorista();
    window.atualizarGraficoEvolucao();
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

    const tipoVeiculo = document.getElementById('tipoVeiculo').value;
    const servicos = parseInt(document.getElementById('servicos').value);
    const valorExtraInput = document.getElementById('valorExtra').value;
    const valorExtra = valorExtraInput ? parseFloat(valorExtraInput.replace(',','.')) : 0;
    const isFeriado = document.getElementById('feriado') ? document.getElementById('feriado').checked : false;
    
    if (isNaN(servicos) && valorExtra === 0) {
        alert("Preencha serviços (ou zero) ou valor extra.");
        return;
    }

    const dataObj = new Date(dataStr + 'T00:00:00');
    const diaSemana = dataObj.getDay(); 
    const isDomingo = diaSemana === 0;
    const isSabado = diaSemana === 6;
    
    const metaBaseDia = window.getMetaDiaria(window.motoristaSelecionado);
    const metaBaseLancamento = (tipoVeiculo === 'cacamba') ? 4 : metaBaseDia;
    const multiplicadorExtra = (tipoVeiculo === 'cacamba') ? 20 : 10;

    let valorNormalBase = 0;
    let bateuMetaSemana = false;
    let bancoDados = window.bancoDadosCloud;

    if (isDomingo || isFeriado) {
        valorNormalBase = servicos * 30; 
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
                    if(lancamentoDia.tipoVeiculo === 'cacamba') viagensSegSex += lancamentoDia.servicos;
                    else caixasSegSex += lancamentoDia.servicos;
                }
            }
        }

        let pontosFeitosSemana = caixasSegSex + (viagensSegSex * 2);
        let metaSemanalPontos = (5 - qtdFeriadosSemana) * metaBaseDia; 
        let pontosFaltantes = Math.max(0, metaSemanalPontos - pontosFeitosSemana);

        let pontosDesteSabado = (tipoVeiculo === 'cacamba') ? servicos * 2 : servicos;
        let pontosParaMeta = Math.min(pontosDesteSabado, pontosFaltantes);
        let pontosBonus = Math.max(0, pontosDesteSabado - pontosFaltantes);

        let calcServicosNormais = 0;
        if (pontosParaMeta >= metaBaseDia) { 
            let equivalenciaReal = (tipoVeiculo === 'cacamba') ? (pontosParaMeta / 2) : pontosParaMeta;
            calcServicosNormais = 50 + ((equivalenciaReal - metaBaseLancamento) * multiplicadorExtra);
        }
        
        let calcServicosBonus = 0;
        if(tipoVeiculo === 'cacamba'){
            calcServicosBonus = (pontosBonus / 2) * 20; 
        } else {
            calcServicosBonus = pontosBonus * 20; 
        }

        valorNormalBase = calcServicosNormais + calcServicosBonus;
        bateuMetaSemana = pontosBonus > 0;
    } 
    else {
        if (servicos >= metaBaseLancamento) { 
            valorNormalBase = 50 + ((servicos - metaBaseLancamento) * multiplicadorExtra); 
        }
    }
    
    let valorFinal = valorNormalBase + valorExtra;
    
    if (!bancoDados[dataStr]) bancoDados[dataStr] = {};

    bancoDados[dataStr][window.motoristaSelecionado] = {
        servicos: servicos, 
        valor: valorFinal, 
        isFeriado: isFeriado, 
        ganhouBonusSemana: bateuMetaSemana,
        tipoVeiculo: tipoVeiculo,
        valorExtra: valorExtra
    };

    window.syncToFirebase();
    
    if(document.getElementById('servicos')) document.getElementById('servicos').value = '';
    if(document.getElementById('valorExtra')) document.getElementById('valorExtra').value = '';
    if(document.getElementById('feriado')) document.getElementById('feriado').checked = false;
}

window.carregarHistoricoMotorista = function() {
    if (!window.motoristaSelecionado) return;
    const tbody = document.querySelector('#tabelaHistorico tbody');
    if(!tbody) return;
    tbody.innerHTML = ''; 
    const bancoDados = window.bancoDadosCloud;
    let historico = [];

    for (const data in bancoDados) {
        if (bancoDados[data][window.motoristaSelecionado]) {
            historico.push({ data: data, dados: bancoDados[data][window.motoristaSelecionado] });
        }
    }
    historico.sort((a, b) => new Date(b.data) - new Date(a.data));

    if (historico.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding: 30px;">Nenhum lançamento encontrado.</td></tr>';
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

        let tagVeiculo = item.dados.tipoVeiculo === 'cacamba' ? 'CAÇAMBA' : 'POLIGUINDASTE';
        let qtdText = item.dados.tipoVeiculo === 'cacamba' ? `${item.dados.servicos} vg` : `${item.dados.servicos} cx`;
        let extraTxt = item.dados.valorExtra > 0 ? `+ R$ ${item.dados.valorExtra.toFixed(2).replace('.',',')}` : '-';

        tr.innerHTML = `
            <td><strong>${window.formatarDataParaExibicao(item.data)}</strong></td>
            <td><span class="badge-veiculo">${tagVeiculo}</span><br><span style="font-size:11px; margin-top:3px; display:block;">${tagsDia}</span></td>
            <td><strong>${qtdText}</strong></td>
            <td style="color: #8b5cf6; font-weight:600;">${extraTxt}</td>
            <td style="color: #10b981; font-weight: 700; font-size:16px;">R$ ${item.dados.valor.toFixed(2).replace('.', ',')}</td>
            <td><button class="btn-delete" onclick="window.deletarLancamentoEspecifico('${item.data}')">Excluir</button></td>
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

    const anoMesFiltro = dataRefStr.substring(0, 7);
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
    let diasUteisMotorista = window.configSlaCloud?.[anoMesFiltro]?.[window.motoristaSelecionado] || diasUteisGlobais;
    
    let metaMensalPontos = diasUteisMotorista * metaDiaria; 

    let previsaoCaixas = window.calcularPrevisao(totalCaixasMes, anoMesFiltro, diasUteisMotorista);
    let previsaoViagens = window.calcularPrevisao(totalViagensMes, anoMesFiltro, diasUteisMotorista);

    // Ajuste de texto visual 
    let textoMeta = "";
    if (window.motoristaSelecionado === "CLOVIS" || window.motoristaSelecionado === "RODRIGO") {
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
    const dataGlobalStr = elGlobal.value;
    if(!dataGlobalStr) return;
    const bancoDados = window.bancoDadosCloud;
    
    let totalDiaGlobal = 0;
    let caixasDia = 0;
    const dadosDoDia = bancoDados[dataGlobalStr] || {};
    for (const mot in dadosDoDia) { 
        totalDiaGlobal += dadosDoDia[mot].valor; 
        if(dadosDoDia[mot].tipoVeiculo !== 'cacamba') {
            caixasDia += dadosDoDia[mot].servicos;
        }
    }
    if(document.getElementById('totalDiaGlobal')) document.getElementById('totalDiaGlobal').innerText = `R$ ${totalDiaGlobal.toFixed(2).replace('.', ',')}`;
    if(document.getElementById('caixasDiaGlobal')) document.getElementById('caixasDiaGlobal').innerText = `${caixasDia} cx`;

    let totalSemanaGlobal = 0;
    let caixasSemana = 0;
    const dataObj = new Date(dataGlobalStr + 'T00:00:00');
    const diffParaSegunda = (dataObj.getDay() === 0) ? -6 : 1 - dataObj.getDay();
    const dataSegunda = new Date(dataObj);
    dataSegunda.setDate(dataObj.getDate() + diffParaSegunda);

    for (let i = 0; i < 7; i++) {
        const diaCheck = new Date(dataSegunda);
        diaCheck.setDate(dataSegunda.getDate() + i);
        const diaCheckStr = window.formatarDataParaBusca(diaCheck);
        const dadosDia = bancoDados[diaCheckStr] || {};
        for (const mot in dadosDia) { 
            totalSemanaGlobal += dadosDia[mot].valor; 
            if(dadosDia[mot].tipoVeiculo !== 'cacamba') {
                caixasSemana += dadosDia[mot].servicos;
            }
        }
    }
    if(document.getElementById('totalSemanaGlobal')) document.getElementById('totalSemanaGlobal').innerText = `R$ ${totalSemanaGlobal.toFixed(2).replace('.', ',')}`;
    if(document.getElementById('caixasSemanaGlobal')) document.getElementById('caixasSemanaGlobal').innerText = `${caixasSemana} cx`;
}

window.atualizarGraficoEvolucao = function() {
    if (!window.motoristaSelecionado) return;
    const bancoDados = window.bancoDadosCloud;
    let dadosEvolucao = [];

    for (const data in bancoDados) {
        if (bancoDados[data][window.motoristaSelecionado]) {
            let pts = bancoDados[data][window.motoristaSelecionado].tipoVeiculo === 'cacamba' ? 
                      bancoDados[data][window.motoristaSelecionado].servicos * 2 : 
                      bancoDados[data][window.motoristaSelecionado].servicos;
            dadosEvolucao.push({ dataStr: data, pontos: pts });
        }
    }
    dadosEvolucao.sort((a, b) => new Date(a.dataStr) - new Date(b.dataStr));

    const labels = dadosEvolucao.map(d => window.formatarDataParaExibicao(d.dataStr).substring(0, 5));
    const dataPoints = dadosEvolucao.map(d => d.pontos);

    if (window.chartInstanciaEvolucao) window.chartInstanciaEvolucao.destroy();
    const cvs = document.getElementById('chartEvolucao');
    if(!cvs) return;
    const ctx = cvs.getContext('2d');
    Chart.defaults.font.family = "'Inter', sans-serif";
    
    window.chartInstanciaEvolucao = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Volume (Pontos de Meta)',
                data: dataPoints,
                borderColor: '#0d6efd',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                borderWidth: 3,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#0d6efd',
                pointBorderWidth: 2,
                pointRadius: 4,
                fill: true,
                tension: 0.3 
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, border: { dash: [4, 4] }, grid: { color: '#e2e8f0' } } } }
    });
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
        divLista.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 40px; font-weight: 500;">Nenhum serviço normal no período. 😴</div>';
        return;
    }

    rankArray.forEach((mot, index) => {
        let porcentagemStr = mot.porcentagem.toFixed(2).replace('.', ',');

        let classeBarra = '';
        if(mot.porcentagem >= 100) classeBarra = 'meta-batida';
        else if (mot.porcentagem >= 80) classeBarra = 'meta-excedida'; 
        else classeBarra = 'meta-ruim'; 

        let larguraBarra = mot.porcentagem > 100 ? 100 : mot.porcentagem; 
        let extraBadge = mot.extra > 0 ? `<span style="font-size:10px; background:#f3e8ff; color:#7e22ce; padding:2px 6px; border-radius:4px; margin-left:8px;">+ Extra R$ ${mot.extra}</span>` : '';
        
        let textoQtd = "";
        if (mot.nome === "CLOVIS" || mot.nome === "RODRIGO") {
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
                <span class="diario-nome">#${index + 1} - ${mot.nome} (${textoQtd}) ${extraBadge}</span>
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

    motoristas.forEach(m => acumuladoMes[m] = { caixas: 0, viagens: 0, valor: 0 });

    for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
        if (dataStr.startsWith(mesFiltro)) {
            const isDomingo = new Date(dataStr + 'T00:00:00').getDay() === 0;
            for (const [mot, dados] of Object.entries(dadosDia)) {
                if (!isDomingo && !dados.isFeriado) {
                    if (acumuladoMes[mot]) {
                        if(dados.tipoVeiculo === 'cacamba') {
                            acumuladoMes[mot].viagens += dados.servicos;
                        } else {
                            acumuladoMes[mot].caixas += dados.servicos;
                            totalCaixasFrota += dados.servicos; 
                        }
                        acumuladoMes[mot].valor += dados.valor;
                    }
                }
            }
        }
    }

    if(document.getElementById('totalCaixasMesGlobal')) document.getElementById('totalCaixasMesGlobal').innerText = `${totalCaixasFrota} cx`;
    
    let prevCx = window.calcularPrevisao(totalCaixasFrota, mesFiltro);
    if(document.getElementById('previsaoMesGlobal')) document.getElementById('previsaoMesGlobal').innerText = `${prevCx} cx`;

    const motRayanna = ["MARIO", "JACKSON", "JONES", "MARCELO ANDRE", "RÉGIO", "JAMERSON", "MATHEUS", "LUIZ RODRIGUES", "JOAO VICTOR", "EMERSON", "MANSUETO", "ADRIELSON", "ROBERTO CARLOS", "JOELITON"];
    const motJulia = ["ELCIDES", "MARCONI", "MAYKEL", "LUIZ RODRIGO", "BRUNO", "PLATINIS"];

    let ptsRayanna = motRayanna.reduce((acc, curr) => acc + window.getMetaDiaria(curr), 0);
    let ptsJulia = motJulia.reduce((acc, curr) => acc + window.getMetaDiaria(curr), 0);

    if(document.getElementById('metaGeralGlobal')) document.getElementById('metaGeralGlobal').innerText = ((ptsRayanna + ptsJulia) * diasUteisGlobais) + ' cx';
    if(document.getElementById('metaRayannaGlobal')) document.getElementById('metaRayannaGlobal').innerText = (ptsRayanna * diasUteisGlobais) + ' cx';
    if(document.getElementById('metaJuliaGlobal')) document.getElementById('metaJuliaGlobal').innerText = (ptsJulia * diasUteisGlobais) + ' cx';

    let rankFinal = Object.keys(acumuladoMes)
        .map(mot => {
            let pts = acumuladoMes[mot].caixas + (acumuladoMes[mot].viagens * 2);
            let diasUteisMotorista = window.configSlaCloud?.[mesFiltro]?.[mot] || diasUteisGlobais;
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
        divLista.innerHTML = '<div style="text-align: center; padding: 40px; color: #94a3b8; font-weight: 500;">Sem registros válidos. O elo de todo mundo é Ferro! 🥶</div>';
        return;
    }

    rankFinal.forEach((mot, index) => {
        const eloInfo = window.obterRankElo(mot.percentual);
        let percentualStr = mot.percentual.toFixed(2).replace('.', ',');
        
        let corPercent, bgPercent, borderPercent;
        
        if (mot.percentual >= 100) {
            corPercent = '#10b981'; 
            bgPercent = '#d1fae5'; 
            borderPercent = '#a7f3d0';
        } else if (mot.percentual >= 80) {
            corPercent = '#d97706'; 
            bgPercent = '#fef3c7'; 
            borderPercent = '#fde68a';
        } else {
            corPercent = '#ef4444'; 
            bgPercent = '#fee2e2'; 
            borderPercent = '#fca5a5';
        }

        let textoQtd = "";
        if (mot.nome === "CLOVIS" || mot.nome === "RODRIGO") {
            if(mot.caixas > 0 && mot.viagens > 0) textoQtd = `${mot.caixas} cx | ${mot.viagens} vg`;
            else if (mot.caixas > 0) textoQtd = `${mot.caixas} cx | 0 vg`;
            else textoQtd = `0 cx | ${mot.viagens} vg`;
        } else {
            textoQtd = `${mot.caixas} cx`;
        }

        let htmlFaltam = "";
        if (mot.percentual < 80) {
            let metaMensalPontos = mot.diasBase * window.getMetaDiaria(mot.nome);
            let pontosPara80 = Math.ceil(metaMensalPontos * 0.8);
            let faltam = pontosPara80 - mot.pontos;
            if (faltam > 0) {
                let txtFaltam = "";
                if (mot.nome === "CLOVIS" || mot.nome === "RODRIGO") {
                    txtFaltam = `Faltam ${Math.ceil(faltam / 2)} vg`;
                } else {
                    txtFaltam = `Faltam ${faltam} cx`;
                }
                htmlFaltam = `<span style="font-size: 10px; color: #ef4444; margin-left: 8px; font-weight: 700; white-space: nowrap; background: #fee2e2; padding: 2px 6px; border-radius: 4px;">${txtFaltam}</span>`;
            }
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
            <div class="valor-destaque" style="color: #3b82f6; display:flex; align-items:center;">
                ${textoQtd}
                <span class="badge-percent" style="background:${bgPercent}; color:${corPercent}; border-color:${borderPercent};" title="Meta Atingida (Calculado sobre ${mot.diasBase} dias úteis)">${percentualStr}%</span>
                ${htmlFaltam}
            </div>
        `;
        divLista.appendChild(linha);
    });
}

window.gerarPainelFeriados = function() {
    const elIn = document.getElementById('dataDomInicio');
    const elFim = document.getElementById('dataDomFim');
    if(!elIn || !elFim) return;
    const inicio = elIn.value; 
    const fim = elFim.value; 
    if (!inicio || !fim) return;

    const bancoDados = window.bancoDadosCloud;
    let registrosDom = [];
    let registrosFer = [];
    let fatTotalGlobal = 0, cxTotalGlobal = 0;

    for (const [dataStr, dadosDia] of Object.entries(bancoDados)) {
        if (dataStr >= inicio && dataStr <= fim) {
            const isDomingo = new Date(dataStr + 'T00:00:00').getDay() === 0;
            for (const [mot, dados] of Object.entries(dadosDia)) {
                if (isDomingo || dados.isFeriado) {
                    let obj = {
                        dataStr: dataStr,
                        nome: mot,
                        caixas: dados.tipoVeiculo !== 'cacamba' ? dados.servicos : 0,
                        viagens: dados.tipoVeiculo === 'cacamba' ? dados.servicos : 0,
                        valor: dados.valor
                    };

                    if (dados.isFeriado) {
                        registrosFer.push(obj);
                    } else {
                        registrosDom.push(obj);
                    }

                    if (dados.tipoVeiculo !== 'cacamba') cxTotalGlobal += dados.servicos;
                    fatTotalGlobal += dados.valor;
                }
            }
        }
    }

    if(document.getElementById('totalFatDomGlobal')) document.getElementById('totalFatDomGlobal').innerText = `R$ ${fatTotalGlobal.toFixed(2).replace('.', ',')}`;
    if(document.getElementById('totalCxDomGlobal')) document.getElementById('totalCxDomGlobal').innerText = `${cxTotalGlobal} cx`;

    function renderizarLista(listaRegistros, idElemento, msgVazia) {
        listaRegistros.sort((a, b) => {
            if(a.dataStr !== b.dataStr) return new Date(b.dataStr) - new Date(a.dataStr);
            return b.valor - a.valor;
        });

        const divLista = document.getElementById(idElemento);
        if(!divLista) return;
        divLista.innerHTML = '';

        if(listaRegistros.length === 0) {
            divLista.innerHTML = `<div style="text-align: center; padding: 40px; color: #94a3b8; font-weight: 500;">${msgVazia}</div>`;
            return;
        }

        listaRegistros.forEach((mot) => {
            let textoQtd = "";
            if (mot.nome === "CLOVIS" || mot.nome === "RODRIGO") {
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
                        <span style="background:#e2e8f0; color:#475569; padding:2px 8px; border-radius:6px; font-size:12px; font-weight:800;">${dataFormatada}</span>
                        ${mot.nome} (${textoQtd})
                    </span>
                    <span class="diario-faturamento" style="color: #ef4444;">R$ ${mot.valor.toFixed(2).replace('.', ',')}</span>
                </div>
            `;
            divLista.appendChild(linha);
        });
    }

    renderizarLista(registrosDom, 'listaDomingos', 'Nenhum serviço em domingos no período selecionado. 😴');
    renderizarLista(registrosFer, 'listaFeriados', 'Nenhum serviço em feriados no período selecionado. 😴');
}
