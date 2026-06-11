// =====================================================
// MÓDULO: Programação de Serviços (Rota do Dia)
// Arquivo separado para manter o app.js mais limpo.
// =====================================================

// ---- Estado do módulo ----
window.rotaEstado = {
    turnoAtivo: 'dia', // 'dia' | 'noite' | 'especial'
    salvoPendente: false,
};

// ---- Inicialização ----
document.addEventListener('DOMContentLoaded', () => {
    const elData = document.getElementById('dataPlanilhaRota');
    if (elData) {
        const hoje = new Date();
        const offset = hoje.getTimezoneOffset() * 60000;
        elData.value = new Date(hoje.getTime() - offset).toISOString().split('T')[0];
    }
    window._rotaInicializado = true;
});

// ---- Troca de turno (aba) ----
window.mudarTurnoPlanilha = function (turno, btnEl) {
    document.querySelectorAll('.tab-turno').forEach(b => {
        b.classList.remove('bg-indigo-50', 'text-indigo-700', 'border-indigo-200', 'border');
        b.classList.add('bg-white', 'text-slate-500', 'border-transparent');
    });
    btnEl.classList.remove('bg-white', 'text-slate-500', 'border-transparent');
    btnEl.classList.add('bg-indigo-50', 'text-indigo-700', 'border-indigo-200', 'border');

    window.rotaEstado.turnoAtivo = turno;
    window.carregarPlanilhaRota();
};

// ---- Alerta de não-salvo ----
window.marcarPlanilhaNaoSalva = function () {
    const btn = document.getElementById('btnSalvarPlanilha');
    if (!btn || btn.innerText.includes('não salvas')) return;
    btn.innerHTML = '<i data-lucide="alert-circle" class="w-4 h-4 mr-2"></i> Alterações não salvas *';
    btn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
    btn.classList.add('bg-amber-500', 'hover:bg-amber-600');
    if (window.lucide) lucide.createIcons();
    window.rotaEstado.salvoPendente = true;
};

// ---- Motoristas disponíveis por turno ----
window._motoristasTurno = function (turno) {
    // 1. Tenta pegar a lista global primeiro (que já carrega no início do app)
    // 2. Se falhar, tenta o cache do cadastro.
    const cache = window.todosMotoristasCloud || window.motoristasCache || [];
    
    return cache
        .filter(m => m.turno === turno && m.status !== 'inativo')
        .map(m => ({ id: m.id, nome: m.nome }));
};
// ---- Paleta de status (Padrão Excel do Print) ----
const STATUS_CORES = {
    branco:     { bg: '#FFFFFF', border: '#000000', texto: 'Branco', corTexto: '#EF4444' }, // Texto vermelho
    verde:      { bg: '#00FF00', border: '#000000', texto: 'Verde (Serviço)', corTexto: '#EF4444' }, 
    ciano:      { bg: '#00FFFF', border: '#000000', texto: 'Ciano (Caixas)', corTexto: '#000000' }, // Preto
    manutencao: { bg: '#FF0000', border: '#000000', texto: 'Manutenção', corTexto: '#FFFFFF' },
    laranja:    { bg: '#F59E0B', border: '#000000', texto: 'Laranja', corTexto: '#000000' },
    roxo:       { bg: '#D946EF', border: '#000000', texto: 'Roxo', corTexto: '#FFFFFF' },
    amarelo:    { bg: '#FDE047', border: '#000000', texto: 'Amarelo', corTexto: '#000000' },
};

// ---- Aplicar cor de fundo e texto na célula ----
window._aplicarCorCelula = function (selectEl) {
    const td = selectEl.closest('td');
    if (!td) return;
    const divTexto = td.querySelector('.celula-servico');
    const cor = STATUS_CORES[selectEl.value];
    
    if (cor) {
        td.style.background = cor.bg;
        td.style.borderColor = cor.border;
        if(divTexto) {
            divTexto.style.color = cor.corTexto || '#000000';
        }
    }
};

