const supabase = window.supabaseClient;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForAppFunctions() {
    while (true) {
        if (typeof window.syncToSupabase === 'function'
            && typeof window.deletarLancamentoEspecifico === 'function'
            && typeof window.apagarLancamentosMotorista === 'function') {
            return true;
        }

        await sleep(300);
    }
}

async function getUsuarioAtual() {
    const { data } = await supabase.auth.getUser();
    return data?.user || null;
}

function cloneJson(valor) {
    if (valor === undefined || valor === null) return null;
    return JSON.parse(JSON.stringify(valor));
}

async function buscarLancamento(dataStr, motoristaNome) {
    const { data, error } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('data', dataStr)
        .eq('motorista_nome', motoristaNome)
        .maybeSingle();

    if (error) {
        console.warn('Nao foi possivel buscar lancamento para auditoria:', error.message);
        return null;
    }

    return data || null;
}

async function buscarLancamentosMotoristaMes(motoristaNome, dataInicio, dataFim) {
    const { data, error } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('motorista_nome', motoristaNome)
        .gte('data', dataInicio)
        .lte('data', dataFim);

    if (error) {
        console.warn('Nao foi possivel buscar lancamentos do mes para auditoria:', error.message);
        return [];
    }

    return data || [];
}

async function registrarAuditoria({ acao, dataServico = null, motoristaNome = null, antes = null, depois = null, observacao = null }) {
    try {
        const usuario = await getUsuarioAtual();
        const payload = {
            acao,
            data_servico: dataServico,
            motorista_nome: motoristaNome,
            dados_antes: cloneJson(antes),
            dados_depois: cloneJson(depois),
            observacao,
            usuario_id: usuario?.id || null,
            usuario_email: usuario?.email || null,
            origem: 'app_web',
        };

        const { error } = await supabase
            .from('lancamentos_historico')
            .insert(payload);

        if (error) {
            console.warn('Falha ao registrar historico do lancamento:', error.message);
        }
    } catch (error) {
        console.warn('Falha inesperada na auditoria:', error);
    }
}

function patchSyncToSupabase() {
    const originalSync = window.syncToSupabase;
    window.syncToSupabase = async function(dataStr, motoristaNome) {
        const antes = await buscarLancamento(dataStr, motoristaNome);
        await originalSync.apply(this, arguments);
        const depois = await buscarLancamento(dataStr, motoristaNome);

        await registrarAuditoria({
            acao: antes ? 'editar' : 'criar',
            dataServico: dataStr,
            motoristaNome,
            antes,
            depois,
        });
    };
}

function patchImportacaoIA() {
    const originalImportar = window.importarDadosIA;
    if (typeof originalImportar !== 'function') return;

    window.importarDadosIA = async function() {
        const texto = document.getElementById('codigoIA')?.value.trim();
        let qtdItens = 0;

        try {
            const dados = texto ? JSON.parse(texto) : [];
            qtdItens = Array.isArray(dados) ? dados.length : 0;
        } catch (_) {
            qtdItens = 0;
        }

        await originalImportar.apply(this, arguments);

        if (qtdItens > 0) {
            await registrarAuditoria({
                acao: 'importar_ia',
                observacao: `Importacao via IA executada com ${qtdItens} item(ns) no arquivo informado.`,
            });
        }
    };
}

function patchDeleteEspecifico() {
    const originalDelete = window.deletarLancamentoEspecifico;
    window.deletarLancamentoEspecifico = async function(dataStr) {
        const motoristaNome = window.motoristaSelecionado;
        const antes = motoristaNome ? await buscarLancamento(dataStr, motoristaNome) : null;

        await originalDelete.apply(this, arguments);

        if (!antes || !motoristaNome) return;

        const depois = await buscarLancamento(dataStr, motoristaNome);
        if (!depois) {
            await registrarAuditoria({
                acao: 'excluir',
                dataServico: dataStr,
                motoristaNome,
                antes,
                depois: null,
            });
        }
    };
}

function patchDeleteMesMotorista() {
    const originalDeleteMes = window.apagarLancamentosMotorista;
    window.apagarLancamentosMotorista = async function() {
        const motoristaNome = window.motoristaSelecionado;
        const elMes = document.getElementById('dataGlobal');
        const mesFiltroStr = elMes?.value ? elMes.value.substring(0, 7) : window.formatarDataParaBusca(new Date()).substring(0, 7);
        const dataInicio = `${mesFiltroStr}-01`;
        const ultimoDia = new Date(Number(mesFiltroStr.substring(0, 4)), Number(mesFiltroStr.substring(5, 7)), 0).getDate();
        const dataFim = `${mesFiltroStr}-${String(ultimoDia).padStart(2, '0')}`;
        const antes = motoristaNome ? await buscarLancamentosMotoristaMes(motoristaNome, dataInicio, dataFim) : [];

        await originalDeleteMes.apply(this, arguments);

        if (!motoristaNome || antes.length === 0) return;

        const depois = await buscarLancamentosMotoristaMes(motoristaNome, dataInicio, dataFim);
        if (depois.length === 0) {
            await registrarAuditoria({
                acao: 'excluir_mes_motorista',
                motoristaNome,
                antes,
                depois: [],
                observacao: `Exclusao em lote de ${antes.length} lancamento(s) entre ${dataInicio} e ${dataFim}.`,
            });
        }
    };
}

function patchApagarTudo() {
    const originalApagarTudo = window.apagarTudo;
    if (typeof originalApagarTudo !== 'function') return;

    window.apagarTudo = async function() {
        const { data: antes, error } = await supabase
            .from('lancamentos')
            .select('*')
            .limit(5000);

        if (error) console.warn('Nao foi possivel capturar base antes de apagar tudo:', error.message);

        await originalApagarTudo.apply(this, arguments);

        if (antes?.length) {
            const { count } = await supabase
                .from('lancamentos')
                .select('*', { count: 'exact', head: true });

            if (count === 0) {
                await registrarAuditoria({
                    acao: 'excluir_tudo',
                    antes,
                    depois: [],
                    observacao: `Exclusao total de ${antes.length} lancamento(s) capturados na auditoria.`,
                });
            }
        }
    };
}

async function initAuditLancamentos() {
    if (!supabase?.auth) return;
    if (window.__auditLancamentosAtivo) return;

    await waitForAppFunctions();

    patchSyncToSupabase();
    patchImportacaoIA();
    patchDeleteEspecifico();
    patchDeleteMesMotorista();
    patchApagarTudo();

    window.__auditLancamentosAtivo = true;
    console.log('Auditoria de lançamentos ativada.');
}

initAuditLancamentos();