import { ehDiaEspecialRanking } from './meta-financeiro.js';

export function resumirPeriodoBI(lancamentos, inicio, fim, hoje, nomes = null) {
    const dias = [];
    for (let d = new Date(inicio + 'T12:00:00'); d <= new Date(fim + 'T12:00:00'); d.setDate(d.getDate() + 1)) {
        const data = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (d.getDay() !== 0) dias.push(data);
    }
    const feriados = new Set(lancamentos.filter(l => !l.cancelado_em && l.is_feriado).map(l => l.data));
    const uteis = dias.filter(d => !feriados.has(d));
    const decorridos = uteis.filter(d => d <= hoje).length;
    let caixas = 0, viagens = 0, registros = 0;
    for (const l of lancamentos) {
        if (l.cancelado_em || l.data < inicio || l.data > fim || l.data > hoje) continue;
        if (nomes && !nomes.has(String(l.motorista_nome || '').trim().toUpperCase())) continue;
        if ((l.status_servico || 'normal').toLowerCase() !== 'normal') continue;
        if (ehDiaEspecialRanking(l.data, { isFeriado: l.is_feriado, observacao: l.observacao, pontos: l.observacao?.includes('[EXTRA R$ 20]') ? 0 : l.quantidade_servicos })) continue;
        registros++;
        if (l.tipo_veiculo === 'cacamba') viagens += Number(l.quantidade_servicos) || 0;
        else caixas += Number(l.quantidade_servicos) || 0;
    }
    return { caixas, viagens, registros, dias: uteis.length, decorridos,
        media: decorridos ? caixas / decorridos : null,
        projecao: decorridos && registros ? caixas / decorridos * uteis.length : null,
        projecaoViagens: decorridos && registros ? viagens / decorridos * uteis.length : null };
}

export function compararMotoristasAtivosBI(cadastro, lancamentos, a, b, hoje, turno = 'todos', desligados = new Set()) {
    return cadastro.filter(m => {
        const nome = String(m.nome || '').trim().toUpperCase();
        return nome && !['inativo','desligado'].includes(m.status) && !m.data_demissao && !desligados.has(nome)
            && (turno === 'todos' || (turno === 'especial' ? !['dia','noite'].includes(m.turno) : m.turno === turno));
    }).sort((a,b) => a.nome.localeCompare(b.nome,'pt-BR')).map(m => {
        const nomes = new Set([m.nome.trim().toUpperCase()]);
        return { nome: m.nome, turno: m.turno,
            base: resumirPeriodoBI(lancamentos,...a,hoje,nomes),
            atual: resumirPeriodoBI(lancamentos,...b,hoje,nomes) };
    });
}

export function ultimosMesesCompletosBI(hoje) {
    const [ano, mes] = hoje.split('-').map(Number);
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return {
        a: [fmt(new Date(ano, mes-3, 1, 12)), fmt(new Date(ano, mes-2, 0, 12))],
        b: [fmt(new Date(ano, mes-2, 1, 12)), fmt(new Date(ano, mes-1, 0, 12))],
    };
}
