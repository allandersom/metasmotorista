import { motoristasComMovimento, textoPesquisa, excluirMovimentoFinanceiro } from './financeiro-controles.js';
import { buscarPagamentos } from './pagamentos.js?v=5';
import { calcularMetasFinanceiro } from './meta-financeiro.js';
import { calcularSaldosPorDestino, fimMes, hojeLocal, nomeNormalizado } from './adiantamentos-calculo.js?v=4';
import { formatarMoeda } from '../utils/format.js';

const moeda = centavos => formatarMoeda(centavos / 100);
const escapar = texto => String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const dataBr = data => data.split('-').reverse().join('/');
const $ = id => document.getElementById(id);

// Paginação evita saldos incorretos quando o mês ultrapassa o limite do Supabase.
async function lerTodos(tabela, inicio, fim) {
    const registros = [];
    for (let offset = 0; ; offset += 1000) {
        let query = window.supabaseClient.from(tabela).select(tabela === 'adiantamentos_motoristas' ? 'id,motorista_nome,data,valor,destino,observacao,criado_em,cancelado_em' : '*').lte('data', fim)
            .order('data').order(tabela === 'lancamentos' ? 'motorista_nome' : 'id');
        if (tabela === 'lancamentos') query = query.is('cancelado_em', null);
        const { data, error } = await query.range(offset, offset + 999);
        if (error) throw new Error('Não foi possível consultar os adiantamentos. Verifique a conexão e execute os SQLs 05 e 06 no Supabase.');
        registros.push(...(data || []));
        if (!data || data.length < 1000) return registros;
    }
}

export async function consultarAcerto(inicio, fim) {
    if (!inicio || !fim || inicio > fim) throw new Error('Selecione um período válido.');
    // Inclui o histórico anterior para transportar somente pendências até o período.
    const primeiro = inicio, ultimo = fim;
    const [lancamentos, adiantamentos] = await Promise.all([
        lerTodos('lancamentos', primeiro, ultimo), lerTodos('adiantamentos_motoristas', primeiro, ultimo),
    ]);
    const motoristas = calcularSaldosPorDestino(lancamentos, adiantamentos, inicio, fim, window.todosMotoristasCloud || []);
    return { motoristas, adiantamentos, lancamentos };
}

let versao = 0;
let ocupado = false;
let motoristaAberto = null;
let mesRenderizado = null;

function mostrarAcerto(acerto) {
    const mes = $('acertoMes').value;
    const motoristas = motoristasComMovimento(acerto, mes + '-01', fimMes(mes));
    const fechado = fimMes($('acertoMes').value) < hojeLocal();
    $('acertoEstado').textContent = fechado ? 'Mês encerrado' : 'Mês aberto';
    const listas = new Map();
    const container = $('acertoMotoristas');
    container.replaceChildren();
    if (!motoristas.length) container.innerHTML = '<p class="acerto-vazio">Nenhum motorista encontrado neste mês.</p>';
    for (const motorista of motoristas) {
        const painel = document.createElement('details');
        painel.className = 'financeiro-motorista';
        painel.name = 'motoristas-financeiro';
        painel.dataset.motorista = motorista.nome;
        painel.open = motoristaAberto === motorista.nome;
        painel.innerHTML = `
            <summary><span>${escapar(motorista.nome)}</span><span class="financeiro-seta" aria-hidden="true">⌄</span></summary>
            <div class="financeiro-detalhes">
                <div class="financeiro-categorias">
                    ${['meta', 'domingo', 'extra'].map(destino => {
                        const c = motorista[destino] || { saldo: 0, produzido: 0, adiantado: 0 };
                        return `<div><span>${destino === 'meta' ? 'Meta (Leaderboard Mensal)' : destino === 'domingo' ? 'Domingos e feriados' : 'Extras'}</span><strong class="${c.saldo < 0 ? 'saldo-negativo' : 'saldo-positivo'}">${moeda(c.saldo)}</strong><small>${destino === 'meta' ? 'Leaderboard' : 'Realizado'}: ${moeda(c.produzido)} · ${destino === 'meta' ? 'Pago' : 'Adiantado'}: ${moeda(c.adiantado)}${c.anterior ? ` · Pendente anterior: ${moeda(c.anterior)}` : ''}</small></div>`;
                    }).join('')}
                </div>
                ${motorista.semDestino ? `<p class="financeiro-legenda">${moeda(motorista.semDestino)} em adiantamentos antigos aguardando escolha do destino abaixo.</p>` : ''}
                <div class="financeiro-historico"><h4>Pagamentos e adiantamentos</h4><div class="financeiro-registros"></div></div>
            </div>`;
        const lista = painel.querySelector('.financeiro-registros');
        listas.set(motorista.nome, lista);
        container.appendChild(painel);
    }
    const historico = [...acerto.adiantamentos, ...(acerto.pagamentosMeta || []).map(p => ({ ...p, data: p.data_pagamento, destino: 'meta' }))].sort((a, b) => b.data.localeCompare(a.data) || String(b.criado_em || '').localeCompare(String(a.criado_em || '')));
    for (const item of historico) {
        const linha = document.createElement('div');
        linha.className = 'acerto-historico-item' + (item.cancelado_em ? ' acerto-cancelado' : '');
        linha.innerHTML = `<div><strong>${escapar(item.motorista_nome)}</strong><p>${dataBr(item.data)} · ${item.destino === 'meta' ? 'Meta' : item.destino === 'domingo' ? 'Domingos e feriados' : item.destino === 'extra' ? 'Extras' : 'Escolha onde abater'}${item.observacao ? ' · ' + escapar(item.observacao) : ''}</p>${item.cancelado_em ? '<small>Excluído em ' + escapar(new Date(item.cancelado_em).toLocaleString('pt-BR')) + ' · não entra no saldo</small>' : ''}</div><b>${moeda(Math.round(Number(item.valor) * 100))}</b>`;
        if (!item.cancelado_em && !item.destino) {
            for (const destino of ['domingo', 'extra']) {
                const escolher = document.createElement('button');
                escolher.type = 'button';
                escolher.className = 'acerto-secundario';
                escolher.textContent = destino === 'domingo' ? 'Abater em domingos/feriados' : 'Abater em extras';
                escolher.addEventListener('click', () => definirDestino(item, destino));
                linha.appendChild(escolher);
            }
        }
        if (!item.cancelado_em) {
            const botao = document.createElement('button');
            botao.type = 'button';
            botao.className = 'acerto-excluir';
            botao.textContent = 'Excluir';
            botao.disabled = ocupado;
            botao.addEventListener('click', () => excluirAdiantamento(item));
            linha.appendChild(botao);
        }
        listas.get(nomeNormalizado(item.motorista_nome))?.appendChild(linha);
    }
    for (const lista of listas.values()) {
        if (!lista.children.length) lista.innerHTML = '<p class="financeiro-legenda">Nenhum pagamento neste mês.</p>';
    }
    mesRenderizado = mes;
    window.filtrarFinanceiro();
}

