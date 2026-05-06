import styles from "./CardPedidos.module.css";
import React from "react";
import raioSvg from "../../imagens/raio.svg";

function CardPedidos({
  url,
  titulo,
  quant,
  vendedor,
  loja,
  pedido,
  integracao,
  codInterno,
  valorDeVenda,
  taxa,
  tarifa,
  frete,
  custo,
  total,
  lucro,
  full,
  catalogo,
}) {
  // Ensure url is a string before checking includes
  const imageUrl = typeof url === 'string' ? (url.includes("http") ? url : `http://${url}`) : '';

  return (
    <div className={styles.produtos}>
      <div className={styles.imagem}>
        <img src={imageUrl} alt={titulo} />
      </div>
      <div className={styles.descricao}>
        <span className={styles.titulo}>{titulo}</span>
        <div className={styles.pilulas}>
          <div>
            <span className={styles.pill}>{quant} UNID.</span>
            <span className={`${styles.pill} ${styles[vendedor.replace(/\s/g, "")]}`}>{loja}</span>
            <span className={styles.pill}>{pedido}</span>
            <div className={`${full === 'TRUE' ? `${styles.full}` : ` ${styles.null}`}`}>
              <span>
                <img src={raioSvg} alt="Raio" />
                FULL
              </span>
            </div>
          </div>
          <div>
            <span className={styles.pill}>{integracao}</span>
            {/* <span className={styles.pill}>{codInterno}</span> */}
            <div className={`${catalogo === 'S' ? `${styles.catalogo}` : `${styles.null}`}`}>
              <span>
                <img src={raioSvg} alt="Raio" />
                Catálogo
              </span>
            </div>
          </div>
        </div>
        <div className={styles.valores}>
          <div>
            <div>
              <strong>valor</strong>
              <span>R${valorDeVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} </span>
            </div>
            <div>
              <strong>taxa</strong>
              <span>R${taxa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div>
              <strong>Tarifa</strong>
              <span>R${tarifa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div>
              <strong>envio</strong>
              <span>R${frete.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div>
              <strong>custo</strong>
              <span>R${custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className={styles.total}>
              <div className={styles.totalnumero}>
                <span className={(total <= 0) ? `${styles.red} ${styles.pill}` : `${styles.green} ${styles.pill}`}>R${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                <span className={lucro < 10 ? `${styles.red} ${styles.pill}` : (lucro >= 10 && lucro <= 20) ? `${styles.yellow} ${styles.pill}` : `${styles.green} ${styles.pill}`}>{Math.floor(lucro).toLocaleString('pt-BR')}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CardPedidos;
