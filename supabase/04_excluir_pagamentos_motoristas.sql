-- Execute depois do SQL 03, no SQL Editor do mesmo projeto Supabase.
-- Permite aos usuarios autenticados corrigir pagamentos do historico compartilhado.
begin;
grant delete on public.pagamentos_motoristas to authenticated;
drop policy if exists pagamentos_exclusao on public.pagamentos_motoristas;
create policy pagamentos_exclusao on public.pagamentos_motoristas
    for delete to authenticated using (true);
commit;
