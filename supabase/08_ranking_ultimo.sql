-- Preferência para manter motoristas selecionados no fim dos rankings.
begin;

alter table public.motoristas
    add column if not exists ranking_ultimo boolean not null default false;

comment on column public.motoristas.ranking_ultimo is
    'Quando verdadeiro, o motorista aparece após os demais no Leaderboard Mensal e no Ranking de Período.';

commit;
