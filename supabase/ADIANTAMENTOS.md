# Financeiro por destino

Execute os SQLs 05 e 06 no Supabase. A aplicação não executa migrações automaticamente.

Ao registrar um adiantamento, escolha **Domingos e feriados** ou **Extras**. O valor reduz somente o saldo escolhido, que pode ficar negativo. Serviços futuros dessa categoria cobrem a pendência. O saldo negativo remanescente segue para o mês seguinte na mesma categoria; não há transferência para a meta. Saldos positivos anteriores não são reaproveitados para abater novos adiantamentos.

O Financeiro mostra o mês selecionado, com realizado, adiantado, pendência anterior e saldo separados por destino. A data do registro determina o mês. Os históricos incluem registros anteriores para permitir conferir pendências. A exclusão recalcula os saldos.

Registros anteriores ao SQL 06 ficam sem destino. Escolha a categoria pelos botões no histórico; eles aparecem destacados e não são debitados automaticamente até essa escolha. O PDF também identifica valores aguardando destino.

Validação: `node --test tests/adiantamentos.test.mjs tests/adiantamentos-integracao.test.mjs`.


## Meta no Financeiro

A Meta usa a mesma regra de faturamento do Leaderboard Mensal. Os pagamentos são gravados na tabela `pagamentos_motoristas` já existente (SQLs 03 e 04), preservando os registros anteriores. São considerados no mês da data do pagamento e podem ser excluídos no histórico do motorista. Os abatimentos da meta ficam exclusivamente no Financeiro; o Ranking por Período não desconta esses pagamentos. Domingos/feriados e extras continuam com seus próprios destinos, sem transferência automática de valores para a meta.


## Pesquisa e PDFs

O Financeiro lista apenas motoristas com registros no mês selecionado (serviços, pagamentos ou adiantamentos, incluindo histórico de cancelamentos). A pesquisa ignora acentos e mantém o filtro durante atualizações. Pendências anteriores continuam no cálculo dos motoristas exibidos.

O PDF do Ranking por Período consulta os pagamentos da meta registrados dentro do período e desconta esses valores na exportação, sem mudar os valores da tela. O PDF de domingos/feriados/extras identifica os valores abatidos e pendentes, mantendo a separação por destino. Exclusões usam o ID individual: adiantamentos são cancelados pela função SQL 05, e pagamentos da meta são removidos com filtro por ID, motorista e data.
