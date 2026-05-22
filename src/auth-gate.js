import './audit-lancamentos.js';

const supabaseClient = window.supabaseClient;

function byId(id) {
    return document.getElementById(id);
}

function injectAuthStyles() {
    if (byId('authGateStyles')) return;

    const style = document.createElement('style');
    style.id = 'authGateStyles';
    style.textContent = `
        .auth-login-screen {
            position: fixed;
            inset: 0;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: var(--surface-page, #f3f4f8);
        }

        .auth-login-box {
            width: 100%;
            max-width: 380px;
            background: #ffffff;
            border: 1px solid #e1e1e5;
            border-radius: 18px;
            box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08), 0 4px 8px rgba(0, 0, 0, 0.04);
            padding: 28px;
            font-family: var(--font-ui, sans-serif);
        }

        .auth-login-brand {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 24px;
        }

        .auth-login-brand h1 {
            margin: 0;
            color: #141422;
            font-size: 18px;
            font-weight: 700;
            line-height: 1;
        }

        .auth-login-brand p {
            margin: 4px 0 0;
            color: #8f8f9d;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
        }

        .auth-login-title h2 {
            margin: 0;
            color: #141422;
            font-size: 22px;
            font-weight: 700;
        }

        .auth-login-title p {
            margin: 4px 0 20px;
            color: #6b6b7b;
            font-size: 13px;
        }

        .auth-login-label {
            display: block;
            margin: 14px 0 6px;
            color: #6b6b7b;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
        }

        .auth-login-input {
            width: 100%;
            height: 42px;
            border: 1px solid #e1e1e5;
            border-radius: 10px;
            padding: 0 12px;
            color: #141422;
            font: inherit;
            outline: none;
        }

        .auth-login-input:focus {
            border-color: #6366f1;
            box-shadow: 0 0 0 3px #e0e7ff;
        }

        .auth-login-message {
            min-height: 18px;
            margin: 12px 0;
            color: #6b6b7b;
            font-size: 12px;
        }

        .auth-login-error {
            color: #dc2626;
        }

        .auth-login-primary,
        .auth-login-secondary {
            width: 100%;
            height: 42px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-weight: 700;
            cursor: pointer;
        }

        .auth-login-primary {
            border: 1px solid #4f46e5;
            background: #4f46e5;
            color: #ffffff;
        }

        .auth-login-secondary {
            margin-top: 10px;
            border: 1px solid #e1e1e5;
            background: #ffffff;
            color: #38384a;
        }

        .auth-login-primary:disabled,
        .auth-login-secondary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .auth-user-email {
            color: #6b6b7b;
            font-size: 12px;
            font-weight: 700;
        }
    `;
    document.head.appendChild(style);
}

function ensureLoginScreen() {
    const existingScreen = byId('authLoginScreen');
    if (existingScreen) return existingScreen;

    const screen = document.createElement('div');
    screen.id = 'authLoginScreen';
    screen.className = 'auth-login-screen';
    screen.innerHTML = `
        <div class="auth-login-box">
            <div class="auth-login-brand">
                <div class="logo-icon"><i data-lucide="waves" class="w-5 h-5 text-white"></i></div>
                <div>
                    <h1>SGC</h1>
                    <p>Sao Gabriel Transportes</p>
                </div>
            </div>
            <div class="auth-login-title">
                <h2>Acesso ao painel</h2>
                <p>Entre com seu e-mail e senha autorizados.</p>
            </div>
            <label class="auth-login-label" for="authLoginEmail">E-mail</label>
            <input id="authLoginEmail" type="email" class="auth-login-input" autocomplete="email" placeholder="voce@empresa.com">
            <label class="auth-login-label" for="authLoginSenha">Senha</label>
            <input id="authLoginSenha" type="password" class="auth-login-input" autocomplete="current-password" placeholder="Sua senha">
            <p id="authLoginMensagem" class="auth-login-message"></p>
            <button id="authBtnLogin" type="button" class="auth-login-primary"><i data-lucide="log-in"></i>Entrar</button>
            <button id="authBtnCriarAcesso" type="button" class="auth-login-secondary">Criar primeiro acesso</button>
        </div>
    `;

    document.body.appendChild(screen);
    window.lucide?.createIcons?.();
    return screen;
}

function setAppVisible(visible) {
    const sidebar = byId('sidebar');
    const main = document.querySelector('main');
    const loader = byId('loader');

    if (sidebar) sidebar.style.display = visible ? '' : 'none';
    if (main) main.style.display = visible ? '' : 'none';
    if (loader && !visible) loader.style.display = 'none';
    if (loader && visible) {
        loader.style.display = 'flex';
        loader.style.opacity = '1';
    }
}

function setMessage(text, isError = false) {
    const message = byId('authLoginMensagem');
    if (!message) return;

    message.textContent = text || '';
    message.className = isError ? 'auth-login-message auth-login-error' : 'auth-login-message';
}

function setLoading(loading) {
    ['authBtnLogin', 'authBtnCriarAcesso'].forEach((id) => {
        const button = byId(id);
        if (button) button.disabled = loading;
    });
}

function ensureLogout(session) {
    const actions = document.querySelector('.header-actions');
    if (!actions || byId('authLogoutButton')) return;

    const email = document.createElement('span');
    email.id = 'authUserEmail';
    email.className = 'auth-user-email';
    email.textContent = session.user.email || 'Usuario logado';

    const button = document.createElement('button');
    button.id = 'authLogoutButton';
    button.type = 'button';
    button.className = 'btn-sistema';
    button.innerHTML = '<i data-lucide="log-out"></i>Sair';
    button.onclick = async () => {
        await supabaseClient.auth.signOut();
        window.location.reload();
    };

    actions.prepend(button);
    actions.prepend(email);
    window.lucide?.createIcons?.();
}

async function requireLogin() {
    if (!supabaseClient?.auth) return;

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        setAppVisible(true);
        ensureLogout(session);
        return;
    }

    injectAuthStyles();
    const screen = ensureLoginScreen();
    setAppVisible(false);

    await new Promise((resolve) => {
        const login = async () => {
            const email = byId('authLoginEmail')?.value.trim();
            const password = byId('authLoginSenha')?.value;

            if (!email || !password) {
                setMessage('Informe e-mail e senha.', true);
                return;
            }

            setLoading(true);
            setMessage('Entrando...');
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            setLoading(false);

            if (error) {
                setMessage(error.message, true);
                return;
            }

            screen.remove();
            setAppVisible(true);
            ensureLogout(data.session);
            resolve();
        };

        const signup = async () => {
            const email = byId('authLoginEmail')?.value.trim();
            const password = byId('authLoginSenha')?.value;

            if (!email || !password) {
                setMessage('Informe e-mail e senha para criar o acesso.', true);
                return;
            }

            if (password.length < 6) {
                setMessage('A senha precisa ter pelo menos 6 caracteres.', true);
                return;
            }

            setLoading(true);
            setMessage('Criando acesso...');
            const { data, error } = await supabaseClient.auth.signUp({ email, password });
            setLoading(false);

            if (error) {
                setMessage(error.message, true);
                return;
            }

            if (data.session) {
                screen.remove();
                setAppVisible(true);
                ensureLogout(data.session);
                resolve();
                return;
            }

            setMessage('Acesso criado. Verifique o e-mail para confirmar antes de entrar.');
        };

        byId('authBtnLogin')?.addEventListener('click', login);
        byId('authBtnCriarAcesso')?.addEventListener('click', signup);
        byId('authLoginSenha')?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') login();
        });
    });
}

await requireLogin();
