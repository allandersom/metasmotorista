<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SGC Logística - Sistema Enterprise</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    
    <link rel="stylesheet" href="style.css">
</head>
<body>

    <div id="loader" class="loading-screen">
        <div class="spinner"></div>
        <p id="loader-text" style="font-weight: 800; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Conectando à Nuvem...</p>
    </div>

    <div class="main-navigation">
        <button class="nav-tab active" id="btnTabLancamentos" onclick="window.mudarAba('lancamentos')">📋 Painel de Lançamentos</button>
        <button class="nav-tab" id="btnTabRankings" onclick="window.mudarAba('rankings')">⚔️ Central de Rankings</button>
        <button class="nav-tab tab-extra" id="btnTabDomFeriados" onclick="window.mudarAba('domferiados')">🛑 Domingos & Feriados</button>
    </div>

    <div id="viewLancamentos">
        <div class="topbar">
            <h2>Gestão Diária da Frota</h2>
            <div class="global-controls">
                <div class="box-dias-uteis">
                    <label>Dias Úteis Globais (Mês):</label>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <input type="number" id="inputDiasUteisLanc" min="1" max="31" onchange="window.salvarDiasUteis('lanc')" readonly>
                        <button class="btn-lock" id="btnTravaLanc" onclick="window.toggleTravaGlobais()" title="Destravar/Travar">🔒</button>
                    </div>
                </div>

                <div>
                    <label style="margin-bottom: 6px; font-size: 12px; display:block;">Data de Referência:</label>
                    <input type="date" id="dataGlobal" onchange="window.sincronizarMesData(); window.atualizarResumosGlobais();" style="padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-family: 'Inter';">
                </div>
                
                <div class="resumo-badge dia">
                    <span class="resumo-titulo">Total Frota (Dia)</span>
                    <span class="resumo-valor" id="totalDiaGlobal">R$ 0,00</span>
                    <span class="resumo-subtext" id="caixasDiaGlobal">0 cx</span>
                </div>
                <div class="resumo-badge semana">
                    <span class="resumo-titulo">Total Frota (Semana)</span>
                    <span class="resumo-valor" id="totalSemanaGlobal">R$ 0,00</span>
                    <span class="resumo-subtext" id="caixasSemanaGlobal">0 cx</span>
                </div>
            </div>
        </div>

        <div class="app-layout">
            <div class="sidebar">
                <h3>Selecionar Motorista</h3>
                <input type="text" id="buscaMotorista" class="search-box" placeholder="🔍 Buscar por nome..." onkeyup="window.filtrarMotoristas()">
                
                <div class="driver-list-container">
                    <ul class="driver-list" id="listaMotoristas"></ul>
                </div>
            </div>

            <div class="main-panel">
                <div id="estadoVazio" class="empty-state">
                    👈 Clique em um motorista na lista ao lado para iniciar.
                </div>

                <div id="conteudoMotorista" style="display: none;">
                    <div class="header-motorista">
                        <h3 id="nomeMotoristaDisplay">Nome do Motorista</h3>
                        
                        <div class="sla-config" title="Altere apenas se este motorista trabalhou uma quantidade de dias úteis diferente da frota geral neste mês.">
                            <label>SLA (Dias Úteis no Mês):</label>
                            <input type="number" id="inputSlaMotorista" min="1" max="31" onchange="window.salvarSlaMotorista()">
                        </div>

                        <div class="resumos-grid">
                            <div class="resumo-motorista-box">
                                <div>
                                    <span>Total (Dia Selecionado)</span>
                                    <strong id="motoristaTotalDia">R$ 0,00</strong>
                                </div>
                            </div>
                            <div class="resumo-motorista-box semana">
                                <div>
                                    <span>Total (Semana Atual)</span>
                                    <strong id="motoristaTotalSemana">R$ 0,00</strong>
                                </div>
                            </div>
                            <div class="resumo-motorista-box mes" title="Não contabiliza Domingos e Feriados">
                                <div>
                                    <span>Resultados no Mês (Úteis)</span>
                                    <strong id="motoristaCaixasMes">0 cx | 0 vg</strong>
                                    <span class="resumo-detalhe" id="motoristaMetaMes">Meta Mensal: 0 pt | Fat: R$ 0,00</span>
                                </div>
                            </div>
                            <div class="resumo-motorista-box previsao">
                                <div>
                                    <span>Previsão Final (Mês)</span>
                                    <strong id="motoristaPrevisaoMes">0 cx | 0 vg</strong>
                                    <span class="resumo-detalhe" style="color:#b45309;"></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="grafico-motorista-container">
                        <canvas id="chartEvolucao"></canvas>
                    </div>

                    <div class="form-grid">
                        <div>
                            <label for="dataLancamento">Data do Serviço:</label>
                            <input type="date" id="dataLancamento" onchange="window.atualizarResumosDoMotorista(); window.atualizarSlaInput();">
                        </div>
                        <div>
                            <label for="tipoVeiculo">Veículo Operado:</label>
                            <select id="tipoVeiculo">
                                </select>
                        </div>
                        <div>
                            <label for="servicos">Qtd (Caixas/Viagens):</label>
                            <input type="number" id="servicos" min="0" placeholder="Ex: 0 para registrar presença">
                        </div>
                        <div>
                            <label for="valorExtra">Serviço Extra (R$):</label>
                            <input type="number" id="valorExtra" step="0.01" min="0" placeholder="Por fora (Ex: 50)">
                        </div>
                        <div class="checkbox-group" style="align-self: center;">
                            <input type="checkbox" id="feriado">
                            <label for="feriado">É Feriado?</label>
                        </div>
                        <div>
                            <button class="btn-primary" onclick="window.salvarLancamento()">Lançar Serviço</button>
                        </div>
                    </div>

                    <h4>Histórico de Lançamentos</h4>
                    <table id="tabelaHistorico">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Veículo / Dia</th>
                                <th>Qtd</th>
                                <th>Serviço Extra</th>
                                <th>Valor a Pagar</th>
                                <th>Ação</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <div id="viewRankings">
        <div class="topbar">
            <h2>Central de Rankings SGC</h2>
            <div class="global-controls">
                <div class="box-dias-uteis">
                    <label>Dias Úteis Globais (Mês):</label>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <input type="number" id="inputDiasUteisRank" min="1" max="31" onchange="window.salvarDiasUteis('rank')" readonly>
                        <button class="btn-lock" id="btnTravaRank" onclick="window.toggleTravaGlobais()" title="Destravar/Travar">🔒</button>
                    </div>
                </div>

                <div class="resumo-badge" style="background: linear-gradient(135deg, #10b981, #059669);">
                    <span class="resumo-titulo">Meta Geral (Mês)</span>
                    <span class="resumo-valor" id="metaGeralGlobal" style="font-size: 16px;">0 cx</span>
                </div>
                <div class="resumo-badge" style="background: linear-gradient(135deg, #ec4899, #be185d);">
                    <span class="resumo-titulo">Meta Rayanna (Mês)</span>
                    <span class="resumo-valor" id="metaRayannaGlobal" style="font-size: 16px;">0 cx</span>
                </div>
                <div class="resumo-badge" style="background: linear-gradient(135deg, #6366f1, #4338ca);">
                    <span class="resumo-titulo">Meta Júlia (Mês)</span>
                    <span class="resumo-valor" id="metaJuliaGlobal" style="font-size: 16px;">0 cx</span>
                </div>
            </div>
        </div>

        <div class="rankings-grid">
            
            <div class="ranking-panel">
                <div class="panel-header">
                    <h3>🚀 Ranking por Período</h3>
                    <div class="date-range-container">
                        <input type="date" id="dataRankingInicio" onchange="window.gerarRankingPeriodo()">
                        <span>até</span>
                        <input type="date" id="dataRankingFim" onchange="window.gerarRankingPeriodo()">
                    </div>
                </div>
                <div id="listaRankingDiario"></div>
            </div>

            <div class="ranking-panel">
                <div class="panel-header">
                    <h3>⚔️ Leaderboard Mensal (Elo)</h3>
                    <div>
                        <input type="month" id="mesFiltro" style="padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; font-family: 'Inter';" onchange="window.sincronizarMesFiltro(); window.gerarRankingMensal();">
                    </div>
                </div>
                <div style="font-size: 11px; color: #64748b; margin-bottom: 10px;">* O cálculo de Elo unifica 1 Vg = 2 Cx. A ordem é baseada na Porcentagem do SLA individual do motorista.</div>
                <div id="listaLeaderboard"></div>
            </div>

        </div>
    </div>

    <div id="viewDomFeriados">
        <div class="topbar feriado-theme">
            <h2>Painel de Domingos & Feriados</h2>
            <div class="global-controls">
                <div>
                    <label style="margin-bottom: 6px; font-size: 12px; display:block;">Selecione o Período:</label>
                    <div class="date-range-container">
                        <input type="date" id="dataDomInicio" onchange="window.gerarPainelFeriados()" style="border-color:#fca5a5;">
                        <span>até</span>
                        <input type="date" id="dataDomFim" onchange="window.gerarPainelFeriados()" style="border-color:#fca5a5;">
                    </div>
                </div>
                <div class="resumo-badge feriado">
                    <span class="resumo-titulo">Total Extra (Período)</span>
                    <span class="resumo-valor" id="totalFatDomGlobal">R$ 0,00</span>
                    <span class="resumo-subtext" id="totalCxDomGlobal">0 cx</span>
                </div>
            </div>
        </div>

        <div class="rankings-grid" style="margin-top: 20px;">
            <div class="ranking-panel">
                <div class="panel-header">
                    <h3>☀️ Domingos</h3>
                </div>
                <div id="listaDomingos"></div>
            </div>
            
            <div class="ranking-panel">
                <div class="panel-header">
                    <h3>🎉 Feriados</h3>
                </div>
                <div id="listaFeriados"></div>
            </div>
        </div>
    </div>

    <script type="module" src="app.js"></script>

</body>
</html>
