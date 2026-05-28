# Ativar login com Supabase Auth

Este repo ja tem o arquivo `auth.js`. Para ativar a tela de login, faca estes passos.

## 1. Fazer backup antes

No sistema atual, clique em:

`Sistema / Backup` -> `Baixar Backup Seguro (.json)`

Guarde esse arquivo antes de mexer em permissoes.

## 2. Alterar o `index.html`

### 2.1. Cole a tela de login logo depois de `<body>`

```html
<div id="loginScreen" class="login-screen" style="display:none;">
    <div class="login-box">
        <div class="login-brand">
            <div class="logo-icon">
                <i data-lucide="waves" class="w-5 h-5 text-white"></i>
            </div>
            <div>
                <h1>SGC</h1>
                <p>Sao Gabriel Transportes</p>
            </div>
        </div>

        <div class="login-title">
            <h2>Acesso ao painel</h2>
            <p>Entre com seu e-mail e senha autorizados.</p>
        </div>

        <label class="login-label" for="loginEmail">E-mail</label>
        <input id="loginEmail" type="email" class="login-input" autocomplete="email" placeholder="voce@empresa.com">

        <label class="login-label" for="loginSenha">Senha</label>
        <input id="loginSenha" type="password" class="login-input" autocomplete="current-password" placeholder="Sua senha">

        <p id="loginMensagem" class="login-message"></p>

        <button id="btnLogin" type="button" class="login-primary" onclick="window.loginSupabase()">
            <i data-lucide="log-in"></i>
            Entrar
        </button>

        <button id="btnCriarAcesso" type="button" class="login-secondary" onclick="window.criarAcessoSupabase()">
            Criar primeiro acesso
        </button>
    </div>
</div>
```

### 2.2. Esconda o app ate o login carregar

Troque:

```html
<aside id="sidebar">
```

por:

```html
<aside id="sidebar" style="display:none;">
```

Troque:

```html
<main>
```

por:

```html
<main style="display:none;">
```

### 2.3. Adicione usuario e sair no header

Dentro de:

```html
<div class="header-actions">
```

cole antes do botao `Sistema / Backup`:

```html
<span id="usuarioLogadoEmail" class="user-email"></span>
<button type="button" onclick="window.logoutSupabase()" class="btn-sistema">
    <i data-lucide="log-out"></i>
    Sair
</button>
```

### 2.4. Troque o script principal

Troque:

```html
<script type="module" src="app.js"></script>
```

por:

```html
<script type="module" src="auth.js"></script>
```

## 3. Adicionar CSS no final do `style.css`

```css
.login-screen {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--surface-page);
}

.login-box {
  width: 100%;
  max-width: 380px;
  background: white;
  border: var(--border);
  border-radius: var(--r-xl);
  box-shadow: var(--shadow-lg);
  padding: 28px;
}

.login-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.login-brand h1 {
  font-size: 18px;
  font-weight: 700;
  color: var(--gray-900);
  line-height: 1;
}

.login-brand p {
  margin-top: 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--gray-400);
}

.login-title h2 {
  font-size: 22px;
  font-weight: 700;
  color: var(--gray-900);
}

.login-title p {
  margin-top: 4px;
  margin-bottom: 20px;
  color: var(--gray-500);
  font-size: 13px;
}

.login-label {
  display: block;
  margin: 14px 0 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--gray-500);
}

.login-input {
  width: 100%;
  height: 42px;
  border: var(--border);
  border-radius: var(--r-md);
  padding: 0 12px;
  font: inherit;
  color: var(--gray-900);
  outline: none;
}

.login-input:focus {
  border-color: var(--brand-500);
  box-shadow: 0 0 0 3px var(--brand-100);
}

.login-message {
  min-height: 18px;
  margin: 12px 0;
  font-size: 12px;
  color: var(--gray-500);
}

.login-error {
  color: var(--danger-600);
}

.login-primary,
.login-secondary {
  width: 100%;
  height: 42px;
  border-radius: var(--r-md);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: opacity var(--t-fast) var(--ease-out);
}

.login-primary {
  color: white;
  background: var(--brand-600);
  border: 1px solid var(--brand-600);
}

.login-secondary {
  margin-top: 10px;
  color: var(--gray-700);
  background: white;
  border: var(--border);
}

.login-primary:disabled,
.login-secondary:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.user-email {
  font-size: 12px;
  font-weight: 700;
  color: var(--gray-500);
}
```

## 4. Configurar no Supabase

No Supabase:

1. Abra o projeto.
2. Va em `Authentication` -> `Providers`.
3. Ative `Email`.
4. Para facilitar no comeco, voce pode desativar confirmacao por e-mail. Depois, se quiser mais seguranca, ative confirmacao.
5. Va em `Authentication` -> `Users` e crie os usuarios autorizados, ou use o botao `Criar primeiro acesso` na tela.

## 5. Proteger as tabelas com RLS

Depois que o login estiver funcionando, ative RLS nas tabelas principais e crie policies para usuario autenticado.

Exemplo basico para cada tabela:

```sql
alter table public.lancamentos enable row level security;

create policy "usuarios logados podem ler lancamentos"
on public.lancamentos
for select
to authenticated
using (true);

create policy "usuarios logados podem inserir lancamentos"
on public.lancamentos
for insert
to authenticated
with check (true);

create policy "usuarios logados podem atualizar lancamentos"
on public.lancamentos
for update
to authenticated
using (true)
with check (true);
```

Evite criar policy de `delete` geral no comeco. Isso reduz risco de apagar tudo por engano.

Repita a ideia para:

- `motoristas`
- `config_meses`
- `config_slas`
- `visibilidade_mes`

## 6. Teste seguro

1. Abra o site em janela anonima.
2. Confirme que aparece a tela de login.
3. Entre com um usuario criado.
4. Confira se os dados aparecem.
5. So depois ative policies mais restritas.
