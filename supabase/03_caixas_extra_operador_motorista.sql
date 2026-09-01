-- Execute uma vez no Supabase SQL Editor.
-- Adiciona o motorista responsável ao lançamento de caixas extras.

alter table public.caixas_extra_operador
add column if not exists motorista_nome text;
