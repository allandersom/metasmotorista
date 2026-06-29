import './audit-lancamentos.js';
const supabaseClient = window.supabaseClient;
let appImportado = false;

function el(id) {
    return document.getElementById(id);
}

function setMensagemLogin(texto, tipo = 'info') {
    const msg = el('loginMensagem');
    if (!msg) return;
    msg.textContent = texto || '';
    msg.className = tipo === 'erro' ? 'login-message login-error' : 'login-message';
}

function setLoginLoading(carregando) {
    ['btnLogin', 'btnCriarAcesso'].forEach(id => {
        const btn = el(id);
        if (btn) btn.disabled = carregando;
    });
}

function mostrarLogin() {
    const login = el('loginScreen');
    const sidebar = el('sidebar');
    const main = document.querySelector('main');
    const loader = el('loader');

    if (loader) loader.style.display = 'none';
    if (login) login.style.display = 'flex';
    if (sidebar) sidebar.style.display = 'none';
    if (main) main.style.display = 'none';

    lucide?.createIcons?.();
}

function mostrarApp() {
    const login = el('loginScreen');
    const sidebar = el('sidebar');
    const main = document.querySelector('main');
    const loader = el('loader');

    if (login) login.style.display = 'none';
    if (sidebar) sidebar.style.display = '';
    if (main) main.style.display = '';
    if (loader) {
        loader.style.display = 'flex';
        loader.style.opacity = '1';
    }
}

async function iniciarApp() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        mostrarLogin();
        return;
    }

    mostrarApp();

    const userEmail = el('usuarioLogadoEmail');
    if (userEmail) userEmail.textContent = session.user.email || 'Usuário logado';

    if (!appImportado) {
        appImportado = true;
        await import('./app.js');
    } else if (window.carregarDadosDoSupabase) {
        await window.carregarDadosDoSupabase();
    }
}

window.loginSupabase = async function() {
    const email = el('loginEmail')?.value.trim();
    const password = el('loginSenha')?.value;

    if (!email || !password) {
        setMensagemLogin('Informe e-mail e senha.', 'erro');
        return;
    }

    setLoginLoading(true);
    setMensagemLogin('Entrando...');

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    setLoginLoading(false);

    if (error) {
        setMensagemLogin(error.message, 'erro');
        return;
    }

    setMensagemLogin('Login confirmado. Carregando painel...');
    await iniciarApp();
};

window.criarAcessoSupabase = async function() {
    const email = el('loginEmail')?.value.trim();
    const password = el('loginSenha')?.value;

    if (!email || !password) {
        setMensagemLogin('Informe e-mail e senha para criar o acesso.', 'erro');
        return;
    }

    if (password.length < 6) {
        setMensagemLogin('A senha precisa ter pelo menos 6 caracteres.', 'erro');
        return;
    }

    setLoginLoading(true);
    setMensagemLogin('Criando acesso...');

    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    setLoginLoading(false);

    if (error) {
        setMensagemLogin(error.message, 'erro');
        return;
    }

    if (data.session) {
        setMensagemLogin('Acesso criado. Carregando painel...');
        await iniciarApp();
        return;
    }

    setMensagemLogin('Acesso criado. Verifique o e-mail para confirmar antes de entrar.');
};

window.recuperarSenhaSupabase = async function() {
    const email = el('loginEmail')?.value.trim();

    if (!email) {
        setMensagemLogin('Digite seu e-mail no campo acima para recuperar a senha.', 'erro');
        return;
    }

    setLoginLoading(true);
    setMensagemLogin('Enviando link de recuperação...');

    // O Supabase vai enviar um e-mail com um link seguro.
    // O redirectTo garante que, ao clicar no link, ele volte para o seu painel.
    const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
    });

    setLoginLoading(false);

    if (error) {
        setMensagemLogin('Erro ao enviar e-mail: ' + error.message, 'erro');
        return;
    }

    setMensagemLogin('E-mail enviado! Verifique sua caixa de entrada (e spam).');
};

window.logoutSupabase = async function() {
    await supabaseClient.auth.signOut();
    window.location.reload();
};

supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (!session) mostrarLogin();
});

iniciarApp();