// ---- Carregar / montar planilha ----
window.carregarPlanilhaRota = async function () {
    const dataStr = document.getElementById('dataPlanilhaRota')?.value;
    if (!dataStr) return;

    const turno = window.rotaEstado.turnoAtivo;
    const motoristas = window._motoristasTurno(turno);

    const head = document.getElementById('planilhaHead');
    const body = document.getElementById('planilhaBody');
    if (!head || !body) return;

    // Cabeçalho apenas para definir o tamanho fixo das colunas
    if (!motoristas.length) {
        head.innerHTML = '<tr><th style="padding:16px;">Sem motoristas cadastrados</th></tr>';
    } else {
        let headHtml = '<tr>';
        motoristas.forEach((mot, idx) => {
            headHtml += `<th style="min-width:200px; text-align:center; padding:6px; border: 1px solid #cbd5e1; background:#f1f5f9; font-size:11px; color:#64748b;">COLUNA ${idx + 1}</th>`;
        });
        headHtml += '</tr>';
        head.innerHTML = headHtml;
    }

    try {
        const { data, error } = await window.supabaseClient
            .from('rotas_planilha')
            .select('conteudo_html')
            .eq('data', dataStr)
            .eq('turno', turno)
            .maybeSingle();

        if (error) throw error;

        if (data?.conteudo_html) {
            body.innerHTML = data.conteudo_html;
            // Reconecta os selects de status das células de serviço
            _reativarSelectsStatus();
        } else {
            _montarLinhasVazias(motoristas, body);
        }

        _resetarBotaoSalvar();
        if (window.lucide) lucide.createIcons();

    } catch (err) {
        console.error('Erro ao carregar planilha:', err);
        body.innerHTML = `<tr><td colspan="${motoristas.length || 1}" style="color:#ef4444;padding:16px;">Erro: ${err.message}</td></tr>`;
    }
};

// ---- Monta linhas novas com as Placas e Motoristas editáveis ----
function _montarLinhasVazias(motoristas, body) {
    if (!motoristas.length) {
        body.innerHTML = `<tr><td style="color:#94a3b8;padding:24px;text-align:center;">Nenhum motorista disponível.</td></tr>`;
        return;
    }

    let html = '';

    // 1. LINHA DAS PLACAS (Amarela igual ao seu Excel da direita)
    html += `<tr style="background: #fef08a; font-family: monospace; font-weight: 800; text-align: center; font-size: 13px; color: #a16207;">`;
    motoristas.forEach(() => {
        html += `<td style="border: 1px solid #cbd5e1; padding: 10px; text-transform: uppercase;">SEM PLACA</td>`;
    });
    html += `</tr>`;

    // 2. LINHA DOS MOTORISTAS (Azul/Cian igual ao seu Excel da direita)
    html += `<tr style="background: #e0f2fe; font-weight: 900; text-align: center; font-size: 13px; color: #0369a1;">`;
    motoristas.forEach(mot => {
        let primeiroNome = mot.nome.split(' ')[0];
        html += `<td style="border: 1px solid #cbd5e1; padding: 10px; text-transform: uppercase;">${primeiroNome}</td>`;
    });
    html += `</tr>`;

    // 3. LINHAS DE SERVIÇO EM BRANCO (12 slots para baixo)
    const qtdLinhasDeServico = 12;
    for (let i = 0; i < qtdLinhasDeServico; i++) {
        html += `<tr>`;
        motoristas.forEach(mot => {
            html += _celulaServico('');
        });
        html += `</tr>`;
    }

    body.innerHTML = html;
    _reativarSelectsStatus();
}

// ---- Célula de serviço editável com select de status ----
// ---- Célula de serviço editável com select de status ----
function _celulaServico(conteudo = '') {
    const statusOpts = Object.entries(STATUS_CORES)
        .map(([k, v]) => `<option value="${k}">${v.texto}</option>`).join('');

    return `<td style="padding:0; vertical-align:middle; border:1px solid #000000; position:relative; min-width: 160px; background: inherit;">
        <div style="display:flex; flex-direction:column; height:100%; min-height:50px; justify-content:center;">
            <div
                class="celula-servico"
                contenteditable="true"
                oninput="window.marcarPlanilhaNaoSalva()"
                style="outline:none; padding:8px 4px; font-size:12px; font-weight:900; font-style:italic; text-align:center; font-family: Arial, sans-serif; text-transform:uppercase; word-wrap: break-word;"
            >${conteudo}</div>
            
            <select class="celula-status" onchange="window._aplicarCorCelula(this); window.marcarPlanilhaNaoSalva();"
                style="border:none; border-top:1px solid #000; font-size:9px; font-weight:bold; padding:0; cursor:pointer; background:rgba(255,255,255,0.5); outline:none; text-align:center; height:16px;">
                ${statusOpts}
            </select>
        </div>
    </td>`;
}

