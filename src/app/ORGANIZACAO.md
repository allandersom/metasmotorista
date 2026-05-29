# Organizacao do app

Esta pasta documenta a nova organizacao do frontend. O objetivo e deixar o sistema mais facil de manter sem quebrar o GitHub Pages nem os handlers `onclick` existentes no HTML.

## Entrada

- `app.js`: ponto de entrada carregado pelo `index.html`. Deve ficar pequeno.
- `src/app/main.js`: orquestra o carregamento do app.
- `app.runtime.js`: runtime atual preservado temporariamente. Ele ainda concentra muitas funcoes globais porque o HTML chama `window.*` em varios pontos.

## Modulos ja separados

- `src/utils/date.js`: funcoes puras de data.
- `src/utils/format.js`: formatacao de moeda, quantidades, percentuais e numeros.
- `src/business/financeiro.js`: regras de negocio de valores, metas e calculos financeiros.
- `src/audit-lancamentos.js`: auditoria dos lancamentos no Supabase.
- `src/auth-gate.js`: tela e fluxo de autenticacao.

## Proximos cortes seguros

A proxima etapa e extrair blocos de `app.runtime.js` para arquivos menores mantendo a mesma API global enquanto o HTML ainda usa `onclick`:

- `src/app/data/supabase-store.js`: carregar dados, salvar lancamentos e importar IA.
- `src/app/ui/navigation.js`: sidebar, troca de abas, filtros e selecao de motorista.
- `src/app/ui/modals.js`: modais de sistema, backup e gerenciamento.
- `src/app/features/lancamentos.js`: salvar lancamento, historico e exclusao.
- `src/app/features/rankings.js`: rankings, resumos e exportacao de PDF.
- `src/app/features/dom-feriados.js`: painel de domingos e feriados.
- `src/app/features/rotas.js`: rota do dia e planilha.
- `src/app/features/cadastro-motoristas.js`: cadastro, edicao e status de motoristas.
- `src/app/features/faltas-atestados.js`: relatorios de faltas e atestados.

## Regra de seguranca

Cada extracao deve manter os nomes `window.nomeDaFuncao` ate o HTML ser limpo. Assim o comportamento visual continua igual e a refatoracao pode ser testada por partes.
