// ==========================================
// SISTEMA DE TRAVAMENTO DE MÊS
// Arquivo: lock-mes.js
// ==========================================

window.LockMes = {
    senhaMestra: "ddd11112231", // <-- ALTERE A SENHA AQUI
    mesesTravados: [],

    // Inicia o sistema, busca os meses fechados e cria o botão
    init: async function() {
        await this.carregarTravas();
        this.renderizarBotao();
    },

    carregarTravas: async function() {
        try {
            const { data, error } = await window.supabaseClient.from('meses_fechados').select('mes');
            if (!error && data) {
                this.mesesTravados = data.map(d => d.mes);
            }
        } catch(e) {
            console.error("Erro ao carregar travas do mês", e);
        }
    },

    isTravado: function(mesStr) {
        return this.mesesTravados.includes(mesStr);
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

        const mesAtual = elMes.value.substring(0, 7);
        const travado = this.isTravado(mesAtual);

        // Muda a cor e o texto baseado no status
        btn.innerHTML = travado ? '🔒 Mês Fechado' : '🔓 Mês Aberto';
        btn.style.background = travado ? '#ef4444' : '#10b981';
        btn.style.color = 'white';
        btn.style.border = 'none';
        
        btn.onclick = () => this.toggleTrava(mesAtual, travado);
    },

    toggleTrava: async function(mes, atualmenteTravado) {
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
                await window.supabaseClient.from('meses_fechados').delete().eq('mes', mes);
                this.mesesTravados = this.mesesTravados.filter(m => m !== mes);
                alert(`Mês ${mes} desbloqueado! Edições estão liberadas.`);
            } else {
                // Trava: insere no banco
                await window.supabaseClient.from('meses_fechados').insert([{ mes: mes }]);
                this.mesesTravados.push(mes);
                alert(`Mês ${mes} TRAVADO! Nenhuma edição poderá ser feita.`);
            }
            this.renderizarBotao();
        } catch(e) {
            alert("Erro ao alterar status do mês.");
        }
    },
    
    // Função principal que será chamada para barrar ações
    acaoBloqueada: function(dataDoLancamento) {
        if (!dataDoLancamento) return false;
        
        const mesDoLancamento = dataDoLancamento.substring(0, 7);
        if (this.isTravado(mesDoLancamento)) {
            alert(`⛔ AÇÃO BLOQUEADA!\nO mês de ${mesDoLancamento} está fechado.\nDestranque o mês com a senha para fazer alterações.`);
            return true; // Retorna true indicando que está bloqueado
        }
        return false; // Retorna false indicando que pode prosseguir
    }
};

// Monitora quando você troca de mês no input para atualizar o visual do botão
document.addEventListener('DOMContentLoaded', () => {
    const elMes = document.getElementById('dataGlobal');
    if (elMes) {
        elMes.addEventListener('change', () => window.LockMes.renderizarBotao());
    }
});