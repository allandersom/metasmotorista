// Valores monetários internos em centavos. Sem gravações durante o cálculo.
export const nomeNormalizado = nome => String(nome || '').trim().toUpperCase();
export const centavos = valor => Math.round((Number(valor) || 0) * 100);
export function hojeLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function fimMes(mes) {
    const [ano, numero] = mes.split('-').map(Number);
    return `${mes}-${new Date(ano, numero, 0).getDate()}`;
}
export function semana(data) {
    const d = new Date(`${data}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
    return d.toISOString().slice(0, 10);
}
export function creditoEspecial(lancamento) {
    const bruto = Math.max(0, centavos(lancamento.valor_faturamento));
    if (lancamento.is_feriado) return { categoria: 'feriado', bruto };
    if (new Date(`${lancamento.data}T12:00:00Z`).getUTCDay() === 0) return { categoria: 'domingo', bruto };
    const avulso = /\[EXTRA R\$\s*20\]/i.test(lancamento.observacao || '');
    // valor_extra já está incluído em valor_faturamento.
    return { categoria: 'extra', bruto: avulso ? bruto : Math.min(bruto, Math.max(0, centavos(lancamento.valor_extra))) };
}

export function calcularSaldosPorDestino(lancamentos, adiantamentos, inicio, fim, cadastro = []) {
    const mapa = new Map();
    const categoriaVazia = () => ({ produzido: 0, adiantado: 0, anterior: 0, saldo: 0 });
    function obter(nome) {
        nome = nomeNormalizado(nome);
        if (!nome) return null;
        if (!mapa.has(nome)) mapa.set(nome, { nome, domingo: categoriaVazia(), extra: categoriaVazia(), semDestino: 0, meses: new Map() });
        return mapa.get(nome);
    }
    function mesDe(g, data) {
        const mes = data.slice(0, 7);
        if (!g.meses.has(mes)) g.meses.set(mes, { domingo: { produzido: 0, adiantado: 0 }, extra: { produzido: 0, adiantado: 0 } });
        return g.meses.get(mes);
    }
    cadastro.filter(m => m.status !== 'inativo').forEach(m => obter(m.nome));
    for (const l of lancamentos) {
        if (l.cancelado_em || !l.data || l.data > fim) continue;
        const g = obter(l.motorista_nome);
        if (!g) continue;
        const credito = creditoEspecial(l);
        const destino = credito.categoria === 'extra' ? 'extra' : 'domingo';
        if (l.data < inicio) mesDe(g, l.data)[destino].produzido += credito.bruto;
        else g[destino].produzido += credito.bruto;
    }
    for (const a of adiantamentos) {
        if (!a.data || a.data > fim) continue;
        const g = obter(a.motorista_nome);
        if (!g || a.cancelado_em) continue;
        if (!['domingo', 'extra'].includes(a.destino)) { g.semDestino += centavos(a.valor); continue; }
        if (a.data < inicio) mesDe(g, a.data)[a.destino].adiantado += centavos(a.valor);
        else g[a.destino].adiantado += centavos(a.valor);
    }
    for (const g of mapa.values()) {
        for (const destino of ['domingo', 'extra']) {
            let pendente = 0;
            for (const [mes, valores] of [...g.meses.entries()].sort(([a], [b]) => a.localeCompare(b))) {
                pendente = Math.min(0, pendente + valores[destino].produzido - valores[destino].adiantado);
            }
            const atual = g[destino];
            g[destino] = { ...atual, anterior: pendente, saldo: pendente + atual.produzido - atual.adiantado };
        }
        delete g.meses;
    }
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}
