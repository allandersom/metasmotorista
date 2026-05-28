-- 01_rls_basico_empresa.sql
-- Objetivo: bloquear acesso anonimo direto ao banco e liberar acesso apenas para usuarios logados.
-- Rode este script no Supabase SQL Editor depois de confirmar que o login do app esta funcionando.

begin;

-- =============================================================
-- LANCAMENTOS
-- =============================================================
alter table public.lancamentos enable row level security;

drop policy if exists "sgc_auth_all_lancamentos" on public.lancamentos;
create policy "sgc_auth_all_lancamentos"
on public.lancamentos
for all
to authenticated
using (true)
with check (true);

-- =============================================================
-- MOTORISTAS
-- =============================================================
alter table public.motoristas enable row level security;

drop policy if exists "sgc_auth_all_motoristas" on public.motoristas;
create policy "sgc_auth_all_motoristas"
on public.motoristas
for all
to authenticated
using (true)
with check (true);

-- =============================================================
-- CONFIGURACAO DE MESES
-- =============================================================
alter table public.config_meses enable row level security;

drop policy if exists "sgc_auth_all_config_meses" on public.config_meses;
create policy "sgc_auth_all_config_meses"
on public.config_meses
for all
to authenticated
using (true)
with check (true);

-- =============================================================
-- CONFIGURACAO DE SLAS
-- =============================================================
alter table public.config_slas enable row level security;

drop policy if exists "sgc_auth_all_config_slas" on public.config_slas;
create policy "sgc_auth_all_config_slas"
on public.config_slas
for all
to authenticated
using (true)
with check (true);

-- =============================================================
-- VISIBILIDADE POR MES
-- =============================================================
alter table public.visibilidade_mes enable row level security;

drop policy if exists "sgc_auth_all_visibilidade_mes" on public.visibilidade_mes;
create policy "sgc_auth_all_visibilidade_mes"
on public.visibilidade_mes
for all
to authenticated
using (true)
with check (true);

commit;

-- Teste depois de rodar:
-- 1. Abra o sistema em aba anonima.
-- 2. Sem login, os dados nao devem carregar.
-- 3. Com login, os dados devem aparecer e salvar normalmente.
--
-- Proximo passo recomendado:
-- Criar tabela de perfis/cargos para separar admin, financeiro, operador e consulta.
