
function getMarginLevel(margem) {
    if (!isFinite(margem)) return 'diversos';
    if (margem < 0) return 'vermelho';
    if (margem < 10) return 'laranja';
    if (margem < 20) return 'amarelo';
    return 'verde';
}

function getMarginColor(margem) {
    if (!isFinite(margem)) return 'var(--soft)';
    if (margem < 0) return 'var(--red)';
    if (margem < 10) return 'var(--orange)';
    if (margem < 20) return 'var(--yellow)';
    return 'var(--green)';
}