// ---- Aplicar cor de fundo na célula conforme status ----
window._aplicarCorCelula = function (selectEl) {
    const td = selectEl.closest('td');
    if (!td) return;
    const cor = STATUS_CORES[selectEl.value];
    if (cor) {
        td.style.background = cor.bg;
        td.style.borderColor = cor.border;
    }
};

// ---- Reconectar selects após carregar HTML salvo ----
function _reativarSelectsStatus() {
    document.querySelectorAll('#planilhaBody .celula-status').forEach(sel => {
        window._aplicarCorCelula(sel);
        sel.addEventListener('change', () => {
            window._aplicarCorCelula(sel);
            window.marcarPlanilhaNaoSalva();
        });
    });
}

// ---- Salvar ----
window.salvarPlanilhaRota = async function () {
    const dataStr = document.getElementById('dataPlanilhaRota')?.value;
    if (!dataStr) return;

    const turno = window.rotaEstado.turnoAtivo;
    const bodyHtml = document.getElementById('planilhaBody')?.innerHTML;

    const btn = document.getElementById('btnSalvarPlanilha');
    btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 mr-2 animate-spin"></i> Salvando...';
    if (window.lucide) lucide.createIcons();

    try {
        const { error } = await window.supabaseClient
            .from('rotas_planilha')
            .upsert({ data: dataStr, turno, conteudo_html: bodyHtml }, { onConflict: 'data,turno' });

        if (error) throw error;

        btn.innerHTML = '<i data-lucide="check" class="w-4 h-4 mr-2"></i> Salvo!';
        btn.className = btn.className
            .replace(/bg-\w+-\d+/g, '').replace(/hover:bg-\w+-\d+/g, '')
            .trim() + ' bg-emerald-500 hover:bg-emerald-600';
        if (window.lucide) lucide.createIcons();
        window.rotaEstado.salvoPendente = false;

        setTimeout(_resetarBotaoSalvar, 2500);
    } catch (err) {
        alert('Erro ao salvar: ' + err.message);
        btn.innerHTML = '<i data-lucide="save" class="w-4 h-4 mr-2"></i> Tentar Novamente';
        if (window.lucide) lucide.createIcons();
    }
};

function _resetarBotaoSalvar() {
    const btn = document.getElementById('btnSalvarPlanilha');
    if (!btn) return;
    btn.innerHTML = '<i data-lucide="save" class="w-4 h-4 mr-2"></i> Salvar Planilha';
    btn.classList.remove('bg-amber-500', 'hover:bg-amber-600', 'bg-emerald-500', 'hover:bg-emerald-600');
    btn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
    if (window.lucide) lucide.createIcons();
    window.rotaEstado.salvoPendente = false;
}

// ---- Motoristas disponíveis por turno (Blindado) ----
window._motoristasTurno = function (turno) {
    const cache = window.todosMotoristasCloud || window.motoristasCache || [];
    
    return cache
        .filter(m => (m.turno || '').toLowerCase() === (turno || '').toLowerCase() && m.status !== 'inativo')
        .map(m => ({ id: m.id, nome: m.nome }));
};

// ---- Botão de emergência para limpar o HTML Fantasma ----
window.resetarPlanilhaRota = function() {
    if(!confirm('Isso vai recarregar os motoristas do turno limpos na tela. Confirmar?')) return;
    
    const turno = window.rotaEstado.turnoAtivo;
    const motoristas = window._motoristasTurno(turno);
    const body = document.getElementById('planilhaBody');
    
    if (body) {
        _montarLinhasVazias(motoristas, body);
        window.marcarPlanilhaNaoSalva();
        if (window.lucide) window.lucide.createIcons();
    }
};