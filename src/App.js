
import React, {useEffect, useState, useMemo} from 'react';
import axios from 'axios';
import {CircularProgress} from "@mui/joy";
import { format } from "date-fns";

const getMarginColor = (margin) => {
    if (!isFinite(margin)) return '#8b8e96';
    if (margin < 0) return 'var(--red)';
    if (margin < 10) return 'var(--orange)';
    if (margin < 20) return 'var(--yellow)';
    return 'var(--green)';
};

const getMarginLevel = (margin) => {
    if (!isFinite(margin)) return 'N/A';
    if (margin < 0) return 'vermelho';
    if (margin < 10) return 'laranja';
    if (margin < 20) return 'amarelo';
    return 'verde';
};

function Resultados() {
    const [dados, inserirDados] = useState([]);
    const [numeroDePedidosUnicos, setNumeroDePedidosUnicos] = useState(0);
    const [dadosOntem, inserirDadosOntem] = useState(0);
    const [pedidosOntem, setPedidosOntem] = useState(0);
    const [faturamentoDeHoje, setFaturamentoDeHoje] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [abaPrincipal, setAbaPrincipal] = useState('home'); // home, pedidos, drilldown_grupos
    const [drillLevel, setDrillLevel] = useState(1);
    const [drillGrupo, setDrillGrupo] = useState('');
    const [drillMarca, setDrillMarca] = useState('');
    const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
    const [filtroAtivo, setFiltroAtivo] = useState('Hoje');
    const [imposto, setImposto] = useState(() => { const val = localStorage.getItem('cfg_imposto'); return val ? parseFloat(val) : 6; });
    const [custoOperacional, setCustoOperacional] = useState(() => { const val = localStorage.getItem('cfg_custoOper'); return val ? parseFloat(val) : 6; });
    const [mostrarConfig, setMostrarConfig] = useState(false);
    
    useEffect(() => {
        localStorage.setItem('cfg_imposto', imposto);
        localStorage.setItem('cfg_custoOper', custoOperacional);
    }, [imposto, custoOperacional]);
    const [abaRanking, setAbaRanking] = useState('produtos');
    const [rankLimit, setRankLimit] = useState(10);
    const [ordenacao, setOrdenacao] = useState('pedidos');
    const [filtroRank, setFiltroRank] = useState(null); // {tipo:'marca',valor:'PARAMOUNT'}
    const setDateRange = (rangeType) => {
        const hoje = new Date();
        setIsLoading(true);
        if (rangeType === 'Hoje') {
            setStartDate(hoje);
            setEndDate(hoje);
        } else if (rangeType === 'Ontem') {
            const ontem = new Date();
            ontem.setDate(hoje.getDate() - 1);
            setStartDate(ontem);
            setEndDate(ontem);
        } else if (rangeType === '7 dias') {
            const sete = new Date();
            sete.setDate(hoje.getDate() - 6);
            setStartDate(sete);
            setEndDate(hoje);
        } else if (rangeType === '30 dias') {
            const trinta = new Date();
            trinta.setDate(hoje.getDate() - 29);
            setStartDate(trinta);
            setEndDate(hoje);
        }
        setFiltroAtivo(rangeType);
    };

    // Funcoes de calculo
    const calcularTaxaFixa = (tarifa, mlcustoadicional, unidade, shein) => {
        switch (tarifa) {
            case 20: case 11: case 13: case 12: case 21: case 27: return 5 * unidade;
            case 1: case 25: return shein * unidade;
            case 6: case 5: case 3: case 4: case 2: return 0 * unidade;
            case 9: case 19: case 10: case 24: return 5;
            case 8: case 29: return 5 * unidade;
            default: return 0 * unidade;
        }
    };

    function CalcularTarifaDeVenda(origem, total, sku) {
        switch (origem) {
            case 20: case 11: case 13: case 12: case 21: case 27: return parseFloat((total * 0.20).toFixed(2));
            case 25: return parseFloat((total * 0.16).toFixed(2));
            case 6: case 5: case 3: case 4: case 2: var dado = sku / 100; return parseFloat((total * dado).toFixed(2));
            case 9: case 19: case 10: case 24: return parseFloat((total * 0.18).toFixed(2));
            case 8: case 29: return parseFloat((total * 0.19).toFixed(2));
            default: return 0;
        }
    }

    function CalcularCustoProduto(unidade, custo) {
        if (unidade === 0 || custo === 0) return 0;
        return unidade * custo;
    }

    function CalcularFrete(freteReal, FreteComprador, origem, quant) {
        switch (origem) {
            case 20: case 11: case 13: case 12: case 21: case 27: return 0;
            case 25: return 0;
            case 6: case 5: case 3: case 4: case 2: return (freteReal - FreteComprador) / quant;
            case 9: case 19: case 10: case 24: return 0;
            case 8: case 29: return 0;
            default: return 0;
        }
    }

    function CalcularTotal(valor, taxaFixa, tarifa, custo, frete, impostoPct, operPct) {
        const descImp = valor * (impostoPct / 100);
        const descOper = valor * (operPct / 100);
        return valor - taxaFixa - tarifa - custo - frete - descImp - descOper;
    }

    function CalcularMargemLucro(total, custoProduto) {
        if (custoProduto === 0) return 100;
        var margem = total / custoProduto;
        return margem * 100;
    }

    useEffect(() => {
        const buscarDadosOntem = async () => {
            try {
                const respostaDados = await axios.get('https://painel-zoom-novo.onrender.com/api/faturamento_ontem');
                const pedidosUnicos = new Set();
                let somaTotal = 0;
                respostaDados.data.forEach(item => {
                    if (item.POSICAO.trim() !== 'CANCELADO' && !pedidosUnicos.has(item.PEDIDO)) {
                        pedidosUnicos.add(item.PEDIDO);
                        somaTotal += item.TOTAL_PEDIDO;
                    }
                });
                inserirDadosOntem(somaTotal);
                setPedidosOntem(pedidosUnicos.size);
            } catch (error) { console.error(error); }
        };
        buscarDadosOntem();
        const tempoDeAtualizacao = setInterval(buscarDadosOntem, 60000);
        return () => clearInterval(tempoDeAtualizacao);
    }, []);

    // Sincronizar e buscar dados
    const exportToXLSX = (pedidos) => {
        const header = ["Data", "Pedido ID", "Conta", "SKU / Ref", "Cód Interno", "Título", "Itens", "Venda (R$)", "Custo (R$)", "Frete (R$)", "Comissão (R$)", "Taxa Fixa (R$)", "Imposto (R$)", "Operacional (R$)", "Lucro (R$)", "Margem (%)"];
        
        const rows = pedidos.map(item => [
            item.data_venda || '',
            item.pedido_id || '',
            item.origem_nome || item.vendedor || '',
            item.sku || '',
            item.cod_interno || '',
            `"${(item.titulo || '').replace(/"/g, '""')}"`,
            item.quant_itens || 0,
            (item.valorDeVenda || 0).toFixed(2).replace('.', ','),
            (item.custoProduto || 0).toFixed(2).replace('.', ','),
            (item.frete || 0).toFixed(2).replace('.', ','),
            (item.tarifaDeVenda || 0).toFixed(2).replace('.', ','),
            (item.taxaFixa || 0).toFixed(2).replace('.', ','),
            (item.descImposto || 0).toFixed(2).replace('.', ','),
            (item.descOperacional || 0).toFixed(2).replace('.', ','),
            (item.lucro || 0).toFixed(2).replace('.', ','),
            (isFinite(item.margemLucro) ? item.margemLucro : 0).toFixed(2).replace('.', ',')
        ]);
        
        const csvContent = "\uFEFF" + [header.join(';')].concat(rows.map(r => r.join(';'))).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Relatorio_Margens_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const syncEBuscar = async () => {
        try {
            const dataInicioStr = format(startDate, 'yyyy-MM-dd');
            const dataFimStr = format(endDate, 'yyyy-MM-dd');
            
            // Dispara o sync na nuvem silenciosamente
            try {
                await axios.post(`https://painel-zoom-novo.onrender.com/api/sync`, {
                    data_inicio: dataInicioStr,
                    data_fim: dataFimStr
                });
            } catch(e) { console.log('Erro no sync, buscando o que ja tem:', e); }

            const url = `https://painel-zoom-novo.onrender.com/api/resultados?data_inicio=${dataInicioStr}&data_fim=${dataFimStr}`;
            const respostaDados = await axios.get(url);
            const dadosFiltrados = respostaDados.data.filter(dado => dado.posicao.trim() !== "CANCELADO" && dado.posicao.trim() !== "CANCELADO        ");

            const pedidosUnicos = new Set();
            const dadosSemDuplicatas = [];
            let somaValoresUnicos = 0;

            dadosFiltrados.forEach(dado => {
                if (!pedidosUnicos.has(dado.pedido_id)) {
                    pedidosUnicos.add(dado.pedido_id);
                    dadosSemDuplicatas.push(dado);
                    somaValoresUnicos += dado.total_pedido;
                } else {
                    // No novo motor o ID do produto é o sku
                    const existente = dadosSemDuplicatas.find(item => item.sku === dado.sku && item.pedido_id === dado.pedido_id);
                    if (!existente) {
                        dadosSemDuplicatas.push(dado);
                        somaValoresUnicos += dado.total_pedido;
                    }
                }
            });
            inserirDados(dadosSemDuplicatas);
            setNumeroDePedidosUnicos(pedidosUnicos.size);
            setFaturamentoDeHoje(somaValoresUnicos);
            setIsLoading(false);
        } catch (error) {
            console.error(error);
            setIsLoading(false);
        }
    };

    useEffect(() => {
        setIsLoading(true);
        syncEBuscar();

        // Recarrega silenciosamente a cada 10 seg
        const tempoDeAtualizacao = setInterval(syncEBuscar, 10000);
        return () => clearInterval(tempoDeAtualizacao);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, endDate]);

    // Processar cálculos dos itens
    const dadosProcessados = useMemo(() => {
        return dados.map(item => {
            let tituloLimpo = item.titulo || '';
            // Puxa o cód interno oficial criado na nova coluna (fallback para extração do título ou sku do marketplace)
            let codInterno = item.cod_interno || item.sku;
            
            if (tituloLimpo && tituloLimpo.startsWith('[')) {
                const fechamento = tituloLimpo.indexOf(']');
                if (fechamento > 0) {
                    const extraido = tituloLimpo.substring(1, fechamento);
                    codInterno = item.cod_interno || extraido; // Usa a coluna se existir, senão usa o extraído
                    tituloLimpo = tituloLimpo.substring(fechamento + 1).trim();
                }
            }

            const taxaFixa = calcularTaxaFixa(item.origem, item.custo_adicional, item.quant_itens, item.custo_frete);
            
            // Corrige o bug do carrinho: usa o valor_total DO ITEM, e não do pedido inteiro
            const valorDeVenda = item.vlr_total || item.total_pedido; 
            
            const tarifaDeVenda = CalcularTarifaDeVenda(item.origem, valorDeVenda, item.comissao_sku);
            const custoProduto = CalcularCustoProduto(item.quant_itens, item.vlr_custo);
            const frete = CalcularFrete(item.vlr_frete_real, item.vlr_frete_comprador, item.origem, item.quant_itens);
            
            const descImposto = valorDeVenda * (imposto / 100);
            const descOperacional = valorDeVenda * (custoOperacional / 100);
            const lucro = CalcularTotal(valorDeVenda, taxaFixa, tarifaDeVenda, custoProduto, frete, imposto, custoOperacional);
            const margemLucro = CalcularMargemLucro(lucro, custoProduto);
            return { ...item, titulo: tituloLimpo, cod_interno: codInterno, valorDeVenda, lucro, margemLucro, custoProduto, taxaFixa, tarifaDeVenda, frete, descImposto, descOperacional };
        });
    }, [dados, imposto, custoOperacional]);

    const lucroLiquidoTotal = useMemo(() => {
        return dadosProcessados.reduce((acc, curr) => acc + curr.lucro, 0);
    }, [dadosProcessados]);

    const margensResumo = useMemo(() => {
        const resumo = { vermelho: 0, laranja: 0, amarelo: 0, verde: 0 };
        dadosProcessados.forEach(item => {
            const nivel = getMarginLevel(item.margemLucro);
            if (resumo[nivel] !== undefined) resumo[nivel]++;
        });
        return resumo;
    }, [dadosProcessados]);

    // Agrupamentos
    const agruparPor = (chave) => {
        const mapa = {};
        dadosProcessados.forEach(item => {
            const valRaw = item[chave] ? String(item[chave]) : 'Diversos';
            const val = valRaw.trim() !== '' ? valRaw.trim() : 'Diversos';
            if (!mapa[val]) {
                mapa[val] = { nome: val, faturamento: 0, lucro: 0, pedidos: new Set(), unidades: 0, skus: 0 };
            }
            mapa[val].faturamento += item.valorDeVenda;
            mapa[val].lucro += item.lucro;
            mapa[val].pedidos.add(item.pedido_id);
            mapa[val].unidades += item.quant_itens;
            mapa[val].skus += 1;
        });
        return Object.values(mapa).map(g => ({ ...g, pedidos: g.pedidos.size, margem: g.faturamento > 0 ? (g.lucro / g.faturamento * 100) : 0 })).sort((a,b) => b.lucro - a.lucro);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const marcasAgrupadas = useMemo(() => agruparPor('marca').sort((a,b) => b.margem - a.margem), [dadosProcessados]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const gruposAgrupados = useMemo(() => agruparPor('grupo').sort((a,b) => b.margem - a.margem), [dadosProcessados]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const fornecedoresAgrupados = useMemo(() => agruparPor('vendedor'), [dadosProcessados]);
    const produtosAgrupados = useMemo(() => {
        const mapa = {};
        dadosProcessados.forEach(item => {
            const val = item.cod_interno;
            if(!val) return;
            if (!mapa[val]) {
                mapa[val] = { 
                    nome: item.titulo, 
                    sku: val, 
                    origem: item.origem_nome + ' ' + item.vendedor, 
                    url_imagem: item.url_imagem,
                    faturamento: 0, lucro: 0, unidades: 0, pedidos: 0,
                    custoProduto: 0, taxaFixa: 0, tarifaDeVenda: 0, frete: 0,
                    descImposto: 0, descOperacional: 0
                };
            }
            mapa[val].faturamento += item.valorDeVenda;
            mapa[val].lucro += item.lucro;
            mapa[val].unidades += item.quant_itens;
            mapa[val].pedidos += 1;
            mapa[val].custoProduto += item.custoProduto;
            mapa[val].taxaFixa += item.taxaFixa;
            mapa[val].tarifaDeVenda += item.tarifaDeVenda;
            mapa[val].frete += item.frete;
            mapa[val].descImposto += item.descImposto;
            mapa[val].descOperacional += item.descOperacional;
        });
        return Object.values(mapa).map(p => ({
            ...p, 
            margem: p.custoProduto > 0 ? (p.lucro / p.custoProduto * 100) : 100 
        })).sort((a,b) => b.margem - a.margem);
    }, [dadosProcessados]);

    const sortRanking = (arr) => {
        const copy = [...arr];
        switch(ordenacao) {
            case 'pedidos': return copy.sort((a,b) => b.pedidos - a.pedidos);
            case 'lucro': return copy.sort((a,b) => b.lucro - a.lucro);
            case 'faturamento': return copy.sort((a,b) => b.faturamento - a.faturamento);
            case 'margem': return copy.sort((a,b) => b.margem - a.margem);
            default: return copy.sort((a,b) => b.pedidos - a.pedidos);
        }
    };

    const prejuizos = useMemo(() => dadosProcessados.filter(d => d.lucro <= 0).sort((a,b) => a.lucro - b.lucro), [dadosProcessados]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const contasAgrupadas = useMemo(() => agruparPor('origem_nome').sort((a,b) => b.faturamento - a.faturamento), [dadosProcessados]);

    const marcaTop = marcasAgrupadas.length > 0 ? marcasAgrupadas.sort((a,b) => b.faturamento - a.faturamento)[0] : null;
    const produtoMargemTop = produtosAgrupados.length > 0 ? produtosAgrupados[0] : null;

    const desempenhoDia = dadosOntem > 0 ? (((faturamentoDeHoje - dadosOntem) / dadosOntem) * 100) : 0;

    // Marketplace Data
    const mercadoLivre = fornecedoresAgrupados.find(f => f.nome === 'MERCADO LIVRE') || {pedidos: 0, faturamento: 0};
    const shopee = fornecedoresAgrupados.find(f => f.nome === 'SHOPEE') || {pedidos: 0, faturamento: 0};
    const magalu = fornecedoresAgrupados.find(f => f.nome === 'MAGAZINE LUIZA') || {pedidos: 0, faturamento: 0};
    const outrosFaturamento = fornecedoresAgrupados.filter(f => !['MERCADO LIVRE', 'SHOPEE', 'MAGAZINE LUIZA'].includes(f.nome)).reduce((sum, f) => sum + f.faturamento, 0);
    const outrosPedidos = fornecedoresAgrupados.filter(f => !['MERCADO LIVRE', 'SHOPEE', 'MAGAZINE LUIZA'].includes(f.nome)).reduce((sum, f) => sum + f.pedidos, 0);
    const totalMarketplacesFat = faturamentoDeHoje || 1;

    // Full data
    const fullData = useMemo(() => {
        const items = dadosProcessados.filter(d => d.full_status === 'TRUE');
        const porVendedor = {};
        const porConta = {};
        items.forEach(item => {
            const v = (item.vendedor || '').trim();
            if (!porVendedor[v]) porVendedor[v] = { nome: v, pedidos: new Set(), faturamento: 0 };
            porVendedor[v].pedidos.add(item.pedido_id);
            porVendedor[v].faturamento += item.valorDeVenda;
            const c = (item.origem_nome || '').trim();
            if (!porConta[c]) porConta[c] = { nome: c, vendedor: v, pedidos: new Set(), faturamento: 0, lucro: 0 };
            porConta[c].pedidos.add(item.pedido_id);
            porConta[c].faturamento += item.valorDeVenda;
            porConta[c].lucro += item.lucro;
        });
        const ml = porVendedor['MERCADO LIVRE'] || { pedidos: new Set() };
        const sh = porVendedor['SHOPEE'] || { pedidos: new Set() };
        const mg = porVendedor['MAGAZINE LUIZA'] || { pedidos: new Set() };
        const totalFull = new Set(items.map(i => i.pedido_id)).size;
        const contas = Object.values(porConta).map(c => ({ ...c, pedidos: c.pedidos.size })).sort((a,b) => b.pedidos - a.pedidos);
        return { ml: ml.pedidos.size, sh: sh.pedidos.size, mg: mg.pedidos.size, total: totalFull, contas, items };
    }, [dadosProcessados]);

    const rolarParaRanking = () => {
        const el = document.getElementById('mais-margem');
        if(el) el.scrollIntoView({behavior:'smooth'});
    };    return (
        <main className="phone">
            <div className="aura"></div>
            
            {isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', position: 'relative', zIndex: 10 }}>
                    <CircularProgress color="neutral" size="lg" variant="soft" />
                </div>
            ) : (
                <>
                    <header className="top">
                        <button className="iconbtn" onClick={() => {
                            const menu = document.getElementById('nav-menu');
                            if(menu) menu.classList.toggle('open');
                        }}>☰</button>
                        <div className="title">
                            <h1>Platinum OS</h1>
                            <p className="live">vendas, lucro e margem ao vivo</p>
                        </div>
                        <button className="iconbtn" onClick={() => { syncEBuscar(); }}>↻</button>
                    </header>
                    <nav id="nav-menu" className="nav-menu">
                        <button onClick={() => { document.getElementById('nav-menu').classList.remove('open'); window.scrollTo({top:0,behavior:'smooth'}); }}>🏠 Início</button>
                        <button onClick={() => { document.getElementById('nav-menu').classList.remove('open'); const el = document.getElementById('mais-margem'); if(el) el.scrollIntoView({behavior:'smooth'}); }}>💎 Ranking</button>
                        <button onClick={() => { document.getElementById('nav-menu').classList.remove('open'); const el = document.getElementById('prejuizo-detail'); if(el) el.scrollIntoView({behavior:'smooth'}); }}>⚠️ Prejuízos</button>
                        <button onClick={() => { document.getElementById('nav-menu').classList.remove('open'); const el = document.getElementById('contas-detail'); if(el) el.scrollIntoView({behavior:'smooth'}); }}>🛒 Contas</button>
                        <button onClick={() => { document.getElementById('nav-menu').classList.remove('open'); const el = document.getElementById('full-detail'); if(el) el.scrollIntoView({behavior:'smooth'}); }}>📦 Vendas Full</button>
                        <button onClick={() => { document.getElementById('nav-menu').classList.remove('open'); setAbaPrincipal('pedidos'); setTimeout(() => window.scrollTo({top:0,behavior:'smooth'}),100); }}>📋 Ver Pedidos</button>
                    </nav>

                    <nav className="segment">
                        <button className={filtroAtivo === 'Hoje' ? 'active' : ''} onClick={() => setDateRange('Hoje')}>Hoje</button>
                        <button className={filtroAtivo === 'Ontem' ? 'active' : ''} onClick={() => setDateRange('Ontem')}>Ontem</button>
                        <button className={filtroAtivo === '7 dias' ? 'active' : ''} onClick={() => setDateRange('7 dias')}>7 dias</button>
                        <button className={filtroAtivo === '30 dias' ? 'active' : ''} onClick={() => setDateRange('30 dias')}>30 dias</button>
                    </nav>

                    <div className="date">
                        <button className="range">📅 {format(startDate, 'dd/MM/yyyy')} até {format(endDate, 'dd/MM/yyyy')}</button>
                        <button onClick={syncEBuscar}>↻</button>
                    </div>

                    {abaPrincipal === 'home' && (
                        <div className="page-content">
                            <section className="hero">
                                <div className="label">vendas do período</div>
                                <h2>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(faturamentoDeHoje)}</h2>
                                <div className="sub">
                                    {desempenhoDia > 0 ? <span className="orange">↑ {desempenhoDia.toFixed(1)}% vs ontem</span> : <span className="green">↓ {Math.abs(desempenhoDia).toFixed(1)}% vs ontem</span>} · {numeroDePedidosUnicos} pedidos
                                </div>
                                <div style={{fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                                    <span style={{display: 'inline-block', width: '4px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%'}}></span>
                                    Ontem fechou em R$ {dadosOntem.toFixed(0)} com {pedidosOntem} pedidos
                                </div>

                                <div className="hero-row">
                                    <div className="mini"><span>Lucro</span><b>R$ {lucroLiquidoTotal.toFixed(0)}</b></div>
                                    <div className="mini"><span>Margem</span><b className="green">{faturamentoDeHoje > 0 ? (lucroLiquidoTotal / faturamentoDeHoje * 100).toFixed(1) : 0}%</b></div>
                                    <div className="mini"><span>Ticket</span><b>R$ {numeroDePedidosUnicos > 0 ? (faturamentoDeHoje / numeroDePedidosUnicos).toFixed(0) : 0}</b></div>
                                </div>

                                <div style={{textAlign: 'center', marginTop: '10px'}}>
                                    <button onClick={() => setMostrarConfig(!mostrarConfig)} style={{background: 'transparent', border: 'none', color: 'var(--soft)', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', margin: '0 auto'}}>
                                        ⚙️ Configurar Custos {mostrarConfig ? '▲' : '▼'}
                                    </button>
                                </div>
                                {mostrarConfig && (
                                    <div style={{background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '12px', marginTop: '10px', display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center'}}>
                                        <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                                            <label style={{fontSize: '11px', color: 'var(--soft)'}}>Imposto (%)</label>
                                            <input type="number" step="0.1" value={imposto} onChange={e => setImposto(parseFloat(e.target.value) || 0)} style={{width: '60px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '6px', padding: '4px', textAlign: 'center'}} />
                                        </div>
                                        <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                                            <label style={{fontSize: '11px', color: 'var(--soft)'}}>Operacional (%)</label>
                                            <input type="number" step="0.1" value={custoOperacional} onChange={e => setCustoOperacional(parseFloat(e.target.value) || 0)} style={{width: '60px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '6px', padding: '4px', textAlign: 'center'}} />
                                        </div>
                                    </div>
                                )}

                                <svg className="spark" viewBox="0 0 320 70" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
                                            <stop stopColor="#ff6a1a" stopOpacity=".65"/>
                                            <stop offset="1" stopColor="#ff6a1a" stopOpacity="0"/>
                                        </linearGradient>
                                    </defs>
                                    <path d="M0,55 C30,47 43,20 74,28 C105,37 112,49 145,35 C174,22 190,20 218,33 C246,45 265,30 287,20 C302,13 312,16 320,10 L320,70 L0,70 Z" fill="url(#area)"/>
                                    <path d="M0,55 C30,47 43,20 74,28 C105,37 112,49 145,35 C174,22 190,20 218,33 C246,45 265,30 287,20 C302,13 312,16 320,10" fill="none" stroke="#ff8a3d" strokeWidth="4"/>
                                    <path d="M0,62 C40,55 58,48 87,54 C119,62 134,48 160,51 C190,55 205,63 231,55 C260,47 286,55 320,44" fill="none" stroke="#15d8ff" strokeWidth="2" opacity=".8"/>
                                </svg>

                                <div className="cta">
                                    <button className="main" onClick={() => setAbaPrincipal('pedidos')}>Ver pedidos ›</button>
                                </div>
                            </section>

                            <div className="section">
                                <h2>O que consultar agora?</h2>
                            </div>

                            <section className="quick-grid">
                                <article className="tile cyan" onClick={() => {rolarParaRanking(); setAbaRanking('produtos');}}>
                                    <span className="badge">ranking</span>
                                    <span className="ico">🔥</span>
                                    <h3>Produtos mais vendidos</h3>
                                    <div className="num">{produtosAgrupados.length}</div>
                                    <p>ranking com custo, lucro e margem</p>
                                </article>

                                <article className="tile" onClick={() => {rolarParaRanking(); setAbaRanking('marcas');}}>
                                    <span className="badge">top</span>
                                    <span className="ico">🏷️</span>
                                    <h3>Marca / Fornecedor</h3>
                                    <div className="num" style={{fontSize:'20px'}}>{marcaTop ? (marcaTop.nome.length > 12 ? marcaTop.nome.substring(0,12)+'...' : marcaTop.nome) : '-'}</div>
                                    <p>R$ {marcaTop ? marcaTop.faturamento.toFixed(0) : 0} · {marcaTop ? marcaTop.unidades : 0} unid.</p>
                                </article>

                                <article className="tile purple" onClick={() => { const el = document.getElementById('contas-detail'); if(el) el.scrollIntoView({behavior:'smooth'}); }}>
                                    <span className="badge">contas</span>
                                    <span className="ico">🛒</span>
                                    <h3>Marketplaces</h3>
                                    <div className="num">ML {mercadoLivre.pedidos}</div>
                                    <p>abre vendas por canal e conta</p>
                                </article>

                                <article className="tile green" onClick={() => { setAbaPrincipal('drilldown_grupos'); setTimeout(() => window.scrollTo({top:0,behavior:'smooth'}),100); }}>
                                    <span className="badge">análise</span>
                                    <span className="ico">📊</span>
                                    <h3>Grupos / Categorias</h3>
                                    <div className="num" style={{fontSize:'20px'}}>{gruposAgrupados.length} grupos</div>
                                    <p>drilldown: grupo {'>'} marca</p>
                                </article>

                                <article className="tile red" onClick={() => { const el = document.getElementById('prejuizo-detail'); if(el) el.scrollIntoView({behavior:'smooth'}); }}>
                                    <span className="badge">urgente</span>
                                    <span className="ico">⚠️</span>
                                    <h3>Pedidos com prejuízo</h3>
                                    <div className="num">{prejuizos.length}</div>
                                    <p>corrigir preço, frete ou taxa</p>
                                </article>

                                <article className="tile cyan" onClick={() => { const el = document.getElementById('full-detail'); if(el) el.scrollIntoView({behavior:'smooth'}); }}>
                                    <span className="badge">fulfillment</span>
                                    <span className="ico">📦</span>
                                    <h3>Vendas Full</h3>
                                    <div className="num">{fullData.total}</div>
                                    <p style={{fontSize:'11px',lineHeight:'1.3',marginTop:'6px'}}>🟡 ML {fullData.ml} · 🟠 Shopee {fullData.sh} · 🔵 Magalu {fullData.mg}</p>
                                </article>
                            </section>

                            <div className="section" id="mais-margem">
                                <h2>💎 Mais margem hoje</h2>
                            </div>
                            
                            <section className="infocard">
                                <div className="info-head">
                                    <h2>Ranking inteligente</h2>
                                </div>

                                <div className="switches">
                                    <button className={abaRanking === 'produtos' ? 'active' : ''} onClick={() => setAbaRanking('produtos')}>Produtos</button>
                                    <button className={abaRanking === 'marcas' ? 'active' : ''} onClick={() => setAbaRanking('marcas')}>Marcas / Fornec.</button>
                                    <button className={abaRanking === 'grupos' ? 'active' : ''} onClick={() => setAbaRanking('grupos')}>Grupos</button>
                                </div>
                                <div className="switches sort-bar">
                                    <button className={ordenacao === 'pedidos' ? 'active' : ''} onClick={() => setOrdenacao('pedidos')}>📋 Pedidos</button>
                                    <button className={ordenacao === 'faturamento' ? 'active' : ''} onClick={() => setOrdenacao('faturamento')}>💰 Faturou</button>
                                    <button className={ordenacao === 'lucro' ? 'active' : ''} onClick={() => setOrdenacao('lucro')}>💚 Lucro</button>
                                    <button className={ordenacao === 'margem' ? 'active' : ''} onClick={() => setOrdenacao('margem')}>📊 Margem</button>
                                </div>

                                <div className={`rank-list ${abaRanking === 'produtos' ? 'active' : ''}`}>
                                    {sortRanking(produtosAgrupados).slice(0, rankLimit).map((prod, i) => (
                                        <article className="rank" key={i} style={{cursor:'pointer'}} onClick={() => { setFiltroRank({tipo:'sku',valor:prod.sku}); setTimeout(() => { const el = document.getElementById('filtro-rank-detail'); if(el) el.scrollIntoView({behavior:'smooth'}); },100); }}>
                                            <div className="rank-photo-center">
                                                {prod.url_imagem && prod.url_imagem.trim() !== 'None' ? (
                                                    <img src={prod.url_imagem.startsWith('http') ? prod.url_imagem : 'https://' + prod.url_imagem} alt="" loading="lazy" />
                                                ) : <span>📦</span>}
                                            </div>
                                            <div className="rank-top">
                                                <div className="medal">{i + 1}</div>
                                                <div className="rname">
                                                    <h3>{prod.nome || 'Produto Desconhecido'}</h3>
                                                    <p>SKU {prod.sku}</p>
                                                    <p className="rank-canal">{prod.origem.trim()}</p>
                                                </div>
                                                <div className="rmargin">{isFinite(prod.margem) ? prod.margem.toFixed(1) : 0}%</div>
                                            </div>
                                            <div className="metrics breakdown">
                                                <div><span>💰 Venda</span><b>R$ {prod.faturamento.toFixed(2)}</b></div>
                                                <div><span>📦 Custo</span><b style={{color:'#ff6b6b'}}>-R$ {prod.custoProduto.toFixed(2)}</b></div>
                                                <div><span>🏷️ Taxa</span><b style={{color:'#ff6b6b'}}>-R$ {prod.taxaFixa.toFixed(2)}</b></div>
                                                <div><span>📊 Comissão</span><b style={{color:'#ff6b6b'}}>-R$ {prod.tarifaDeVenda.toFixed(2)}</b></div>
                                                <div><span>🚚 Frete</span><b style={{color:'#ff6b6b'}}>-R$ {prod.frete.toFixed(2)}</b></div>
                                                <div className="lucro-final"><span>✅ Lucro</span><b className={prod.lucro > 0 ? 'green' : 'red'}>R$ {prod.lucro.toFixed(2)}</b></div>
                                            </div>
                                            <div className="metrics">
                                                <div><span>Qtd</span><b>{prod.unidades} un.</b></div>
                                                <div><span>Pedidos</span><b>{prod.pedidos}</b></div>
                                            </div>
                                        </article>
                                    ))}
                                    {rankLimit < produtosAgrupados.length && (
                                        <button className="load-more" onClick={() => setRankLimit(prev => prev + 15)}>Carregar mais ({produtosAgrupados.length - rankLimit} restantes)</button>
                                    )}
                                </div>

                                <div className={`rank-list ${abaRanking === 'marcas' ? 'active' : ''}`}>
                                    {sortRanking(marcasAgrupadas).slice(0, 10).map((marca, i) => (
                                        <article className="rank" key={i} style={{cursor:'pointer'}} onClick={() => { setFiltroRank({tipo:'marca',valor:marca.nome}); setTimeout(() => { const el = document.getElementById('filtro-rank-detail'); if(el) el.scrollIntoView({behavior:'smooth'}); },100); }}>
                                            <div className="rank-top">
                                                <div className="medal">{i + 1}</div>
                                                <div className="rname">
                                                    <h3>{marca.nome}</h3>
                                                    <p>{marca.skus} SKUs vendidos</p>
                                                </div>
                                                <div className="rmargin">{isFinite(marca.margem) ? marca.margem.toFixed(1) : 0}%</div>
                                            </div>
                                            <div className="metrics">
                                                <div><span>Faturou</span><b>R$ {marca.faturamento.toFixed(0)}</b></div>
                                                <div><span>Lucro</span><b className="green">R$ {marca.lucro.toFixed(0)}</b></div>
                                                <div><span>Pedidos</span><b>{marca.pedidos}</b></div>
                                            </div>
                                        </article>
                                    ))}
                                </div>

                                <div className={`rank-list ${abaRanking === 'grupos' ? 'active' : ''}`}>
                                    {sortRanking(gruposAgrupados).slice(0, 10).map((grupo, i) => (
                                        <article className="rank" key={i} style={{cursor:'pointer'}} onClick={() => { setFiltroRank({tipo:'grupo',valor:grupo.nome}); setTimeout(() => { const el = document.getElementById('filtro-rank-detail'); if(el) el.scrollIntoView({behavior:'smooth'}); },100); }}>
                                            <div className="rank-top">
                                                <div className="medal">{i + 1}</div>
                                                <div className="rname">
                                                    <h3>{grupo.nome}</h3>
                                                    <p>{grupo.skus} SKUs vendidos</p>
                                                </div>
                                                <div className="rmargin">{isFinite(grupo.margem) ? grupo.margem.toFixed(1) : 0}%</div>
                                            </div>
                                            <div className="metrics">
                                                <div><span>Faturou</span><b>R$ {grupo.faturamento.toFixed(0)}</b></div>
                                                <div><span>Lucro</span><b className="green">R$ {grupo.lucro.toFixed(0)}</b></div>
                                                <div><span>Pedidos</span><b>{grupo.pedidos}</b></div>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            </section>

                            {filtroRank && (() => {
                                if (filtroRank.tipo === 'sku' || filtroRank.tipo === 'margem') {
                                    const pedidosFiltrados = dadosProcessados.filter(item => {
                                        if (filtroRank.tipo === 'sku') return item.cod_interno === filtroRank.valor;
                                        if (filtroRank.tipo === 'margem') return getMarginLevel(item.margemLucro) === filtroRank.valor;
                                        return false;
                                    });
                                    return (
                                        <>
                                            <div className="section" id="filtro-rank-detail" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                                <div>
                                                    <h2>📋 Pedidos: {filtroRank.titulo || filtroRank.valor.trim()} ({pedidosFiltrados.length})</h2>
                                                </div>
                                                <div style={{display: 'flex', gap: '8px'}}>
                                                    {filtroRank.tipo === 'margem' && (
                                                        <button onClick={() => exportToXLSX(pedidosFiltrados)} style={{background: 'rgba(21,216,255,0.1)', color: 'var(--cyan)', border: '1px solid var(--cyan)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer'}}>📥 Baixar Excel (CSV)</button>
                                                    )}
                                                    <button onClick={() => setFiltroRank(null)} style={{background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer'}}>✕ Fechar</button>
                                                </div>
                                            </div>
                                            <div className="orders-list">
                                                {pedidosFiltrados.map((item, index) => {
                                                    const v = (item.vendedor || '').trim();
                                                    const borderClass = v === 'MERCADO LIVRE' ? 'borda-ml' : v === 'SHOPEE' ? 'borda-sh' : v === 'MAGAZINE LUIZA' ? 'borda-mg' : v === 'TIKTOK' ? 'borda-tk' : 'borda-other';
                                                    return (
                                                        <article className={`product-row ${borderClass}`} key={index}>
                                                            <div className="product-photo">
                                                                {item.url_imagem && item.url_imagem.trim() !== 'None' ? (
                                                                    <img src={item.url_imagem.startsWith('http') ? item.url_imagem : 'https://' + item.url_imagem} alt="" style={{width:'100%', height:'100%', objectFit:'contain', borderRadius:'22px'}} />
                                                                ) : '📦'}
                                                            </div>
                                                            <div className="product-info">
                                                                <h3>{item.titulo || 'Produto'}</h3>
                                                                <div className="tags">
                                                                    <span className="tag quant">{item.quant_itens} UND.</span>
                                                                    <span className="tag origin">{item.origem_nome ? item.origem_nome.trim() : item.vendedor}</span>
                                                                    <span className="tag pid">ERP: {item.pedido_id}</span>{item.integracao && <span className="tag pid" style={{background: 'rgba(255,255,255,0.1)'}}>ID: {item.integracao}</span>}
                                                                </div>
                                                                <p>Custo R$ {item.custoProduto.toFixed(2)} · Frete R$ {item.frete.toFixed(2)} · Taxa R$ {item.taxaFixa.toFixed(2)} · Comissão R$ {item.tarifaDevenda.toFixed(2)}</p>
                                                                <p style={{marginTop: '2px', color: '#8b8e96', fontSize: '11px'}}>SKU: {item.cod_interno} | Ref: {item.sku} · Grupo: {item.grupo || 'S/ Grupo'}</p>
                                                            </div>
                                                            <div className="product-profit">
                                                                <span className="pedido-total">R$ {item.total_pedido.toFixed(2)}</span>
                                                                <b style={{color: item.lucro > 0 ? 'var(--green)' : 'var(--red)'}}>R$ {item.lucro.toFixed(2)}</b>
                                                                <span style={{color: getMarginColor(item.margemLucro)}}>{isFinite(item.margemLucro) ? item.margemLucro.toFixed(1) : 0}%</span>
                                                            </div>
                                                        </article>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    );
                                } else {
                                    // Para Marca, Grupo ou Conta: Agrupar por produto
                                    const pedidosFiltrados = dadosProcessados.filter(item => {
                                        if (filtroRank.tipo === 'marca') return (item.marca || '').trim() === filtroRank.valor.trim();
                                        if (filtroRank.tipo === 'grupo') return (item.grupo || '').trim() === filtroRank.valor.trim();
                                        if (filtroRank.tipo === 'conta') return (item.origem_nome || '').trim() === filtroRank.valor.trim();
                                        return false;
                                    });

                                    const mapa = {};
                                    pedidosFiltrados.forEach(item => {
                                        const val = item.cod_interno;
                                        if(!val) return;
                                        if (!mapa[val]) {
                                            mapa[val] = { 
                                                nome: item.titulo, 
                                                sku: val, 
                                                origem: item.origem_nome + ' ' + item.vendedor, 
                                                url_imagem: item.url_imagem,
                                                faturamento: 0, lucro: 0, unidades: 0, pedidos: 0,
                                                custoProduto: 0, taxaFixa: 0, tarifaDeVenda: 0, frete: 0
                                            };
                                        }
                                        mapa[val].faturamento += item.valorDeVenda;
                                        mapa[val].lucro += item.lucro;
                                        mapa[val].unidades += item.quant_itens;
                                        mapa[val].pedidos += 1;
                                        mapa[val].custoProduto += item.custoProduto;
                                        mapa[val].taxaFixa += item.taxaFixa;
                                        mapa[val].tarifaDeVenda += item.tarifaDeVenda;
                                        mapa[val].frete += item.frete;
                                    });

                                    const produtosDaCategoria = Object.values(mapa).map(p => ({
                                        ...p, 
                                        margem: p.custoProduto > 0 ? (p.lucro / p.custoProduto * 100) : 100 
                                    }));

                                    return (
                                        <>
                                            <div className="section" id="filtro-rank-detail">
                                                <h2>📦 Top Produtos: {filtroRank.valor.trim()}</h2>
                                                <button onClick={() => setFiltroRank(null)}>✕ Fechar</button>
                                            </div>
                                            <div className="rank-list active" style={{padding: '0 10px'}}>
                                                {sortRanking(produtosDaCategoria).map((prod, i) => (
                                                    <article className="rank" key={i} style={{cursor:'pointer'}} onClick={() => { setFiltroRank({tipo:'sku',valor:prod.sku}); setTimeout(() => { const el = document.getElementById('filtro-rank-detail'); if(el) el.scrollIntoView({behavior:'smooth'}); },100); }}>
                                                        <div className="rank-photo-center">
                                                            {prod.url_imagem && prod.url_imagem.trim() !== 'None' ? (
                                                                <img src={prod.url_imagem.startsWith('http') ? prod.url_imagem : 'https://' + prod.url_imagem} alt="" loading="lazy" />
                                                            ) : <span>📦</span>}
                                                        </div>
                                                        <div className="rank-top">
                                                            <div className="medal">{i + 1}</div>
                                                            <div className="rname">
                                                                <h3>{prod.nome || 'Produto Desconhecido'}</h3>
                                                                <p>SKU {prod.sku}</p>
                                                                <p className="rank-canal">{prod.origem.trim()}</p>
                                                            </div>
                                                            <div className="rmargin">{isFinite(prod.margem) ? prod.margem.toFixed(1) : 0}%</div>
                                                        </div>
                                                        <div className="metrics breakdown">
                                                            <div><span>💰 Venda</span><b>R$ {prod.faturamento.toFixed(2)}</b></div>
                                                            <div><span>📦 Custo</span><b style={{color:'#ff6b6b'}}>-R$ {prod.custoProduto.toFixed(2)}</b></div>
                                                            <div><span>🏷️ Taxa</span><b style={{color:'#ff6b6b'}}>-R$ {prod.taxaFixa.toFixed(2)}</b></div>
                                                            <div><span>📊 Comissão</span><b style={{color:'#ff6b6b'}}>-R$ {prod.tarifaDeVenda.toFixed(2)}</b></div>
                                                            <div><span>🚚 Frete</span><b style={{color:'#ff6b6b'}}>-R$ {prod.frete.toFixed(2)}</b></div>
                                                            <div className="lucro-final"><span>✅ Lucro</span><b className={prod.lucro > 0 ? 'green' : 'red'}>R$ {prod.lucro.toFixed(2)}</b></div>
                                                        </div>
                                                        <div className="metrics">
                                                            <div><span>Qtd</span><b>{prod.unidades} un.</b></div>
                                                            <div><span>Pedidos</span><b>{prod.pedidos}</b></div>
                                                        </div>
                                                    </article>
                                                ))}
                                            </div>
                                        </>
                                    );
                                }
                            })()}

                            <div className="section">
                                <h2>Marketplaces</h2>
                            </div>
                            
                            <section className="infocard market">
                                <div className="market-row">
                                    <b>Mercado Livre</b>
                                    <div className="track"><i className="mlbar" style={{width: `${(mercadoLivre.faturamento/totalMarketplacesFat)*100}%`}}></i></div>
                                    <span>{mercadoLivre.pedidos}</span>
                                </div>
                                <div className="market-row">
                                    <b>Shopee</b>
                                    <div className="track"><i className="shopeebar" style={{width: `${(shopee.faturamento/totalMarketplacesFat)*100}%`}}></i></div>
                                    <span>{shopee.pedidos}</span>
                                </div>
                                <div className="market-row">
                                    <b>Magalu</b>
                                    <div className="track"><i className="magalubar" style={{width: `${(magalu.faturamento/totalMarketplacesFat)*100}%`}}></i></div>
                                    <span>{magalu.pedidos}</span>
                                </div>
                                <div className="market-row">
                                    <b>Outros</b>
                                    <div className="track"><i className="outrosbar" style={{width: `${(outrosFaturamento/totalMarketplacesFat)*100}%`}}></i></div>
                                    <span>{outrosPedidos}</span>
                                </div>
                            </section>

                            {prejuizos.length > 0 && (
                                <>
                                    <div className="section" id="prejuizo-detail">
                                        <h2>⚠️ Pedidos com Prejuízo ({prejuizos.length})</h2>
                                    </div>
                                    <section className="infocard">
                                        <div className="orders-list">
                                            {prejuizos.map((item, index) => (
                                                <article className="product-row prejuizo-row" key={index}>
                                                    <div className="product-photo">
                                                        {item.url_imagem && item.url_imagem.trim() !== 'None' ? (
                                                            <img src={item.url_imagem.startsWith('http') ? item.url_imagem : 'https://' + item.url_imagem} alt="" style={{width:'100%', height:'100%', objectFit:'contain', borderRadius:'22px'}} />
                                                        ) : '📦'}
                                                    </div>
                                                    <div className="product-info">
                                                        <h3>{item.titulo || 'Produto não identificado'}</h3>
                                                        <div className="tags">
                                                            <span className="tag origin">{item.origem_nome ? item.origem_nome.trim() : item.vendedor}</span>
                                                            <span className="tag pid">ERP: {item.pedido_id}</span>{item.integracao && <span className="tag pid" style={{background: 'rgba(255,255,255,0.1)'}}>ID: {item.integracao}</span>}
                                                        </div>
                                                        <p style={{marginTop: '4px', marginBottom: '4px', color: '#8b8e96', fontSize: '11px'}}>Fabricante: {item.marca} | SKU: {item.cod_interno} | Ref: {item.sku}</p>
                                                        <div className="breakdown-mini">
                                                            <span>Venda R$ {item.valorDeVenda.toFixed(2)}</span>
                                                            <span>Custo R$ {item.custoProduto.toFixed(2)}</span>
                                                            <span>Taxa R$ {item.taxaFixa.toFixed(2)}</span>
                                                            <span>Comissão R$ {item.tarifaDeVenda.toFixed(2)}</span>
                                                            <span>Frete R$ {item.frete.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="product-profit">
                                                        <b style={{color: 'var(--red)'}}>R$ {item.lucro.toFixed(2)}</b>
                                                        <span style={{color: 'var(--red)'}}>{isFinite(item.margemLucro) ? item.margemLucro.toFixed(1) : 0}%</span>
                                                    </div>
                                                </article>
                                            ))}
                                        </div>
                                    </section>
                                </>
                            )}

                            <div className="section" id="contas-detail">
                                <h2>🛒 Vendas por Conta ({contasAgrupadas.length})</h2>
                            </div>
                            <section className="infocard">
                                {contasAgrupadas.map((conta, i) => (
                                    <div className="conta-row" key={i} style={{cursor:'pointer'}} onClick={() => { setFiltroRank({tipo:'conta',valor:conta.nome ? conta.nome.trim() : ''}); setTimeout(() => { const el = document.getElementById('filtro-rank-detail'); if(el) el.scrollIntoView({behavior:'smooth'}); },100); }}>
                                        <div className="conta-pos">{i + 1}</div>
                                        <div className="conta-info">
                                            <b>{conta.nome ? conta.nome.trim() : 'Outros'}</b>
                                            <span>{conta.pedidos} pedidos · {conta.unidades} un.</span>
                                        </div>
                                        <div className="conta-values">
                                            <b>R$ {conta.faturamento.toFixed(0)}</b>
                                            <span className={conta.lucro > 0 ? 'green' : 'red'}>Lucro R$ {conta.lucro.toFixed(0)}</span>
                                        </div>
                                    </div>
                                ))}
                            </section>

                            <div className="section" id="full-detail">
                                <h2>📦 Vendas Full ({fullData.total})</h2>
                            </div>
                            <section className="infocard">
                                <div className="full-summary">
                                    <div className="full-chip ml">🟡 ML <b>{fullData.ml}</b></div>
                                    <div className="full-chip sh">🟠 Shopee <b>{fullData.sh}</b></div>
                                    <div className="full-chip mg">🔵 Magalu <b>{fullData.mg}</b></div>
                                </div>
                                <h4 style={{margin:'16px 0 10px',fontSize:'14px',color:'var(--soft)'}}>Por conta</h4>
                                {fullData.contas.map((conta, i) => (
                                    <div className="conta-row" key={i} style={{cursor:'pointer'}} onClick={() => { setFiltroRank({tipo:'conta',valor:conta.nome}); setTimeout(() => { const el = document.getElementById('filtro-rank-detail'); if(el) el.scrollIntoView({behavior:'smooth'}); },100); }}>
                                        <div className="conta-pos">{i + 1}</div>
                                        <div className="conta-info">
                                            <b>{conta.nome}</b>
                                            <span>{conta.vendedor.trim()}</span>
                                        </div>
                                        <div className="conta-values">
                                            <b>{conta.pedidos} ped.</b>
                                            <span>R$ {conta.faturamento.toFixed(0)}</span>
                                        </div>
                                    </div>
                                ))}
                            </section>
                        </div>
                    )}

                    {abaPrincipal === 'drilldown_grupos' && (
                        <div className="page-content" style={{padding: '20px'}}>
                            <div className="infocard" style={{minHeight: '400px', display: 'flex', flexDirection: 'column'}}>
                                <div className="header" style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px'}}>
                                    <h2 style={{margin:0, fontSize:'18px', display:'flex', alignItems:'center', gap:'8px'}}>
                                        {drillLevel === 1 ? '📊 Análise por Grupo' : drillLevel === 2 ? '🏷️ Top Fabricantes' : '💎 Top Produtos'}
                                    </h2>
                                    {drillLevel > 1 && (
                                        <button style={{background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.2)', color:'white', borderRadius:'12px', padding:'6px 12px', fontSize:'12px', fontWeight:'bold', cursor:'pointer'}} 
                                                onClick={() => {
                                                    if(drillLevel === 3) { setDrillLevel(2); setDrillMarca(''); }
                                                    else if(drillLevel === 2) { setDrillLevel(1); setDrillGrupo(''); }
                                                }}>⬅ Voltar</button>
                                    )}
                                </div>
                                {drillLevel > 1 && (
                                    <div style={{fontSize:'11px', color:'var(--cyan)', marginBottom:'12px'}}>
                                        Grupos {drillLevel >= 2 ? `> ${drillGrupo}` : ''} {drillLevel >= 3 ? `> ${drillMarca}` : ''}
                                    </div>
                                )}

                                <div className="list-container" style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                                    {/* NIVEL 1 */}
                                    {drillLevel === 1 && gruposAgrupados.map((grupo, i) => {
                                        const perc = gruposAgrupados[0]?.faturamento > 0 ? (grupo.faturamento / gruposAgrupados[0].faturamento) * 100 : 0;
                                        const custosTotais = grupo.faturamento - grupo.lucro;
                                        return (
                                            <div key={i} className="row-item drilldown-row" style={{background:'rgba(0,0,0,.3)', border:'1px solid rgba(255,255,255,.08)', borderRadius:'16px', padding:'12px 16px', cursor:'pointer', position:'relative', overflow:'hidden', display:'flex', justifyContent:'space-between', alignItems:'center'}} onClick={() => { setDrillGrupo(grupo.nome); setDrillLevel(2); }}>
                                                <div style={{position:'absolute', left:0, top:0, bottom:0, width:`${perc}%`, background:'linear-gradient(90deg, rgba(21, 216, 255, 0.2), transparent)', borderRadius:'16px', zIndex:0}}></div>
                                                <div style={{position:'relative', zIndex:1, flex:1, display:'flex', alignItems:'center', gap:'12px'}}>
                                                    <div style={{width:'28px', height:'28px', borderRadius:'8px', background:'rgba(255,255,255,.1)', display:'grid', placeItems:'center', fontWeight:'bold', fontSize:'12px'}}>{i+1}</div>
                                                    <div>
                                                        <h3 style={{margin:0, fontSize:'14px'}}>{grupo.nome}</h3>
                                                        <p style={{margin:'4px 0 0', fontSize:'11px', color:'var(--soft)'}}>{grupo.skus} SKUs ativos</p>
                                                    </div>
                                                </div>
                                                <div style={{position:'relative', zIndex:1, textAlign:'right'}}>
                                                    <b style={{display:'block', fontSize:'14px'}}>R$ {grupo.faturamento.toFixed(0)}</b>
                                                    <span style={{fontSize:'11px', color: grupo.lucro > 0 ? 'var(--green)' : 'var(--red)'}}>Lucro R$ {grupo.lucro.toFixed(0)}</span>
                                                    <div style={{fontSize:'10px', color:'var(--soft)', marginTop:'2px'}}>Custos: R$ {custosTotais.toFixed(0)}</div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* NIVEL 2 */}
                                    {drillLevel === 2 && (() => {
                                        const itemsFiltrados = dadosProcessados.filter(d => (d.grupo || 'Diversos').trim() === drillGrupo);
                                        const mapa = {};
                                        itemsFiltrados.forEach(item => {
                                            const valRaw = item.marca ? String(item.marca) : 'Diversos';
                                            const val = valRaw.trim() !== '' ? valRaw.trim() : 'Diversos';
                                            if (!mapa[val]) mapa[val] = { nome: val, faturamento: 0, lucro: 0, skus: new Set() };
                                            mapa[val].faturamento += item.valorDeVenda;
                                            mapa[val].lucro += item.lucro;
                                            mapa[val].skus.add(item.cod_interno);
                                        });
                                        const marcasList = Object.values(mapa).sort((a,b) => b.faturamento - a.faturamento);
                                        const maxFat = marcasList[0]?.faturamento || 1;

                                        return marcasList.map((marca, i) => {
                                            const perc = (marca.faturamento / maxFat) * 100;
                                            const custosTotais = marca.faturamento - marca.lucro;
                                            return (
                                                <div key={i} className="row-item drilldown-row" style={{background:'rgba(0,0,0,.3)', border:'1px solid rgba(255,255,255,.08)', borderRadius:'16px', padding:'12px 16px', cursor:'pointer', position:'relative', overflow:'hidden', display:'flex', justifyContent:'space-between', alignItems:'center'}} onClick={() => { setDrillMarca(marca.nome); setDrillLevel(3); }}>
                                                    <div style={{position:'absolute', left:0, top:0, bottom:0, width:`${perc}%`, background:'linear-gradient(90deg, rgba(255, 106, 26, 0.2), transparent)', borderRadius:'16px', zIndex:0}}></div>
                                                    <div style={{position:'relative', zIndex:1, flex:1, display:'flex', alignItems:'center', gap:'12px'}}>
                                                        <div style={{width:'28px', height:'28px', borderRadius:'8px', background:'rgba(255,255,255,.1)', display:'grid', placeItems:'center', fontWeight:'bold', fontSize:'12px'}}>{i+1}</div>
                                                        <div>
                                                            <h3 style={{margin:0, fontSize:'14px'}}>{marca.nome}</h3>
                                                            <p style={{margin:'4px 0 0', fontSize:'11px', color:'var(--soft)'}}>{marca.skus.size} produtos</p>
                                                        </div>
                                                    </div>
                                                    <div style={{position:'relative', zIndex:1, textAlign:'right'}}>
                                                        <b style={{display:'block', fontSize:'14px'}}>R$ {marca.faturamento.toFixed(0)}</b>
                                                        <span style={{fontSize:'11px', color: marca.lucro > 0 ? 'var(--green)' : 'var(--red)'}}>Lucro R$ {marca.lucro.toFixed(0)}</span>
                                                        <div style={{fontSize:'10px', color:'var(--soft)', marginTop:'2px'}}>Custos: R$ {custosTotais.toFixed(0)}</div>
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}

                                    {/* NIVEL 3 */}
                                    {drillLevel === 3 && (() => {
                                        const itemsFiltrados = dadosProcessados.filter(d => (d.grupo || 'Diversos').trim() === drillGrupo && (d.marca || 'Diversos').trim() === drillMarca);
                                        const mapa = {};
                                        itemsFiltrados.forEach(item => {
                                            const val = item.cod_interno || 'S/SKU';
                                            if (!mapa[val]) mapa[val] = { sku: val, titulo: item.titulo, url_imagem: item.url_imagem, faturamento: 0, lucro: 0, unidades: 0 };
                                            mapa[val].faturamento += item.valorDeVenda;
                                            mapa[val].lucro += item.lucro;
                                            mapa[val].unidades += item.quant_itens;
                                        });
                                        const produtosList = Object.values(mapa).sort((a,b) => b.faturamento - a.faturamento);

                                        return produtosList.map((prod, i) => {
                                            const custosTotais = prod.faturamento - prod.lucro;
                                            return (
                                                <div key={i} className="row-item" style={{background:'rgba(0,0,0,.3)', border:'1px solid rgba(255,255,255,.08)', borderRadius:'16px', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                                    <div style={{flex:1, display:'flex', alignItems:'center', gap:'12px'}}>
                                                        <div style={{width:'36px', height:'36px', borderRadius:'8px', background:'rgba(255,255,255,.05)', display:'grid', placeItems:'center'}}>
                                                            {prod.url_imagem && prod.url_imagem.trim() !== 'None' ? (
                                                                <img src={prod.url_imagem.startsWith('http') ? prod.url_imagem : 'https://' + prod.url_imagem} style={{width:'100%',height:'100%',objectFit:'contain',borderRadius:'8px'}} alt=""/>
                                                            ) : '📦'}
                                                        </div>
                                                        <div>
                                                            <h3 style={{margin:0, fontSize:'13px'}}>{prod.titulo}</h3>
                                                            <p style={{margin:'4px 0 0', fontSize:'11px', color:'var(--soft)'}}>Cód Interno: {prod.sku} | {prod.unidades} Unid.</p>
                                                        </div>
                                                    </div>
                                                    <div style={{textAlign:'right'}}>
                                                        <b style={{display:'block', fontSize:'14px'}}>R$ {prod.faturamento.toFixed(0)}</b>
                                                        <span style={{fontSize:'11px', color: prod.lucro > 0 ? 'var(--green)' : 'var(--red)'}}>Lucro R$ {prod.lucro.toFixed(0)}</span>
                                                        <div style={{fontSize:'10px', color:'var(--soft)', marginTop:'2px'}}>Custos: R$ {custosTotais.toFixed(0)}</div>
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}

                    {abaPrincipal === 'pedidos' && (
                        <div className="page-content pedidos-view">
                            <div className="section" style={{marginTop:'0'}}>
                                <h2>{filtroRank && filtroRank.tipo === 'margem' ? `Pedidos: ${filtroRank.titulo}` : `Todos os ${dadosProcessados.length} pedidos`}</h2>
                            </div>

                            <div className="margin-cards" style={{marginTop: '0px', marginBottom: '16px'}}>
                                <div className={`margin-card mc-red ${filtroRank?.valor === 'vermelho' ? 'active' : ''}`} onClick={() => filtroRank?.valor === 'vermelho' ? setFiltroRank(null) : setFiltroRank({tipo: 'margem', valor: 'vermelho', titulo: 'Prejuízo (< 0%)'})}>
                                    <h4>Prejuízo</h4>
                                    <p className="mc-val">{margensResumo.vermelho}</p>
                                    <p className="mc-label" style={{color: 'var(--red)'}}>&lt; 0%</p>
                                </div>
                                <div className={`margin-card mc-orange ${filtroRank?.valor === 'laranja' ? 'active' : ''}`} onClick={() => filtroRank?.valor === 'laranja' ? setFiltroRank(null) : setFiltroRank({tipo: 'margem', valor: 'laranja', titulo: 'Atenção (0 a 10%)'})}>
                                    <h4>Atenção</h4>
                                    <p className="mc-val">{margensResumo.laranja}</p>
                                    <p className="mc-label" style={{color: 'var(--orange)'}}>0% a 9.99%</p>
                                </div>
                                <div className={`margin-card mc-yellow ${filtroRank?.valor === 'amarelo' ? 'active' : ''}`} onClick={() => filtroRank?.valor === 'amarelo' ? setFiltroRank(null) : setFiltroRank({tipo: 'margem', valor: 'amarelo', titulo: 'Aceitável (10 a 20%)'})}>
                                    <h4>Aceitável</h4>
                                    <p className="mc-val">{margensResumo.amarelo}</p>
                                    <p className="mc-label" style={{color: 'var(--yellow)'}}>10% a 19.99%</p>
                                </div>
                                <div className={`margin-card mc-green ${filtroRank?.valor === 'verde' ? 'active' : ''}`} onClick={() => filtroRank?.valor === 'verde' ? setFiltroRank(null) : setFiltroRank({tipo: 'margem', valor: 'verde', titulo: 'Saudável (>= 20%)'})}>
                                    <h4>Saudável</h4>
                                    <p className="mc-val">{margensResumo.verde}</p>
                                    <p className="mc-label" style={{color: 'var(--green)'}}>&gt;= 20%</p>
                                </div>
                            </div>
                            
                            <div className="orders-list">
                                {(() => {
                                    const pedidosAExibir = filtroRank && filtroRank.tipo === 'margem' 
                                        ? dadosProcessados.filter(item => getMarginLevel(item.margemLucro) === filtroRank.valor)
                                        : dadosProcessados;

                                    const pedidoCounts = {};
                                    pedidosAExibir.forEach(d => {
                                        pedidoCounts[d.pedido_id] = (pedidoCounts[d.pedido_id] || 0) + 1;
                                    });

                                    return pedidosAExibir.map((item, index) => {
                                        const v = (item.vendedor || '').trim();
                                        const borderClass = v === 'MERCADO LIVRE' ? 'borda-ml' : v === 'SHOPEE' ? 'borda-sh' : v === 'MAGAZINE LUIZA' ? 'borda-mg' : v === 'TIKTOK' ? 'borda-tk' : 'borda-other';
                                        const ehCarrinho = pedidoCounts[item.pedido_id] > 1;

                                        return (
                                            <article className={`product-row ${borderClass}`} key={index} style={{cursor:'pointer'}} onClick={() => setPedidoSelecionado(item.pedido_id)}>
                                                <div className="product-photo">
                                                    {item.url_imagem && item.url_imagem.trim() !== 'None' ? (
                                                        <img src={item.url_imagem.startsWith('http') ? item.url_imagem : 'https://' + item.url_imagem} alt="produto" style={{width:'100%', height:'100%', objectFit:'contain', borderRadius:'22px'}} />
                                                    ) : '📦'}
                                                </div>
                                                <div className="product-info">
                                                    <h3>{item.titulo || 'Produto não cadastrado'}</h3>
                                                    <div className="tags">
                                                        <span className="tag quant">{item.quant_itens} UND.</span>
                                                        <span className="tag origin">{item.origem_nome ? item.origem_nome.trim() : item.vendedor}</span>
                                                        <span className="tag pid">ERP: {item.pedido_id}</span>{item.integracao && <span className="tag pid" style={{background: 'rgba(255,255,255,0.1)'}}>ID: {item.integracao}</span>}
                                                        {item.catalogo === 'S' && <span className="tag cat">⚡ CATÁLOGO</span>}
                                                        {item.full_status === 'TRUE' && <span className="tag full">⚡ FULL</span>}
                                                        {ehCarrinho && <span className="tag carrinho" style={{background: '#ff2d55', color: 'white'}}>🛒 CARRINHO</span>}
                                                    </div>
                                                    <p>Custo R$ {item.custoProduto.toFixed(2)} · Frete R$ {item.frete.toFixed(2)} · Taxa R$ {item.taxaFixa.toFixed(2)}</p>
                                                    <p style={{marginTop: '2px', color: '#8b8e96', fontSize: '11px'}}>SKU: {item.cod_interno}</p>
                                            </div>
                                            <div className="product-profit">
                                                <span className="pedido-total">R$ {item.total_pedido.toFixed(2)}</span>
                                                <b style={{color: item.lucro > 0 ? 'var(--green)' : 'var(--red)'}}>R$ {item.lucro.toFixed(2)}</b>
                                                <span style={{color: getMarginColor(item.margemLucro), fontWeight: 'bold'}}>{isFinite(item.margemLucro) ? item.margemLucro.toFixed(1) : 0}%</span>
                                            </div>
                                        </article>
                                    );
                                    });
                                })()}
                            </div>
                        </div>
                    )}

                    {abaPrincipal === 'full' && (
                        <div className="page-content pedidos-view">
                            <div className="section" style={{marginTop:'0'}}>
                                <h2>📦 Vendas Full ({fullData.total} pedidos)</h2>
                            </div>
                            <div className="full-summary" style={{marginBottom:'14px'}}>
                                <div className="full-chip ml">🟡 ML <b>{fullData.ml}</b></div>
                                <div className="full-chip sh">🟠 Shopee <b>{fullData.sh}</b></div>
                                <div className="full-chip mg">🔵 Magalu <b>{fullData.mg}</b></div>
                            </div>
                            <div className="orders-list">
                                {fullData.items.map((item, index) => {
                                    const v = (item.vendedor || '').trim();
                                    const borderClass = v === 'MERCADO LIVRE' ? 'borda-ml' : v === 'SHOPEE' ? 'borda-sh' : v === 'MAGAZINE LUIZA' ? 'borda-mg' : v === 'TIKTOK' ? 'borda-tk' : 'borda-other';
                                    return (
                                        <article className={`product-row ${borderClass}`} key={index}>
                                            <div className="product-photo">
                                                {item.url_imagem && item.url_imagem.trim() !== 'None' ? (
                                                    <img src={item.url_imagem.startsWith('http') ? item.url_imagem : 'https://' + item.url_imagem} alt="" style={{width:'100%', height:'100%', objectFit:'contain', borderRadius:'22px'}} />
                                                ) : '📦'}
                                            </div>
                                            <div className="product-info">
                                                <h3>{item.titulo || 'Produto'}</h3>
                                                <div className="tags">
                                                    <span className="tag quant">{item.quant_itens} UND.</span>
                                                    <span className="tag origin">{item.origem_nome ? item.origem_nome.trim() : item.vendedor}</span>
                                                    <span className="tag full">⚡ FULL</span>
                                                    <span className="tag pid">ERP: {item.pedido_id}</span>{item.integracao && <span className="tag pid" style={{background: 'rgba(255,255,255,0.1)'}}>ID: {item.integracao}</span>}
                                                </div>
                                                <p>Custo R$ {item.custoProduto.toFixed(2)} · Frete R$ {item.frete.toFixed(2)} · Taxa R$ {item.taxaFixa.toFixed(2)} · Comissão R$ {item.tarifaDevenda.toFixed(2)}</p>
                                                <p style={{marginTop: '2px', color: '#8b8e96', fontSize: '11px'}}>SKU: {item.cod_interno}</p>
                                            </div>
                                            <div className="product-profit">
                                                <span className="pedido-total">R$ {item.total_pedido.toFixed(2)}</span>
                                                <b style={{color: item.lucro > 0 ? 'var(--green)' : 'var(--red)'}}>R$ {item.lucro.toFixed(2)}</b>
                                                <span style={{color: item.lucro > 0 ? '#c5c7ce' : 'var(--red)'}}>{isFinite(item.margemLucro) ? item.margemLucro.toFixed(1) : 0}%</span>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* MODAL DE RESUMO DO PEDIDO */}
                    {pedidoSelecionado && (() => {
                        const itensDoPedido = dadosProcessados.filter(d => d.pedido_id === pedidoSelecionado);
                        if (itensDoPedido.length === 0) return null;
                        const totalPedidoVenda = itensDoPedido[0].total_pedido;
                        const totalItensCusto = itensDoPedido.reduce((acc, curr) => acc + curr.custoProduto, 0);
                        const totalItensTaxa = itensDoPedido.reduce((acc, curr) => acc + curr.taxaFixa, 0);
                        const totalItensComissao = itensDoPedido.reduce((acc, curr) => acc + curr.tarifaDeVenda, 0);
                        const totalItensFrete = itensDoPedido.reduce((acc, curr) => acc + curr.frete, 0);
                        const totalItensImposto = itensDoPedido.reduce((acc, curr) => acc + curr.descImposto, 0);
                        const totalItensOperacional = itensDoPedido.reduce((acc, curr) => acc + curr.descOperacional, 0);
                        
                        const lucroTotal = itensDoPedido.reduce((acc, curr) => acc + curr.lucro, 0);

                        return (
                            <div style={{position: 'fixed', top:0, left:0, right:0, bottom:0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'}}>
                                <div style={{background: 'var(--bg)', borderRadius: '24px', width: '100%', maxWidth: '400px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '80vh'}}>
                                    <div style={{padding: '16px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                        <div>
                                            <h3 style={{margin: 0, fontSize: '16px'}}>Detalhes do Pedido</h3>
                                            <p style={{margin: '2px 0 0', fontSize: '12px', color: 'var(--soft)'}}>ID: {pedidoSelecionado}{itensDoPedido[0]?.integracao ? ` | Ext: ${itensDoPedido[0].integracao}` : ''}</p>
                                        </div>
                                        <button onClick={() => setPedidoSelecionado(null)} style={{background: 'transparent', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer'}}>✕</button>
                                    </div>
                                    <div style={{padding: '16px', overflowY: 'auto', flex: 1}}>
                                        <div style={{marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                            <span style={{color: 'var(--soft)', fontSize: '13px'}}>Itens do Carrinho ({itensDoPedido.length})</span>
                                        </div>
                                        {itensDoPedido.map((it, idx) => (
                                            <div key={idx} style={{background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '12px', marginBottom: '8px', display: 'flex', gap: '12px', alignItems: 'center'}}>
                                                <div style={{width:'40px', height:'40px', borderRadius:'8px', background:'rgba(255,255,255,.05)', display:'grid', placeItems:'center'}}>
                                                    {it.url_imagem && it.url_imagem.trim() !== 'None' ? (
                                                        <img src={it.url_imagem.startsWith('http') ? it.url_imagem : 'https://' + it.url_imagem} style={{width:'100%',height:'100%',objectFit:'contain',borderRadius:'8px'}} alt=""/>
                                                    ) : '📦'}
                                                </div>
                                                <div style={{flex: 1}}>
                                                    <h4 style={{margin:0, fontSize:'13px'}}>{it.titulo || 'Produto'}</h4>
                                                    <p style={{margin:'2px 0 0', fontSize:'11px', color:'var(--soft)'}}>{it.quant_itens}x | SKU: {it.cod_interno}</p>
                                                </div>
                                                <div style={{textAlign: 'right'}}>
                                                    <span style={{fontSize:'12px', color:'var(--orange)'}}>Custo R$ {it.custoProduto.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        ))}

                                        <div style={{background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '12px', marginTop: '16px'}}>
                                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px'}}>
                                                <span style={{color: 'var(--soft)'}}>Faturamento Total</span>
                                                <b>R$ {totalPedidoVenda.toFixed(2)}</b>
                                            </div>
                                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px'}}>
                                                <span style={{color: 'var(--soft)'}}>Custos dos Produtos</span>
                                                <b style={{color: 'var(--red)'}}>-R$ {totalItensCusto.toFixed(2)}</b>
                                            </div>
                                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px'}}>
                                                <span style={{color: 'var(--soft)'}}>Taxas Fixas</span>
                                                <b style={{color: 'var(--red)'}}>-R$ {totalItensTaxa.toFixed(2)}</b>
                                            </div>
                                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px'}}>
                                                <span style={{color: 'var(--soft)'}}>Comissões</span>
                                                <b style={{color: 'var(--red)'}}>-R$ {totalItensComissao.toFixed(2)}</b>
                                            </div>
                                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px'}}>
                                                <span style={{color: 'var(--soft)'}}>Fretes</span>
                                                <b style={{color: 'var(--red)'}}>-R$ {totalItensFrete.toFixed(2)}</b>
                                            </div>
                                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px'}}>
                                                <span style={{color: 'var(--soft)'}}>Imposto ({imposto}%)</span>
                                                <b style={{color: 'var(--red)'}}>-R$ {totalItensImposto.toFixed(2)}</b>
                                            </div>
                                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px'}}>
                                                <span style={{color: 'var(--soft)'}}>Operacional ({custoOperacional}%)</span>
                                                <b style={{color: 'var(--red)'}}>-R$ {totalItensOperacional.toFixed(2)}</b>
                                            </div>
                                            <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '15px'}}>
                                                <span>Lucro Líquido</span>
                                                <b style={{color: lucroTotal > 0 ? 'var(--green)' : 'var(--red)'}}>R$ {lucroTotal.toFixed(2)}</b>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{padding: '16px', background: 'rgba(255,255,255,0.05)', borderTop: '1px solid rgba(255,255,255,0.1)'}}>
                                        <button onClick={() => setPedidoSelecionado(null)} style={{width: '100%', background: 'var(--cyan)', color: 'black', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer'}}>Entendido</button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </>
            )}

            <div className="bottom">
                <nav className="nav nav-4">
                    <div className={abaPrincipal === 'home' ? 'active' : ''} onClick={() => { setAbaPrincipal('home'); syncEBuscar(); window.scrollTo({top:0,behavior:'smooth'}); }}><b>🏠</b>Home</div>
                    <div className={abaPrincipal === 'pedidos' ? 'active' : ''} onClick={() => { setAbaPrincipal('pedidos'); window.scrollTo({top:0,behavior:'smooth'}); }}><b>📋</b>Pedidos</div>
                    <div className={abaPrincipal === 'full' ? 'active' : ''} onClick={() => { setAbaPrincipal('full'); window.scrollTo({top:0,behavior:'smooth'}); }}><b>📦</b>Full</div>
                    <div onClick={() => {}}><b>📊</b>Estoque</div>
                </nav>
            </div>
        </main>
    );
}

export default Resultados;



