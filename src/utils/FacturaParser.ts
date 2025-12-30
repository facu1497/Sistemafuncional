export const normalizarEspaciosFactura = (s: string) => {
    return String(s || "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
};

export const parseMonto = (str: string | number) => {
    if (!str) return 0;
    if (typeof str === 'number') return str;
    let s = String(str).trim();
    s = s.replace(/\./g, "");
    s = s.replace(",", ".");
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
};

const moneyMatchesEnOrden = (str: string) => {
    const re = /\b\d{1,3}(?:\.\d{3})*(?:,\d{2})\b|\b\d+(?:,\d{2})\b/g;
    return String(str || "").match(re) || [];
};

const extraerMontoDesdeBloqueFactura = (bloque: string) => {
    const ms = moneyMatchesEnOrden(bloque);
    if (!ms.length) return 0;
    return parseMonto(ms[ms.length - 1]);
};

const conceptoSoloAntesDelImporte = (bloque: string) => {
    const b = normalizarEspaciosFactura(bloque);
    const m = b.match(/\b\d{1,3}(?:\.\d{3})*(?:,\d{2})\b|\b\d+(?:,\d{2})\b/);
    const cut = m && m.index ? b.slice(0, m.index) : b;

    return normalizarEspaciosFactura(
        cut
            .replace(/\bCantidad\b/ig, "")
            .replace(/\bCódigo\b/ig, "")
            .replace(/\bDescripcion\b/ig, "")
            .replace(/\bDescripción\b/ig, "")
            .replace(/\bPrecio\s*unitario\b/ig, "")
            .replace(/\bIVA\b/ig, "")
            .replace(/\bBonif\.?\b/ig, "")
            .replace(/\bImporte\b/ig, "")
            .replace(/[-–]\s*$/g, "")
    );
};

const conceptoFinalPorCodigoFactura = (codigo: string, bloque: string) => {
    let base = conceptoSoloAntesDelImporte(bloque);
    if (String(codigo || "").toUpperCase() === "HORV") {
        const idx = base.toUpperCase().indexOf("NRO DE STRO:");
        if (idx >= 0) base = base.slice(idx);
    }
    return normalizarEspaciosFactura(base) || (`Ítem ${codigo || ""}`.trim());
};

export const extraerItemsDesdeTextoFactura = (texto: string) => {
    const t = normalizarEspaciosFactura(texto);
    let zona = t;
    const iTabla = t.toUpperCase().indexOf("CANTIDAD");
    if (iTabla >= 0) zona = t.slice(iTabla);

    const cortes = ["PAG:", "CAE:", "IMPORTE NETO GRAVADO", "IVA 21", "IMPORTE TOTAL", "SON PESOS", "VENCIMIENTO CAE"];
    let fin = zona.length;
    for (const c of cortes) {
        const i = zona.toUpperCase().indexOf(c);
        if (i >= 0) fin = Math.min(fin, i);
    }
    zona = zona.slice(0, fin);

    const reItem = /(\d+)\s+([A-Z0-9]{1,8})\s+([\s\S]*?)(?=\s+\d+\s+[A-Z0-9]{1,8}\s+|$)/g;
    const items = [];
    let m;
    while ((m = reItem.exec(zona)) !== null) {
        const codigo = (m[2] || "").trim();
        const bloque = (m[3] || "").trim();
        const montos = moneyMatchesEnOrden(bloque);
        if (!montos || montos.length === 0) continue;

        const neto = extraerMontoDesdeBloqueFactura(bloque);
        const concepto = conceptoFinalPorCodigoFactura(codigo, bloque);
        const ivaPctMatch = bloque.match(/(\d{1,2}(?:,\d{1,2})?)\s*%/);
        let aplicaIva = true;
        if (ivaPctMatch) {
            const pct = parseFloat(String(ivaPctMatch[1]).replace(",", "."));
            if (!isNaN(pct)) aplicaIva = pct > 0;
        }

        items.push({ concepto, neto, aplicaIva });
    }
    return items;
};

export const procesarCabeceraFactura = (texto: string) => {
    const t = normalizarEspaciosFactura(texto);
    const res: any = {};

    const mCAE = t.match(/CAE\s*:?\s*(\d{14})/i);
    if (mCAE) res.cae = mCAE[1];

    const mFecha = t.match(/Fecha\s*:?\s*(\d{2})[\/\-](\d{2})[\/\-](\d{4})/i);
    if (mFecha) res.fecha = `${mFecha[3]}-${mFecha[2]}-${mFecha[1]}`;

    const mNum = t.match(/N[º°]\s*:?\s*(\d{1,5})\s*-\s*(\d{1,8})/i) || t.match(/(\d{4,5})\s*-\s*(\d{8})/);
    if (mNum) {
        res.pv = String(mNum[1]).padStart(4, "0");
        res.nf = String(mNum[2]).padStart(8, "0");
    }

    // Fallback Total Check if items fail logic could be added here
    return res;
};
