-- Cadastro de responsáveis pelas metas existentes dos turnos. Não altera lançamentos.
begin;
create table if not exists public.operadores (
 id uuid primary key default gen_random_uuid(),
 nome text not null check (length(trim(nome)) between 1 and 120),
 turno text not null check (turno in ('dia','noite')),
 ativo boolean not null default true,
 criado_em timestamptz not null default now()
);
create unique index if not exists operadores_um_ativo_por_turno on public.operadores(turno) where ativo;
alter table public.operadores enable row level security;
revoke all on public.operadores from anon, authenticated;
grant select, insert, update on public.operadores to authenticated;
drop policy if exists operadores_leitura on public.operadores;
create policy operadores_leitura on public.operadores for select to authenticated using (
 exists(select 1 from public.usuarios_perfis p where p.id=auth.uid() and p.aprovado=true)
);
drop policy if exists operadores_insercao on public.operadores;
create policy operadores_insercao on public.operadores for insert to authenticated with check (
 exists(select 1 from public.usuarios_perfis p where p.id=auth.uid() and p.aprovado=true and p.papel='admin')
);
drop policy if exists operadores_edicao on public.operadores;
create policy operadores_edicao on public.operadores for update to authenticated using (
 exists(select 1 from public.usuarios_perfis p where p.id=auth.uid() and p.aprovado=true and p.papel='admin')
) with check (
 exists(select 1 from public.usuarios_perfis p where p.id=auth.uid() and p.aprovado=true and p.papel='admin')
);
insert into public.operadores(nome,turno) select 'Rayanna','dia' where not exists(select 1 from public.operadores where turno='dia');
insert into public.operadores(nome,turno) select 'Júlia','noite' where not exists(select 1 from public.operadores where turno='noite');
commit;
