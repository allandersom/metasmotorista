-- Execute no SQL Editor do projeto Supabase. Não altera pagamentos de dias úteis.
begin;
create table if not exists public.adiantamentos_motoristas (
    id uuid primary key default gen_random_uuid(),
    motorista_nome text not null check (length(trim(motorista_nome)) > 0),
    data date not null,
    valor numeric(12,2) not null check (valor > 0),
    observacao text not null default '' check (length(observacao) <= 300),
    criado_em timestamptz not null default now(),
    usuario_id uuid default auth.uid() references auth.users(id) on delete set null,
    cancelado_em timestamptz,
    cancelado_por uuid references auth.users(id) on delete set null
);
create index if not exists idx_adiantamentos_data on public.adiantamentos_motoristas(data);
alter table public.adiantamentos_motoristas enable row level security;
revoke all on public.adiantamentos_motoristas from anon, authenticated;
grant select, insert on public.adiantamentos_motoristas to authenticated;
drop policy if exists adiantamentos_leitura on public.adiantamentos_motoristas;
create policy adiantamentos_leitura on public.adiantamentos_motoristas for select to authenticated using (true);
drop policy if exists adiantamentos_insercao on public.adiantamentos_motoristas;
create policy adiantamentos_insercao on public.adiantamentos_motoristas for insert to authenticated
    with check (usuario_id = auth.uid() and cancelado_em is null and cancelado_por is null);

-- Exclusão lógica: preserva o registro original, sem permitir editar valor ou autor.
create or replace function public.cancelar_adiantamento(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare removido uuid;
begin
    if auth.uid() is null then raise exception 'Login necessario'; end if;
    update public.adiantamentos_motoristas
       set cancelado_em = now(), cancelado_por = auth.uid()
     where id = p_id and cancelado_em is null returning id into removido;
    if removido is null then raise exception 'Adiantamento ja excluido ou nao encontrado'; end if;
    return removido;
end;
$$;
revoke all on function public.cancelar_adiantamento(uuid) from public, anon;
grant execute on function public.cancelar_adiantamento(uuid) to authenticated;
commit;
