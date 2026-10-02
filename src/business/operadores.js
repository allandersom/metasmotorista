const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function responsavelTurno(operadores, turno) {
    return operadores.find(o => o.ativo && o.turno === turno) || null;
}
let operadores = [], disponivel = false;
function atualizarRotulos() {
    for (const turno of ['dia','noite']) {
        const op = responsavelTurno(operadores,turno);
        const titulo = `Meta ${turno === 'dia' ? 'Dia' : 'Noite'}${op ? ' · ' + op.nome : ''} (Mês)`;
        document.querySelectorAll(`[data-meta-operador="${turno}"]`).forEach(el => { el.textContent = titulo; });
        const el = document.getElementById(`opResponsavel-${turno}`);
        if (el) el.textContent = op?.nome || 'Sem responsável cadastrado';
    }
}
window.atualizarMetasCadastroOperadores = function () {
    for (const [turno,sufixo] of [['dia','Rayanna'],['noite','Julia']]) {
        const el = document.getElementById('opMeta-' + turno);
        if (el) el.textContent = document.getElementById('meta' + sufixo + 'Global')?.textContent || '—';
        const detalhe = document.getElementById('opMetaDetalhe-' + turno);
        if (detalhe) detalhe.textContent = document.getElementById('falta' + sufixo + 'Global')?.textContent || '';
    }
    const mes = document.getElementById('opMesMeta');
    if (mes) mes.textContent = (document.getElementById('mesFiltro')?.value || '').split('-').reverse().join('/');
};
function renderizar() {
    window.atualizarMetasCadastroOperadores();
    atualizarRotulos();
    const lista = document.getElementById('listaCadastroOperadores');
    if (!lista) return;
    const admin = window.usuarioAtualFuncao === 'admin';
    document.getElementById('formCadastroOperador').hidden = !admin || !disponivel;
    lista.innerHTML = operadores.length ? operadores.map(o => `<tr><td><strong>${esc(o.nome)}</strong></td><td>${o.turno === 'dia' ? 'Dia' : 'Noite'}</td><td>${o.ativo ? 'Ativo' : 'Inativo'}</td><td>${admin ? `<button class="btn-sistema" data-editar-operador="${esc(o.id)}">Editar</button>` : '—'}</td></tr>`).join('') : '<tr><td colspan="4">Nenhum operador cadastrado.</td></tr>';
    lista.querySelectorAll('[data-editar-operador]').forEach(btn => btn.addEventListener('click', () => {
        const o = operadores.find(o => o.id === btn.dataset.editarOperador);
        document.getElementById('cadOperadorId').value = o.id;
        document.getElementById('cadOperadorNome').value = o.nome;
        document.getElementById('cadOperadorTurno').value = o.turno;
        document.getElementById('cadOperadorAtivo').checked = o.ativo;
        document.getElementById('cadOperadorNome').focus();
    }));
}
window.limparCadastroOperador = function () {
    document.getElementById('formCadastroOperador').reset();
    document.getElementById('cadOperadorId').value = '';
};
window.carregarCadastroOperadores = async function () {
    const msg = document.getElementById('cadOperadorMensagem');
    try {
        const {data,error} = await window.supabaseClient.from('operadores').select('id,nome,turno,ativo').order('nome');
        if (error) throw error;
        operadores = data || []; disponivel = true;
        if (msg) msg.textContent = '';
    } catch (erro) {
        disponivel = false;
        if (msg) msg.textContent = ['42P01','PGRST205'].includes(erro.code)
            ? 'Cadastro ainda não configurado. Execute o SQL 07 no Supabase. As metas e os lançamentos atuais continuam funcionando.'
            : 'Não foi possível carregar o cadastro de operadores. Tente atualizar.';
    }
    renderizar();
};
window.salvarCadastroOperador = async function (event) {
    event.preventDefault();
    if (window.usuarioAtualFuncao !== 'admin' || !disponivel) return;
    const id = document.getElementById('cadOperadorId').value;
    const nome = document.getElementById('cadOperadorNome').value.trim();
    const turno = document.getElementById('cadOperadorTurno').value;
    const ativo = document.getElementById('cadOperadorAtivo').checked;
    const msg = document.getElementById('cadOperadorMensagem');
    if (!nome || !['dia','noite'].includes(turno)) return;
    if (ativo && operadores.some(o => o.id !== id && o.ativo && o.turno === turno)) {
        msg.textContent = 'Este turno já tem um responsável ativo. Desative o anterior antes de cadastrar outro.'; return;
    }
    const btn = document.getElementById('salvarCadastroOperador'); btn.disabled = true;
    try {
        const query = window.supabaseClient.from('operadores');
        const {data,error} = await (id ? query.update({nome,turno,ativo}).eq('id',id) : query.insert({nome,turno,ativo})).select('id').single();
        if (error) throw error;
        if (!data) throw new Error('Registro não salvo');
        window.limparCadastroOperador();
        await window.carregarCadastroOperadores();
        if (disponivel) msg.textContent = 'Operador salvo. Vínculo com a meta do turno atualizado.';
    } catch (erro) {
        msg.textContent = erro.code === '23505' ? 'Este turno já possui um responsável ativo. Atualize o cadastro.' : 'Não foi possível salvar o operador. Confira sua permissão e tente novamente.';
    } finally { btn.disabled = false; }
};