window.filtrarFinanceiro = function () {
    const termo = textoPesquisa($('pesquisaFinanceiro')?.value);
    let quantidade = 0;
    for (const painel of document.querySelectorAll('#acertoMotoristas .financeiro-motorista')) {
        painel.hidden = !textoPesquisa(painel.dataset.motorista).includes(termo);
        if (!painel.hidden) quantidade++;
    }
    $('resultadoPesquisaFinanceiro').textContent = quantidade ? `${quantidade} motorista(s)` : 'Nenhum motorista com movimentação encontrado.';
};

window.carregarAcertoExtras = async function (sincronizarMes = false) {
    if (!$('acertoMes')) return;
    if (!$('acertoMes').value || sincronizarMes) $('acertoMes').value = $('dataGlobal')?.value?.slice(0, 7) || hojeLocal().slice(0, 7);
    const mes = $('acertoMes').value;
    motoristaAberto = mesRenderizado === mes ? document.querySelector('#acertoMotoristas .financeiro-motorista[open]')?.dataset.motorista : null;
    const atual = ++versao;
    $('acertoEstado').textContent = 'Atualizando saldos...';
    $('acertoMotoristas').textContent = 'Carregando...';
    const select = $('acertoNome'), nome = select.value;
    select.replaceChildren(new Option('Selecione o motorista', ''));
    [...new Set((window.todosMotoristasCloud || []).map(m => nomeNormalizado(m.nome)))].filter(Boolean).sort()
        .forEach(n => select.add(new Option(n, n)));
    select.value = nome;
    $('acertoData').max = hojeLocal();
    if (!$('acertoData').value) $('acertoData').value = hojeLocal();
    try {
        const [acerto, pagamentosMeta] = await Promise.all([
            consultarAcerto(mes + '-01', fimMes(mes)), buscarPagamentos(mes + '-01', fimMes(mes)),
        ]);
        if (atual !== versao) return;
        const metas = calcularMetasFinanceiro(acerto.lancamentos, pagamentosMeta, mes + '-01', fimMes(mes));
        for (const [nome, meta] of metas) {
            let motorista = acerto.motoristas.find(m => m.nome === nome);
            if (!motorista) {
                motorista = { nome, semDestino: 0, domingo: { saldo: 0, produzido: 0, adiantado: 0 }, extra: { saldo: 0, produzido: 0, adiantado: 0 } };
                acerto.motoristas.push(motorista);
            }
            motorista.meta = meta;
        }
        acerto.motoristas.sort((a, b) => a.nome.localeCompare(b.nome));
        acerto.pagamentosMeta = pagamentosMeta;
        mostrarAcerto(acerto);
    } catch (erro) {
        if (atual !== versao) return;
        $('acertoEstado').textContent = 'Saldo indisponível';
        $('acertoMotoristas').textContent = erro.message;
    }
};

