const fs = require('fs');
const raw = fs.readFileSync("C:\\Users\\filip\\.gemini\\antigravity\\brain\\c0201a56-1f37-418e-a2c5-98117b494054\\.system_generated\\steps\\412\\content.md", "utf-8");
const data = JSON.parse(raw.slice(raw.indexOf("[{")));
const items = data.filter(i => i.cod_interno && i.cod_interno.trim() === 'HYQ1821');
items.forEach(i => console.log(`ERP:${i.pedido_id} | total:${i.total_pedido} | vlr_unit:${i.vlr_unit} | quant:${i.quant_itens} | itens:${i.itens} | frete_real:${i.vlr_frete_real} | full:${i.full_status}`));
