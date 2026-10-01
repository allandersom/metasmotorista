-- Execute no SQL Editor do mesmo projeto Supabase usado pelo sistema.
begin;
create table if not exists public.pagamentos_motoristas (
    id uuid primary key default gen_random_uuid(),
    motorista_nome text not null check (length(trim(motorista_nome)) > 0),
    valor numeric(12,2) not null check (valor > 0),
    data_pagamento date not null,
    criado_em timestamptz not null default now(),
    usuario_id uuid default auth.uid() references auth.users(id) on delete set null
);
create index if not exists idx_pagamentos_motoristas_data on public.pagamentos_motoristas(data_pagamento);
alter table public.pagamentos_motoristas enable row level security;
revoke all on public.pagamentos_motoristas from anon, authenticated;
grant select, insert on public.pagamentos_motoristas to authenticated;
drop policy if exists pagamentos_leitura on public.pagamentos_motoristas;
create policy pagamentos_leitura on public.pagamentos_motoristas for select to authenticated using (true);
drop policy if exists pagamentos_insercao on public.pagamentos_motoristas;
create policy pagamentos_insercao on public.pagamentos_motoristas for insert to authenticated with check (usuario_id = auth.uid());
commit;
