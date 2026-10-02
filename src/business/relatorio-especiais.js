import { creditoEspecial, nomeNormalizado } from './adiantamentos-calculo.js?v=4';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const moeda = v => (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = v => v.split('-').reverse().join('/');

export function gerarRelatorioEspeciais(acerto, inicio, fim, cadastro = []) {
    const cadastros = new Map(cadastro.map(m => [nomeNormalizado(m.nome), m]));
    const linhas = { domingo: [], feriado: [], extra: [] };
    for (const motorista of acerto.motoristas) {
        for (const destino of ['domingo', 'extra']) {
            const c = motorista[destino];
            let desconto = c.adiantado - c.anterior;
            const servicos = acerto.lancamentos.filter(l => !l.cancelado_em && l.data >= inicio && l.data <= fim && nomeNormalizado(l.motorista_nome) === motorista.nome)
                .map(l => ({ ...l, credito: creditoEspecial(l) }))
                .filter(l => l.credito.bruto > 0 && (destino === 'extra' ? l.credito.categoria === 'extra' : l.credito.categoria !== 'extra'))
                .sort((a, b) => a.data.localeCompare(b.data));
            for (const l of servicos) {
                const abatido = Math.min(desconto, l.credito.bruto);
                desconto -= abatido;
                linhas[l.credito.categoria].push({ nome: motorista.nome, data: l.data, qtd: `${l.quantidade_servicos || 0} ${l.tipo_veiculo === 'cacamba' ? 'vg' : 'cx'}`, valor: l.credito.bruto - abatido, obs: String(l.observacao || '').replace(/\[EXTRA R\$\s*20\]\s*/gi, '').trim(), abatido });
            }
            if (desconto > 0) {
                const categoria = destino === 'extra' ? 'extra' : (servicos.at(-1)?.credito.categoria || 'domingo');
                linhas[categoria].push({ nome: motorista.nome, data: null, qtd: '—', valor: -desconto, obs: 'Adiantamento pendente', abatido: 0 });
            }
        }
    }
    function nomePix(nome) {
        const pix = cadastros.get(nome)?.chave_pix;
        return `${esc(nome)} <span class="pix">${pix ? 'PIX: ' + esc(pix) : '⚠ PIX não cadastrado'}</span>`;
    }
    function tabela(registros, extra = false) {
        if (!registros.length) return '<p class="empty">Nenhum registro no período.</p>';
        const nomes = [...new Set(registros.map(r => r.nome))].sort();
        const temAbatimento = registros.some(r => r.abatido > 0);
        let brutoTotal = 0, abatidoTotal = 0, pagarTotal = 0, pendenteTotal = 0;
        let html = `<table><thead><tr><th>Motorista / PIX</th><th class="money">Valor bruto</th>${temAbatimento ? '<th class="money">Adiantamento<br>descontado</th>' : ''}<th class="money">Valor que falta pagar</th></tr></thead><tbody>`;
        for (const nome of nomes) {
            const lista = registros.filter(r => r.nome === nome);
            const bruto = lista.reduce((t, r) => t + (r.data ? r.valor + r.abatido : 0), 0);
            const abatido = lista.reduce((t, r) => t + r.abatido, 0);
            const saldo = lista.reduce((t, r) => t + r.valor, 0);
            const pagar = Math.max(0, saldo);
            const pendente = Math.max(0, -saldo);
            brutoTotal += bruto; abatidoTotal += abatido; pagarTotal += pagar; pendenteTotal += pendente;
            const detalhes = lista.filter(r => r.data).map(r => `${dataBr(r.data)} · ${esc(r.qtd)}${extra && r.obs ? ' · ' + esc(r.obs) : ''}`).join('<br>');
            html += `<tr><td><strong>${nomePix(nome)}</strong>${detalhes ? `<small class="services">${detalhes}</small>` : ''}${pendente ? `<small class="pending">Adiantamento pendente: ${moeda(pendente)}</small>` : ''}</td><td class="money">${moeda(bruto)}</td>${temAbatimento ? `<td class="money deduction">${abatido ? moeda(abatido) : '—'}</td>` : ''}<td class="money payable">${moeda(pagar)}${pagar === 0 ? '<small>Sem pagamento</small>' : ''}</td></tr>`;
        }
        html += `</tbody><tfoot><tr><td>Total a pagar</td><td class="money">${moeda(brutoTotal)}</td>${temAbatimento ? `<td class="money">${moeda(abatidoTotal)}</td>` : ''}<td class="money payable">${moeda(pagarTotal)}</td></tr></tfoot></table>`;
        if (pendenteTotal) html += `<p class="pending-note">Adiantamento pendente: ${moeda(pendenteTotal)} — saldo para abatimento futuro, não incluído no total a pagar.</p>`;
        return html;
    }
    // Somar pagamentos individualmente: a dívida de um motorista não reduz o pagamento de outro.
    const registrosResumo = Object.values(linhas).flat();
    const totalBruto = registrosResumo.reduce((total, r) => total + (r.data ? r.valor + r.abatido : 0), 0);
    const totalDescontado = registrosResumo.reduce((total, r) => total + r.abatido, 0);
    const totalPagar = Object.values(linhas).reduce((total, registros) => {
        const saldos = new Map();
        for (const r of registros) saldos.set(r.nome, (saldos.get(r.nome) || 0) + r.valor);
        return total + [...saldos.values()].reduce((t, valor) => t + Math.max(0, valor), 0);
    }, 0);
    const aviso = acerto.motoristas.filter(m => m.semDestino > 0).map(m => `<p style="color:#92400e;">${esc(m.nome)}: ${moeda(m.semDestino)} aguardando escolha do destino; saldo provisório.</p>`).join('');
    const periodo = `${dataBr(inicio)} – ${dataBr(fim)}`;
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Domingos, feriados e extras</title><style>
    @page{size:A4 portrait;margin:14mm 12mm}
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:28px;color:#263342;font-size:11px;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    h1{font-size:23px;letter-spacing:-.5px;margin:0;color:#192b40}h2{font-size:13px;margin:26px 0 9px;padding-bottom:8px;border-bottom:2px solid #233a52;break-after:avoid}.kicker{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;margin-bottom:6px}.sub{font-size:10px;color:#64748b;margin:8px 0 20px}.summary{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1;padding:14px 0;margin:18px 0 24px}.summary{gap:18px;break-inside:avoid}.summary>div{flex:1;min-width:0}.summary>div:not(:first-child){text-align:right}.summary strong{display:block;margin-top:5px;font-size:20px;color:#192b40;white-space:nowrap;font-variant-numeric:tabular-nums}.summary span{font-size:10px;font-weight:600;color:#64748b}
    table{width:100%;border-collapse:collapse;font-size:10px;table-layout:fixed}th,td{padding:11px 8px;border-bottom:1px solid #dce2e8;vertical-align:top}th{background:#f0f3f6;color:#445366;font-size:9px;text-align:left;font-weight:700}th:first-child{width:46%}td:first-child{overflow-wrap:anywhere}.money{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.payable{font-weight:700;font-size:12px;color:#192b40;background:#f6f8fa}.deduction{color:#4b5563}.pix{display:block;margin-top:4px;color:#475569;font-size:9px;font-weight:400;overflow-wrap:anywhere}.services{font-size:8px;color:#718096;line-height:1.5;margin-top:7px}small{display:block;font-size:8px;font-weight:400;margin-top:4px;white-space:normal}.pending{color:#5b6470;font-weight:700;margin-top:7px}.pending-note{font-size:9px;color:#5b6470;margin:8px 0 0}.empty{font-size:10px;color:#64748b}tfoot td{border-top:2px solid #233a52;font-weight:700;padding-top:12px}tr{break-inside:avoid}thead{display:table-header-group}tfoot{display:table-row-group}.report-footer{margin-top:28px;border-top:1px solid #cbd5e1;padding-top:9px;font-size:9px;color:#64748b}@media print{body{padding:0}}
    </style></head><body><div class="kicker">Financeiro · Relação de pagamentos</div><h1>Domingos, feriados e extras</h1><div class="sub">Período: ${periodo}<br>Emitido em ${esc(new Date().toLocaleString('pt-BR'))}</div>${aviso}<div class="summary"><div><span>Valor bruto</span><strong>${moeda(totalBruto)}</strong></div>${totalDescontado > 0 ? `<div><span>Adiantamento descontado</span><strong>${moeda(totalDescontado)}</strong></div>` : ''}<div><span>Valor que falta pagar</span><strong>${moeda(totalPagar)}</strong></div></div><h2>Domingos</h2>${tabela(linhas.domingo)}<h2>Feriados</h2>${tabela(linhas.feriado)}${linhas.extra.length ? '<h2>Extras · Dias úteis</h2>' + tabela(linhas.extra,true) : ''}<footer class="report-footer">Valores em reais (R$) · Líquido a pagar já considera os adiantamentos descontados.</footer></body></html>`;
}