function bloquear(valor) {
    ocupado = valor;
    $('acertoSalvar').disabled = valor;
    document.querySelectorAll('.acerto-excluir').forEach(b => { b.disabled = valor; });
}

async function atualizarTelas() {
    await window.carregarAcertoExtras();
}

window.salvarAdiantamentoExtras = async function (evento) {
    evento.preventDefault();
    if (window.usuarioAtualFuncao === 'operador' || ocupado || !evento.target.reportValidity()) return;
    const destino = $('acertoDestino').value;
    const data = $('acertoData').value, valor = Number($('acertoValor').value), nome = $('acertoNome').value;
    if (!['meta', 'domingo', 'extra'].includes(destino) || !nome || !data || data > hojeLocal() || !Number.isFinite(valor) || valor < 0.01) return;
    if (window.LockMes?.acaoBloqueada(data)) return;
    bloquear(true);
    $('acertoStatus').textContent = 'Salvando pagamento...';
    try {
        const resposta = destino === 'meta'
            ? await window.supabaseClient.from('pagamentos_motoristas').insert({ motorista_nome: nome, data_pagamento: data, valor: Math.round(valor * 100) / 100 })
            : await window.supabaseClient.from('adiantamentos_motoristas').insert({ motorista_nome: nome, data, destino, valor: Math.round(valor * 100) / 100, observacao: $('acertoObs').value.trim() });
        const { error } = resposta;
        if (error) throw error;
        $('acertoValor').value = '';
        $('acertoObs').value = '';
        $('acertoMes').value = data.slice(0, 7);
        $('acertoStatus').textContent = 'Pagamento salvo com sucesso.';
        await atualizarTelas();
    } catch (erro) {
        console.error('Falha ao salvar adiantamento:', erro);
        $('acertoStatus').textContent = 'Não foi possível salvar. Verifique a conexão e as tabelas de pagamentos no Supabase.';
    } finally { bloquear(false); }
};

async function excluirAdiantamento(item) {
    if (window.usuarioAtualFuncao === 'operador' || ocupado || window.LockMes?.acaoBloqueada(item.data)) return;
    if (!window.confirm(`Excluir somente este pagamento de ${moeda(Math.round(Number(item.valor) * 100))} de ${item.motorista_nome}, em ${dataBr(item.data)}? O saldo da categoria escolhida será recalculado.`)) return;
    bloquear(true);
    try {
        await excluirMovimentoFinanceiro(window.supabaseClient, item);
        $('acertoStatus').textContent = item.destino === 'meta' ? 'Somente este pagamento da meta foi excluído.' : 'Somente este adiantamento foi excluído. Os demais registros foram mantidos.';
        await atualizarTelas();
    } catch (erro) {
        console.error('Falha ao excluir adiantamento:', erro);
        $('acertoStatus').textContent = 'Não foi possível excluir. Atualize a tela e verifique a conexão e o SQL 05 no Supabase.';
    } finally { bloquear(false); }
}

async function definirDestino(item, destino) {
    if (window.usuarioAtualFuncao === 'operador' || ocupado || window.LockMes?.acaoBloqueada(item.data)) return;
    if (!window.confirm(`Abater o adiantamento de ${moeda(Math.round(Number(item.valor) * 100))} de ${item.motorista_nome} em ${destino === 'extra' ? 'extras' : 'domingos e feriados'}?`)) return;
    bloquear(true);
    try {
        const { error } = await window.supabaseClient.rpc('definir_destino_adiantamento', { p_id: item.id, p_destino: destino });
        if (error) throw error;
        $('acertoStatus').textContent = 'Destino definido.';
        await atualizarTelas();
    } catch (erro) {
        $('acertoStatus').textContent = 'Não foi possível definir o destino. Verifique a conexão e o SQL 06.';
    } finally { bloquear(false); }
}

export function resumoAcertoPdf(motoristas, inicio, fim) {
    return `<h2>Financeiro por motorista</h2><p>${dataBr(inicio)} a ${dataBr(fim)}</p><table><thead><tr><th>Motorista</th><th>Categoria</th><th>Pendente anterior</th><th>Realizado</th><th>Adiantado</th><th>Saldo</th></tr></thead><tbody>${motoristas.map(m => ['domingo', 'extra'].map(destino => {
        const c = m[destino];
        return `<tr><td>${escapar(m.nome)}</td><td>${destino === 'extra' ? 'Extras' : 'Domingos e feriados'}</td><td>${moeda(c.anterior)}</td><td>${moeda(c.produzido)}</td><td>${moeda(c.adiantado)}</td><td>${moeda(c.saldo)}</td></tr>`;
    }).join('') + (m.semDestino ? `<tr><td colspan="6">${escapar(m.nome)}: ${moeda(m.semDestino)} aguardando escolha do destino.</td></tr>` : '')).join('')}</tbody></table>`;
}

