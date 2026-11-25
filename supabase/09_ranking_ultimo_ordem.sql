-- Ordem dos motoristas marcados para aparecer no fim dos rankings.
begin;

alter table public.motoristas
    add column if not exists ranking_ultimo_em timestamptz;

comment on column public.motoristas.ranking_ultimo_em is
    'Momento em que o motorista foi marcado para aparecer no fim; o mais recente fica por último.';

-- Os registros já marcados recebem uma ordem inicial determinística.
with marcados as (
    select id,
           row_number() over (order by id asc) as ordem
    from public.motoristas
    where ranking_ultimo is true
      and ranking_ultimo_em is null
)
update public.motoristas as m
set ranking_ultimo_em = timestamptz '2000-01-01 00:00:00+00' + (marcados.ordem * interval '1 second')
from marcados
where m.id = marcados.id;

commit;
