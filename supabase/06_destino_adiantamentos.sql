-- Execute após o SQL 05. Registros antigos ficam sem destino até a escolha na tela.
begin;
alter table public.adiantamentos_motoristas
    add column if not exists destino text check (destino in ('domingo', 'extra'));
drop policy if exists adiantamentos_insercao on public.adiantamentos_motoristas;
create policy adiantamentos_insercao on public.adiantamentos_motoristas for insert to authenticated
    with check (usuario_id = auth.uid() and cancelado_em is null and cancelado_por is null
        and destino is not null and destino in ('domingo', 'extra'));
create or replace function public.definir_destino_adiantamento(p_id uuid, p_destino text)
returns uuid language plpgsql security definer set search_path = public as $$
declare alterado uuid;
begin
    if auth.uid() is null then raise exception 'Login necessario'; end if;
    if p_destino is null or p_destino not in ('domingo', 'extra') then raise exception 'Destino invalido'; end if;
    update public.adiantamentos_motoristas set destino = p_destino
        where id = p_id and destino is null and cancelado_em is null returning id into alterado;
    if alterado is null then raise exception 'Registro ja classificado, excluido ou inexistente'; end if;
    return alterado;
end;
$$;
revoke all on function public.definir_destino_adiantamento(uuid, text) from public, anon;
grant execute on function public.definir_destino_adiantamento(uuid, text) to authenticated;
commit;
