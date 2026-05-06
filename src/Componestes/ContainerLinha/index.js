import style from "./ContainerLinha.module.css";
import React from 'react';
function ContainerLinha({children}){
    return(
        <div className={style.container}>
            {children}
        </div>
    );
}
export default ContainerLinha;