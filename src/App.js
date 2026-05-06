import React, {useEffect, useState, useMemo} from 'react';
import axios from 'axios';
import {CircularProgress} from "@mui/joy";
import { format } from "date-fns";
import { ptBR } from 'date-fns/locale';

function Resultados() {
    const [dados, inserirDados] = useState([]);
    const [numeroDePedidosUnicos, setNumeroDePedidosUnicos] = useState(0);
    const [dadosOntem, inserirDadosOntem] = useState(0);
    const [faturamentoDeHoje, setFaturamentoDeHoje] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [filtroAtivo, setFiltroAtivo] = useState('Hoje');
    const [abaRanking, setAbaRanking] = useState('produtos'); // produtos, marcas, grupos

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

    function CalcularTotal(valor, taxaFixa, tarifa, custo, frete) {
        return valor - taxaFixa - tarifa - custo - frete;
    }

    function CalcularMargemLucro(total, custoProduto) {
        if (custoProduto === 0) return 100;
        var margem = total / custoProduto;
        return margem * 100;
    }

    useEffect(() => {
        const buscarDadosOntem = async () => {
            try {
                const respostaDados = await axios.get('https://zoom-dash-render.onrender.com/api/faturamento_ontem');
                const pedidosUnicos = new Set();
                let somaTotal = 0;
                respostaDados.data.forEach(item => {
                    if (item.POSICAO.trim() !== 'CANCELADO' && !pedidosUnicos.has(item.PEDIDO)) {
                        pedidosUnicos.add(item.PEDIDO);
                        somaTotal += item.TOTAL_PEDIDO;
                    }
                });
                inserirDadosOntem(somaTotal);
            } catch (error) { console.error(error); }
        };
        buscarDadosOntem();
        const tempoDeAtualizacao = setInterval(buscarDadosOntem, 60000);
        return () => clearInterval(tempoDeAtualizacao);
    }, []);

    // Sincronizar e buscar dados
    const syncEBuscar = async () => {
        try {
            const dataInicioStr = format(startDate, 'yyyy-MM-dd');
            const dataFimStr = format(endDate, 'yyyy-MM-dd');
            
            // Dispara o sync na nuvem silenciosamente
            try {
                await axios.post(`https://zoom-dash-render.onrender.com/api/sync`, {
                    data_inicio: dataInicioStr,
                    data_fim: dataFimStr
                });
            } catch(e) { console.log('Erro no sync, buscando o que ja tem:', e); }

            const url = `https://zoom-dash-render.onrender.com/api/resultados?data_inicio=${dataInicioStr}&data_fim=${dataFimStr}`;
            const respostaDados = await axios.get(url);
            const dadosFiltrados = respostaDados.data.filter(dado => dado.POSICAO.trim() !== "CANCELADO");

            const pedidosUnicos = new Set();
            const dadosSemDuplicatas = [];
            let somaValoresUnicos = 0;

            dadosFiltrados.forEach(dado => {
                if (!pedidosUnicos.has(dado.PEDIDO)) {
                    pedidosUnicos.add(dado.PEDIDO);
                    dadosSemDuplicatas.push(dado);
                    somaValoresUnicos += dado.TOTAL_PEDIDO;
                } else {
                    const existente = dadosSemDuplicatas.find(item => item.COD_INTERNO === dado.COD_INTERNO);
                    if (!existente) {
                        dadosSemDuplicatas.push(dado);
                        somaValoresUnicos += dado.TOTAL_PEDIDO;
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
    }, [startDate, endDate]);

    // Processar cálculos dos itens
    const dadosProcessados = useMemo(() => {
        return dados.map(item => {
            const taxaFixa = calcularTaxaFixa(item.ORIGEM, item.CUSTO_ADICIONAL, item.QUANT_ITENS, item.CUSTO_FRETE);
            const tarifaDeVenda = CalcularTarifaDeVenda(item.ORIGEM, item.TOTAL_PEDIDO, item.COMISSAO_SKU);
            const custoProduto = CalcularCustoProduto(item.QUANT_ITENS, item.VLR_CUSTO);
            const frete = CalcularFrete(item.VLRFRETE_REAL, item.VLRFRETE_COMPRADOR, item.ORIGEM, item.QUANT_ITENS);
            const valorDeVenda = item.TOTAL_PEDIDO;
            const lucro = CalcularTotal(valorDeVenda, taxaFixa, tarifaDeVenda, custoProduto, frete);
            const margemLucro = CalcularMargemLucro(lucro, custoProduto);
            return { ...item, valorDeVenda, lucro, margemLucro, custoProduto };
        });
    }, [dados]);

    const lucroLiquidoTotal = useMemo(() => {
        return dadosProcessados.reduce((acc, curr) => acc + curr.lucro, 0);
    }, [dadosProcessados]);

    // Agrupamentos
    const agruparPor = (chave) => {
        const mapa = {};
        dadosProcessados.forEach(item => {
            const val = (item[chave] && item[chave].trim() !== '') ? item[chave] : 'Diversos';
            if (!mapa[val]) {
                mapa[val] = { nome: val, faturamento: 0, lucro: 0, pedidos: new Set(), unidades: 0, skus: 0 };
            }
            mapa[val].faturamento += item.valorDeVenda;
            mapa[val].lucro += item.lucro;
            mapa[val].pedidos.add(item.PEDIDO);
            mapa[val].unidades += item.QUANT_ITENS;
            mapa[val].skus += 1;
        });
        return Object.values(mapa).map(g => ({ ...g, pedidos: g.pedidos.size, margem: g.faturamento > 0 ? (g.lucro / g.faturamento * 100) : 0 })).sort((a,b) => b.lucro - a.lucro);
    };

    const marcasAgrupadas = useMemo(() => agruparPor('MARCA').sort((a,b) => b.margem - a.margem), [dadosProcessados]);
    const gruposAgrupados = useMemo(() => agruparPor('GRUPO').sort((a,b) => b.margem - a.margem), [dadosProcessados]);
    const fornecedoresAgrupados = useMemo(() => agruparPor('VENDEDOR'), [dadosProcessados]);
    const produtosAgrupados = useMemo(() => {
        const mapa = {};
        dadosProcessados.forEach(item => {
            const val = item.COD_INTERNO;
            if(!val) return;
            if (!mapa[val]) {
                mapa[val] = { 
                    nome: item.TITULO, 
                    sku: val, 
                    origem: item.ORIGEM_NOME + ' ' + item.VENDEDOR, 
                    faturamento: 0, lucro: 0, unidades: 0, pedidos: 0,
                    custoProduto: 0
                };
            }
            mapa[val].faturamento += item.valorDeVenda;
            mapa[val].lucro += item.lucro;
            mapa[val].unidades += item.QUANT_ITENS;
            mapa[val].pedidos += 1;
            mapa[val].custoProduto += item.custoProduto;
        });
        return Object.values(mapa).map(p => ({
            ...p, 
            margem: p.custoProduto > 0 ? (p.lucro / p.custoProduto * 100) : 100 
        })).sort((a,b) => b.margem - a.margem);
    }, [dadosProcessados]);

    const prejuizos = useMemo(() => dadosProcessados.filter(d => d.lucro <= 0).sort((a,b) => a.lucro - b.lucro), [dadosProcessados]);

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

    const rolarParaRanking = () => {
        const el = document.getElementById('mais-margem');
        if(el) el.scrollIntoView({behavior:'smooth'});
    };

    return (
        <main className="app">
            <div className="glow"></div><div className="glow two"></div>
            
            {isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', position: 'relative', zIndex: 10 }}>
                    <CircularProgress color="neutral" size="lg" variant="soft" />
                </div>
            ) : (
                <>
                    <header className="top">
                        <button className="menu">☰</button>
                        <div className="title"><h1>Olá, Filipe 👋</h1><p>Central rápida do seu resultado de hoje</p></div>
                        <button className="bell">🔔</button>
                    </header>

                    <nav className="tabs">
                        <button className={filtroAtivo === 'Hoje' ? 'active' : ''} onClick={() => setDateRange('Hoje')}>Hoje</button>
                        <button className={filtroAtivo === 'Ontem' ? 'active' : ''} onClick={() => setDateRange('Ontem')}>Ontem</button>
                        <button className={filtroAtivo === '7 dias' ? 'active' : ''} onClick={() => setDateRange('7 dias')}>7 dias</button>
                        <button className={filtroAtivo === '30 dias' ? 'active' : ''} onClick={() => setDateRange('30 dias')}>30 dias</button>
                    </nav>

                    <div className="datebar">
                        <button className="range">📅 {format(startDate, 'dd/MM/yyyy')} até {format(endDate, 'dd/MM/yyyy')}</button>
                        <button onClick={syncEBuscar}>↻</button>
                    </div>

                    <section className="hero" id="vendas-dia">
                        <div className="label">Vendas do Período</div>
                        <div className="big">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(faturamentoDeHoje)}</div>
                        <div className="sub">
                            {desempenhoDia > 0 ? <span className="up">↑ {desempenhoDia.toFixed(1)}%</span> : <span className="down">↓ {Math.abs(desempenhoDia).toFixed(1)}%</span>} vs ontem • {numeroDePedidosUnicos} pedidos • lucro R$ {lucroLiquidoTotal.toFixed(0)}
                        </div>
                        <svg className="spark" viewBox="0 0 320 70" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
                                    <stop stopColor={desempenhoDia >= 0 ? "#25f56a" : "#ff3d73"} stopOpacity=".85"/>
                                    <stop offset="1" stopColor={desempenhoDia >= 0 ? "#25f56a" : "#ff3d73"} stopOpacity="0"/>
                                </linearGradient>
                            </defs>
                            <path d="M0,58 C34,44 45,29 80,36 C116,44 126,22 166,24 C200,26 208,44 246,35 C276,28 293,17 320,20 L320,70 L0,70 Z" fill="url(#g)"/>
                            <path d="M0,58 C34,44 45,29 80,36 C116,44 126,22 166,24 C200,26 208,44 246,35 C276,28 293,17 320,20" fill="none" stroke={desempenhoDia >= 0 ? "#25f56a" : "#ff3d73"} strokeWidth="4"/>
                        </svg>
                        <div className="hero-actions">
                            <button className="main">Abrir vendas do dia ›</button>
                            <button>Ver pedidos ›</button>
                        </div>
                    </section>

                    <div className="section"><h2>O que você deseja consultar?</h2><button>Personalizar</button></div>

                    <section className="quick-grid">
                        <button className="quick cyan">
                            <span className="tag">ranking</span><span className="ico">🔥</span>
                            <h3>Produtos mais vendidos</h3>
                            <div className="value">{numeroDePedidosUnicos} pedidos</div>
                            <p>abre produtos vendidos hoje com lucro e margem</p>
                        </button>
                        <button className="quick purple">
                            <span className="tag">top</span><span className="ico">🏷️</span>
                            <h3>Marca mais vendida</h3>
                            <div className="value">{marcaTop ? marcaTop.nome : '-'}</div>
                            <p>R$ {marcaTop ? marcaTop.faturamento.toFixed(0) : 0} vendidos • {marcaTop ? marcaTop.unidades : 0} unid.</p>
                        </button>
                        <button className="quick orange">
                            <span className="tag">contas</span><span className="ico">🛒</span>
                            <h3>Vendas por marketplace</h3>
                            <div className="value">ML {mercadoLivre.pedidos}</div>
                            <p>abre cards por marketplace e depois pedidos</p>
                        </button>
                        <button className="quick green" onClick={rolarParaRanking}>
                            <span className="tag">lucro</span><span className="ico">💎</span>
                            <h3>Produtos com mais margem</h3>
                            <div className="value">{produtoMargemTop && isFinite(produtoMargemTop.margem) ? produtoMargemTop.margem.toFixed(1) : 0}%</div>
                            <p>produto, marca/fornecedor e grupo campeão</p>
                        </button>
                        <button className="quick red">
                            <span className="tag">urgente</span><span className="ico">⚠️</span>
                            <h3>Pedidos com prejuízo</h3>
                            <div className="value">{prejuizos.length}</div>
                            <p>corrigir preço, frete, taxa ou custo</p>
                        </button>
                        <button className="quick purple">
                            <span className="tag">platinum</span><span className="ico">🚀</span>
                            <h3>Oportunidades de conta</h3>
                            <div className="value">0</div>
                            <p>Best forte e outras contas fracas</p>
                        </button>
                    </section>

                    <div className="section" id="mais-margem"><h2>💎 Mais margem hoje</h2><button>Abrir tela</button></div>
                    
                    <section className="margin-panel">
                        <div className="panel-head">
                            <h2>Ranking de margem</h2>
                            <div className="score">mín. lucro</div>
                        </div>
                        <div className="switches">
                            <button className={abaRanking === 'produtos' ? 'active' : ''} onClick={() => setAbaRanking('produtos')}>Produtos</button>
                            <button className={abaRanking === 'marcas' ? 'active' : ''} onClick={() => setAbaRanking('marcas')}>Marcas / Fornec.</button>
                            <button className={abaRanking === 'grupos' ? 'active' : ''} onClick={() => setAbaRanking('grupos')}>Grupos</button>
                        </div>

                        <div className={`rank-list ${abaRanking === 'produtos' ? 'active' : ''}`}>
                            {produtosAgrupados.slice(0, 10).map((prod, i) => (
                                <article className="rank-item" key={i}>
                                    <div className="rank-top">
                                        <div className="medal">{i + 1}</div>
                                        <div className="rank-name">
                                            <h3>{prod.nome || 'Produto Desconhecido'}</h3>
                                            <p>SKU {prod.sku} • {prod.origem}</p>
                                        </div>
                                        <div className="margin">{isFinite(prod.margem) ? prod.margem.toFixed(1) : 0}%</div>
                                    </div>
                                    <div className="rank-metrics">
                                        <div><span>Venda</span><b>R$ {(prod.faturamento/prod.unidades || 0).toFixed(2)}</b></div>
                                        <div><span>Lucro</span><b style={{color:'var(--green)'}}>R$ {prod.lucro.toFixed(2)}</b></div>
                                        <div><span>Qtd</span><b>{prod.unidades} un.</b></div>
                                    </div>
                                </article>
                            ))}
                        </div>

                        <div className={`rank-list ${abaRanking === 'marcas' ? 'active' : ''}`}>
                            {marcasAgrupadas.slice(0, 10).map((marca, i) => (
                                <article className="rank-item" key={i}>
                                    <div className="rank-top">
                                        <div className="medal">{i + 1}</div>
                                        <div className="rank-name">
                                            <h3>{marca.nome}</h3>
                                            <p>{marca.skus} SKUs vendidos</p>
                                        </div>
                                        <div className="margin">{isFinite(marca.margem) ? marca.margem.toFixed(1) : 0}%</div>
                                    </div>
                                    <div className="rank-metrics">
                                        <div><span>Faturou</span><b>R$ {marca.faturamento.toFixed(0)}</b></div>
                                        <div><span>Lucro</span><b style={{color:'var(--green)'}}>R$ {marca.lucro.toFixed(0)}</b></div>
                                        <div><span>Qtd</span><b>{marca.unidades} un.</b></div>
                                    </div>
                                </article>
                            ))}
                        </div>

                        <div className={`rank-list ${abaRanking === 'grupos' ? 'active' : ''}`}>
                            {gruposAgrupados.slice(0, 10).map((grupo, i) => (
                                <article className="rank-item" key={i}>
                                    <div className="rank-top">
                                        <div className="medal">{i + 1}</div>
                                        <div className="rank-name">
                                            <h3>{grupo.nome}</h3>
                                            <p>{grupo.skus} SKUs vendidos</p>
                                        </div>
                                        <div className="margin">{isFinite(grupo.margem) ? grupo.margem.toFixed(1) : 0}%</div>
                                    </div>
                                    <div className="rank-metrics">
                                        <div><span>Faturou</span><b>R$ {grupo.faturamento.toFixed(0)}</b></div>
                                        <div><span>Lucro</span><b style={{color:'var(--green)'}}>R$ {grupo.lucro.toFixed(0)}</b></div>
                                        <div><span>Pedidos</span><b>{grupo.pedidos}</b></div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>

                    <div className="section"><h2>Vendas por marketplace</h2><button>Ver todos</button></div>
                    
                    <section className="market-grid">
                        <article className="market">
                            <h3>Mercado Livre</h3>
                            <div className="v">{mercadoLivre.pedidos}</div>
                            <p>R$ {mercadoLivre.faturamento.toFixed(2)}</p>
                            <div className="bar"><i style={{width: `${(mercadoLivre.faturamento/totalMarketplacesFat)*100}%`}}></i></div>
                        </article>
                        <article className="market">
                            <h3>Shopee</h3>
                            <div className="v">{shopee.pedidos}</div>
                            <p>R$ {shopee.faturamento.toFixed(2)}</p>
                            <div className="bar"><i style={{width: `${(shopee.faturamento/totalMarketplacesFat)*100}%`, background: 'linear-gradient(90deg,var(--orange),var(--yellow))'}}></i></div>
                        </article>
                        <article className="market">
                            <h3>Magalu</h3>
                            <div className="v">{magalu.pedidos}</div>
                            <p>R$ {magalu.faturamento.toFixed(2)}</p>
                            <div className="bar"><i style={{width: `${(magalu.faturamento/totalMarketplacesFat)*100}%`, background: 'linear-gradient(90deg,var(--blue),var(--cyan))'}}></i></div>
                        </article>
                        <article className="market">
                            <h3>Outros</h3>
                            <div className="v">{outrosPedidos}</div>
                            <p>R$ {outrosFaturamento.toFixed(2)}</p>
                            <div className="bar"><i style={{width: `${(outrosFaturamento/totalMarketplacesFat)*100}%`, background: 'linear-gradient(90deg,var(--purple),var(--pink))'}}></i></div>
                        </article>
                    </section>
                </>
            )}

            <div className="bottom">
                <nav className="nav">
                    <div className="active"><b>⌂</b>Home</div>
                    <div><b>▣</b>Pedidos</div>
                    <div><span className="plus">+</span></div>
                    <div><b>◇</b>Margem</div>
                    <div><b>•••</b>Mais</div>
                </nav>
            </div>
        </main>
    );
}

export default Resultados;
