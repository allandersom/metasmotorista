// ==========================================
// SISTEMA DE TRAVAMENTO DE MÊS
// Arquivo: lock-mes.js
// ==========================================

window.LockMes = {
    senhaMestra: "logistica123", // <-- ALTERE A SENHA AQUI
    mesesTravados: [],

    normalizarMes: function(valor) {
        const resultado = /^(\d{4}-\d{2})/.exec(valor || '');
        return resultado ? resultado[1] : null;
    },

    obterMesSelecionado: function() {
        return this.normalizarMes(document.getElementById('dataGlobal')?.value);
    },

    // Inicia o sistema, busca os meses fechados e cria o botão
    init: async function() {
        await this.carregarTravas();
        this.renderizarBotao();
    },

    carregarTravas: async function() {
        try {
            const { data, error } = await window.supabaseClient.from('meses_fechados').select('mes');
            if (!error && data) {
                this.mesesTravados = [...new Set(
                    data.map(d => this.normalizarMes(d.mes)).filter(Boolean)
                )];
            }
        } catch(e) {
            console.error("Erro ao carregar travas do mês", e);
        }
    },

    isTravado: function(mesStr) {
        const mes = this.normalizarMes(mesStr);
        return Boolean(mes) && this.mesesTravados.includes(mes);
    },

    renderizarBotao: function() {
        // Tenta achar o input de data global para colocar o botão do lado dele
        const elMes = document.getElementById('dataGlobal');
        if (!elMes) return;

        const container = elMes.parentElement;
        let btn = document.getElementById('btnLockMes');
        
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'btnLockMes';
            btn.className = 'btn-sistema';
            btn.style.marginLeft = '10px';
            btn.style.height = '36px';
            btn.style.fontWeight = 'bold';
            container.appendChild(btn);
        }

        const mesAtual = this.obterMesSelecionado();
        if (!mesAtual) {
            btn.disabled = true;
            btn.innerHTML = '🔒 Selecione um mês';
            return;
        }
        btn.disabled = false;
        const travado = this.isTravado(mesAtual);

        // Muda a cor e o texto baseado no status
        btn.innerHTML = travado ? '🔒 Mês Fechado' : '🔓 Mês Aberto';
        btn.style.background = travado ? '#ef4444' : '#10b981';
        btn.style.color = 'white';
        btn.style.border = 'none';
        
        // Lê o mês no clique para nunca usar uma referência antiga.
        btn.onclick = () => this.toggleTrava();
    },

   toggleTrava: async function() {
        const mes = this.obterMesSelecionado();
        if (!mes) {
            alert('Selecione o mês que deseja travar ou destravar.');
            return;
        }

        await this.carregarTravas();
        const atualmenteTravado = this.isTravado(mes);
        const acao = atualmenteTravado ? 'DESBLOQUEAR' : 'TRAVAR';
        const senha = prompt(`Digite a senha para ${acao} o mês de ${mes}:`);

        if (senha === null) return; // Cancelou o prompt
        
        if (senha !== this.senhaMestra) {
            alert("Senha incorreta! Ação cancelada.");
            return;
        }

        try {
            if (atualmenteTravado) {
                // Destrava: deleta do banco
                const { error } = await window.supabaseClient.from('meses_fechados').delete().eq('mes', mes);
                if (error) {
                    console.error("Erro ao desbloquear mês:", error);
                    alert("Erro ao desbloquear o mês: " + error.message);
                    return;
                }
                this.mesesTravados = this.mesesTravados.filter(m => m !== mes);
                alert(`Mês ${mes} desbloqueado! Edições estão liberadas.`);
            } else {
                // Trava: insere no banco
                const { error } = await window.supabaseClient.from('meses_fechados').insert([{ mes: mes }]);
                if (error) {
                    console.error("Erro ao travar mês:", error);
                    alert("Erro ao travar o mês: " + error.message);
                    return;
                }
                this.mesesTravados.push(mes);
                alert(`Mês ${mes} TRAVADO! Nenhuma edição poderá ser feita.`);
            }
            this.renderizarBotao();
        } catch(e) {
            console.error("Erro ao alterar status do mês:", e);
            alert("Erro ao alterar status do mês: " + e.message);
        }
    },
    
    // Função principal que será chamada para barrar ações
    acaoBloqueada: function(dataDoLancamento) {
        if (!dataDoLancamento) return false;
        
        const mesDoLancamento = this.normalizarMes(dataDoLancamento);
        if (!mesDoLancamento) return false;
        if (this.isTravado(mesDoLancamento)) {
            alert(`⛔ AÇÃO BLOQUEADA!\nO mês de ${mesDoLancamento} está fechado.\nDestranque o mês com a senha para fazer alterações.`);
            return true; // Retorna true indicando que está bloqueado
        }
        return false; // Retorna false indicando que pode prosseguir
    },

    periodoBloqueado: function(dataInicio, dataFim) {
        const inicio = this.normalizarMes(dataInicio);
        const fim = this.normalizarMes(dataFim);
        if (!inicio || !fim) return false;

        const cursor = new Date(`${inicio}-01T00:00:00`);
        const limite = new Date(`${fim}-01T00:00:00`);
        while (cursor <= limite) {
            const mes = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
            if (this.acaoBloqueada(mes)) return true;
            cursor.setMonth(cursor.getMonth() + 1);
        }
        return false;
    }
};

// Monitora quando você troca de mês no input para atualizar o visual do botão
document.addEventListener('DOMContentLoaded', () => {
    const elMes = document.getElementById('dataGlobal');
    if (elMes) {
        elMes.addEventListener('change', () => window.LockMes.renderizarBotao());
    }
});
