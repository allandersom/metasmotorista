-- 02_historico_lancamentos.sql
-- Objetivo: criar trilha de auditoria para lancamentos.
-- Rode depois do login e do RLS basico estarem funcionando.

begin;

create table if not exists public.lancamentos_historico (
    id uuid primary key default gen_random_uuid(),
    criado_em timestamptz not null default now(),
    acao text not null check (acao in ('criar', 'editar', 'excluir', 'excluir_mes_motorista', 'excluir_tudo', 'importar_ia')),
    data_servico date,
    motorista_nome text,
    usuario_id uuid references auth.users(id) on delete set null,
    usuario_email text,
    origem text not null default 'app_web',
    observacao text,
    dados_antes jsonb,
    dados_depois jsonb
);

create index if not exists idx_lancamentos_historico_criado_em
on public.lancamentos_historico (criado_em desc);

create index if not exists idx_lancamentos_historico_motorista_data
on public.lancamentos_historico (motorista_nome, data_servico);

create index if not exists idx_lancamentos_historico_usuario
on public.lancamentos_historico (usuario_email, criado_em desc);

alter table public.lancamentos_historico enable row level security;

drop policy if exists "sgc_auth_select_lancamentos_historico" on public.lancamentos_historico;
create policy "sgc_auth_select_lancamentos_historico"
on public.lancamentos_historico
for select
to authenticated
using (true);

drop policy if exists "sgc_auth_insert_lancamentos_historico" on public.lancamentos_historico;
create policy "sgc_auth_insert_lancamentos_historico"
on public.lancamentos_historico
for insert
to authenticated
with check (auth.uid() = usuario_id or usuario_id is null);

-- Historico nao deve ser editado nem apagado pelo app.
-- Se precisar corrigir algo, faca manualmente pelo painel do Supabase com cuidado.

commit;

-- Consulta util para conferir os ultimos eventos:
-- select criado_em, acao, data_servico, motorista_nome, usuario_email, observacao
-- from public.lancamentos_historico
-- order by criado_em desc
-- limit 50;
