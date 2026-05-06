import React from "react";
import styles from "./CardMarketplace.module.css"
function CardMarketplace({ url, quant, faturamento }) {
    return (
        <div className={styles.cardMarketplace}>
            <h3><img src={url}></img></h3>
            <div>
                <span className={styles.quant}>quant. {quant}</span>
                <span className={styles.real}><strong>R$</strong>{(faturamento).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
            </div>
        </div>
    );
}

export default CardMarketplace;