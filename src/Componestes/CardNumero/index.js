import React from "react";
import styles from "./CardNumero.module.css"
import raioSvg from "../../imagens/raio.svg";
function CardNumero({titulo, faturamento, classe}){
    return (
        <div className={`${styles.coluna} ${styles[classe]}`}>
            <h3>
                {classe === 'full' && (
                    <img src={raioSvg} alt="Full" className={styles.image} />
                )}
                {titulo}
            </h3>
            <div className={styles.total}>
                <span className={styles.real}>
                    {titulo === "Performance do dia" ? Math.floor(faturamento).toLocaleString('pt-BR') + "%" : Math.floor(faturamento).toLocaleString('pt-BR')}
                </span>
            </div>
        </div>
    );
}

export default CardNumero;