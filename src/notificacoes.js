    // =============================================================
// MÓDULO CENTRAL DE NOTIFICAÇÕES E INSIGHTS INTELIGENTES (SGC)
// =============================================================

class GerenciadorNotificacoes {
    constructor() {
        this.notificacoes = [];
        this.dropdownAberto = false;
        this.init();
    }

    init() {
        // Injeta os estilos CSS necessários para o painel de notificações
        this.injetarEstilos();
        
        // Aguarda carregamento do DOM para vincular os eventos do sino
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.vincularSino());
        } else {
            this.vincularSino();
        }

        // Fecha o dropdown ao clicar fora dele
        document.addEventListener('click', (e) => {
            const painel = document.getElementById('sgc-notif-panel');
            const botao = document.querySelector('.notif-dot');
            if (painel && botao && !painel.contains(e.target) && !botao.contains(e.target)) {
                this.fecharDropdown();
            }
        });
    }

    vincularSino() {
        const btnSino = document.querySelector('.notif-dot');
        if (!btnSino) return;

        // Garante ID para manipulação limpa
        btnSino.setAttribute('id', 'btnSinoNotificacoes');
        
        // Evento de clique para alternar visualização do painel
        btnSino.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleDropdown();
        };
    }

    injetarEstilos() {
        if (document.getElementById('sgc-notif-styles')) return;
        const style = document.createElement('style');
        style.id = 'sgc-notif-styles';
        style.innerHTML = `
            .notif-wrapper {
                position: relative;
            }
            .sgc-dropdown {
                position: absolute;
                top: 55px;
                right: 16px;
                width: 360px;
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 16px;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
                z-index: 9999;
                display: none;
                flex-direction: column;
                overflow: hidden;
                font-family: system-ui, -apple-system, sans-serif;
                animation: scaleInNotif 0.2s ease-out;
            }
            @keyframes scaleInNotif {
                from { opacity: 0; transform: scale(0.95) translateY(-10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            .sgc-dropdown-header {
                padding: 14px 16px;
                background: #f8fafc;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .sgc-dropdown-header h3 {
                margin: 0;
                font-size: 14px;
                font-weight: 700;
                color: #0f172a;
            }
            .sgc-notif-count-badge {
                background: #ef4444;
                color: white;
                font-size: 11px;
                font-weight: 700;
                padding: 2px 8px;
                border-radius: 999px;
            }
            .sgc-dropdown-body {
                max-height: 380px;
                overflow-y: auto;
            }
            .sgc-notif-item {
                padding: 12px 16px;
                border-bottom: 1px solid #f1f5f9;
                display: flex;
                gap: 12px;
                transition: background 0.2s;
                cursor: pointer;
            }
            .sgc-notif-item:hover {
                background: #f8fafc;
            }
            .sgc-notif-icon-box {
                width: 32px;
                height: 32px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                font-size: 16px;
            }
            .icon-recorde { background: #dcfce7; color: #15803d; }
            .icon-alerta { background: #fee2e2; color: #b91c1c; }
            .icon-meta { background: #e0e7ff; color: #4338ca; }
            .icon-info { background: #fef3c7; color: #b45309; }
            
            .sgc-notif-content {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .sgc-notif-title {
                font-size: 12.5px;
                font-weight: 600;
                color: #1e293b;
                line-height: 1.4;
            }
            .sgc-notif-sub {
                font-size: 11px;
                color: #64748b;
            }
            .sgc-notif-vazio {
                padding: 32px 16px;
                text-align: center;
                color: #94a3b8;
                font-size: 13px;
                font-style: italic;
            }
            /* Ajuste dinâmico do ponto vermelho nativo do sino */
            .notif-dot-active::after {
                content: '';
                position: absolute;
                top: 2px;
                right: 2px;
                width: 8px;
                height: 8px;
                background: #ef4444;
                border-radius: 50%;
                border: 2px solid white;
            }
        `;
        document.head.appendChild(style);
    }

    toggleDropdown() {
        const painel = document.getElementById('sgc-notif-panel');
        if (!painel) {
            this.criarPainelHtml();
            this.toggleDropdown();
            return;
        }
        
        if (this.dropdownAberto) {
            this.fecharDropdown();
        } else {
            painel.style.display = 'flex';
            this.dropdownAberto = true;
        }
    }

    fecharDropdown() {
        const painel = document.getElementById('sgc-notif-panel');
        if (painel) painel.style.display = 'none';
        this.dropdownAberto = false;
    }

    criarPainelHtml() {
        const painel = document.createElement('div');
        painel.id = 'sgc-notif-panel';
        painel.className = 'sgc-dropdown';
        
        // Monta a estrutura interna
        painel.innerHTML = `
            <div class="sgc-dropdown-header">
                <h3>Insights & Notificações</h3>
                <span class="sgc-notif-count-badge" id="sgc-badge-qtd">0</span>
            </div>
            <div class="sgc-dropdown-body" id="sgc-lista-notifs">
                <!-- Injeção via JS -->
            </div>
        `;
        
        document.body.appendChild(painel);
        this.renderizarNotificacoesNaTela();
    }

    /**
     * Processa o banco de dados em tempo real e descobre os recordes e metas
     */
    gerarInsightsEstrategicos(bancoCloud, todosMotoristas) {
        this.notificacoes = [];

        if (!bancoCloud || Object.keys(bancoCloud).length === 0) return;

        let maiorVolumeFrota = 0;
        let dataRecordeFrota = '';
        let recordesPessoais = {}; // { MOTORISTA: { maxQtd: X, data: Y } }

        // 1. Processa histórico completo para achar recordes históricos
        for (const [dataStr, motoresDia] of Object.entries(bancoCloud)) {
            let volumeDiaFrota = 0;

            for (const [nomeMot, dados] of Object.entries(motoresDia)) {
                const isExtra = dados.observacao && (dados.observacao.includes('[EXTRA R$ 20]') || dados.observacao.includes('[EXTRA R$20]'));
                if (dados.status && dados.status !== 'normal') continue;
                if (isExtra) continue;

                const qtd = dados.servicos || 0;
                volumeDiaFrota += (dados.tipoVeiculo === 'cacamba' ? qtd * 2 : qtd); // Normaliza volume em caixas virtuais

                // Recorde Individual Histórico
                if (!recordesPessoais[nomeMot] || qtd > recordesPessoais[nomeMot].maxQtd) {
                    recordesPessoais[nomeMot] = { maxQtd: qtd, data: dataStr, tipo: dados.tipoVeiculo };
                }
            }

            if (volumeDiaFrota > maiorVolumeFrota) {
                maiorVolumeFrota = volumeDiaFrota;
                dataRecordeFrota = dataStr;
            }
        }

        // --- INSIGHT 1: RECORD HISTÓRICO DA FROTA ---
        if (maiorVolumeFrota > 0) {
            const dataFmt = dataRecordeFrota.split('-').reverse().join('/');
            this.notificacoes.push({
                tipo: 'recorde',
                titulo: `Recorde Histórico da Frota Comercial!`,
                sub: `A frota atingiu o pico de ${maiorVolumeFrota} caixas virtuais em um único dia (${dataFmt}).`,
                icone: '📊'
            });
        }

        // --- INSIGHT 2: RECORDES PESSOAIS RECENTES ---
        // Pegamos os motoristas com recordes no mês atual exibido na tela
        const elMes = document.getElementById('dataGlobal');
        const mesAtualFiltro = elMes?.value ? elMes.value.substring(0, 7) : new Date().toISOString().substring(0, 7);

        Object.entries(recordesPessoais).forEach(([nome, rec]) => {
            if (rec.data.substring(0, 7) === mesAtualFiltro && rec.maxQtd > 5) {
                const sufixo = rec.tipo === 'cacamba' ? 'viagens' : 'caixas';
                const dataFmt = rec.data.split('-').reverse().join('/');
                this.notificacoes.push({
                    tipo: 'meta',
                    titulo: `${nome} bateu seu Recorde Pessoal!`,
                    sub: `O motorista alcançou a marca incrível de ${rec.maxQtd} ${sufixo} no dia ${dataFmt}.`,
                    icone: '⭐'
                });
            }
        });

        // --- INSIGHT 3: CAUTELA RH (CNH VENCIDA OU ANIVERSÁRIOS) ---
        if (todosMotoristas && todosMotoristas.length > 0) {
            const hoje = new Date();
            hoje.setHours(0,0,0,0);

            todosMotoristas.forEach(m => {
                if (m.status === 'inativo') return;

                // Validação CNH
                if (m.cnh_venc) {
                    const venc = new Date(m.cnh_venc + 'T00:00:00');
                    if (venc <= hoje) {
                        this.notificacoes.push({
                            tipo: 'alerta',
                            titulo: `CNH Vencida: ${m.nome}`,
                            sub: `Atenção operacional: Documento venceu em ${new Date(m.cnh_venc + 'T12:00:00').toLocaleDateString('pt-BR')}.`,
                            icone: '🛑'
                        });
                    } else {
                        // Vence nos próximos 30 dias
                        const diffDias = Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24));
                        if (diffDias <= 30) {
                            this.notificacoes.push({
                                tipo: 'info',
                                titulo: `CNH a vencer: ${m.nome}`,
                                sub: `Documento de habilitação expira em ${diffDias} dias. Agendar renovação.`,
                                iconClass: 'icon-info',
                                icone: '⚠️'
                            });
                        }
                    }
                }

                // Validação de Aniversário Próximo (Janela inteligente de 5 dias)
                if (m.data_nascimento) {
                    const anoAtual = hoje.getFullYear();
                    const [, mes, dia] = m.data_nascimento.split('-').map(Number);
                    const aniv = new Date(anoAtual, mes - 1, dia);
                    const diffMs = aniv - hoje;
                    const diffDias = diffMs / (1000 * 60 * 60 * 24);

                    if (diffDias >= -1 && diffDias <= 5) {
                        this.notificacoes.push({
                            tipo: 'info',
                            titulo: `Aniversariante da Semana: ${m.nome}`,
                            sub: `Parabéns! Data especial comemorada em ${dia}/${mes}. Lembre de parabenizá-lo!`,
                            icone: '🎂'
                        });
                    }
                }
            });
        }

        // Atualiza os contadores visuais do sino
        this.atualizarBadgeSino();
        this.renderizarNotificacoesNaTela();
    }

    atualizarBadgeSino() {
        const btnSino = document.getElementById('btnSinoNotificacoes') || document.querySelector('.notif-dot');
        if (!btnSino) return;

        if (this.notificacoes.length > 0) {
            btnSino.classList.add('notif-dot-active');
        } else {
            btnSino.classList.remove('notif-dot-active');
        }

        const badgeQtd = document.getElementById('sgc-badge-qtd');
        if (badgeQtd) badgeQtd.innerText = this.notificacoes.length;
    }

    renderizarNotificacoesNaTela() {
        const lista = document.getElementById('sgc-notif-panel')?.querySelector('#sgc-notifs-body') || document.getElementById('sgc-lista-notifs');
        if (!lista) return;

        if (this.notificacoes.length === 0) {
            lista.innerHTML = `<div class="sgc-notif-vazio">Nenhum insight operacional detectado no momento. 😴</div>`;
            return;
        }

        const classeIconeMap = {
            recorde: 'icon-recorde',
            alerta: 'icon-alerta',
            meta: 'icon-meta',
            info: 'icon-info'
        };

        lista.innerHTML = this.notificacoes.map(n => `
            <div class="sgc-notif-item">
                <div class="sgc-notif-icon-box ${classeIconeMap[n.tipo] || 'icon-info'}">
                    ${n.icone}
                </div>
                <div class="sgc-notif-content">
                    <span class="sgc-notif-title">${n.titulo}</span>
                    <span class="sgc-notif-sub">${n.sub}</span>
                </div>
            </div>
        `).join('');
    }
}

// Expõe globalmente a instância única do Gerenciador de Notificações
window.GerenciadorNotificacoes = new GerenciadorNotificacoes();