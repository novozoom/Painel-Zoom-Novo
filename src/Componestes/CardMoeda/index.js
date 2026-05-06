import React from "react";
import styles from "./CardMoeda.module.css"
function CardMoeda({titulo, faturamento}){
    return (
        <div className={styles.coluna}>
            <h3>{titulo}</h3>
            <div className={styles.total}>
                <span className={styles.real}><strong>R$</strong>{(faturamento).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
            </div>
        </div>
    );
}
export default CardMoeda;