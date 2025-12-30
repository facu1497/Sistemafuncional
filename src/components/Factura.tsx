import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import styles from './Factura.module.css';
import { Trash2, Upload } from 'lucide-react';
import { Dropzone } from './Dropzone';

import * as pdfjsLib from 'pdfjs-dist';
// Vite-specific worker import
import workerSrc from 'pdfjs-dist/build/pdf.worker?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

import { extraerItemsDesdeTextoFactura, procesarCabeceraFactura } from '../utils/FacturaParser';

interface FacturaItem {
    concepto: string;
    neto: number | string;
    aplicaIva: boolean;
}

interface FacturaData {
    id?: number;
    n_siniestro: string;
    punto_venta: string;
    numero_factura: string;
    fecha_emision: string;
    cae: string;
    items: FacturaItem[];
}

interface FacturaProps {
    nSiniestro: string;
    onSave?: () => void;
}

const IVA_ALICUOTA = 0.21;

export const Factura = ({ nSiniestro, onSave }: FacturaProps) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Header Fields
    const [pv, setPv] = useState('');
    const [nf, setNf] = useState('');
    const [fecha, setFecha] = useState('');
    const [cae, setCae] = useState('');

    // Items
    const [items, setItems] = useState<FacturaItem[]>([{ concepto: '', neto: 0, aplicaIva: true }]);

    useEffect(() => {
        if (nSiniestro) loadFactura();
    }, [nSiniestro]);

    const loadFactura = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('facturas')
            .select('*')
            .eq('n_siniestro', nSiniestro)
            .single();

        if (data) {
            setPv(data.punto_venta || '');
            setNf(data.numero_factura || '');
            setFecha(data.fecha_emision || '');
            setCae(data.cae || '');
            if (Array.isArray(data.items) && data.items.length > 0) {
                setItems(data.items);
            }
        } else if (error && error.code !== 'PGRST116') {
            console.error("Error loading invoice:", error);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);

        // Calculate totals for backend redundancy if needed, but mainly for display
        const { totalNeto, totalIva, totalGeneral } = calculateTotals();

        // Ensure 'fecha' (which might be DD-MM-YYYY from parser) is valid for DB (YYYY-MM-DD)
        // Actually parser returns YYYY-MM-DD but let's double check inputs.
        // If input type='date', it expects YYYY-MM-DD.
        // If parser logic returned successfully, it is YYYY-MM-DD.
        // But if user typed manually or logic failed, ensure it's valid or null.
        const validDate = fecha ? fecha : null;

        const payload = {
            n_siniestro: nSiniestro,
            punto_venta: pv,
            numero_factura: nf,
            fecha_emision: validDate,
            cae: cae,
            items: items,
            total_neto: totalNeto,
            total_iva: totalIva,
            total_general: totalGeneral,
            // Logic state
            estado_pago: (nf && validDate) ? 'PENDIENTE' : 'SIN_FACTURAR'
        };

        const { error } = await supabase
            .from('facturas')
            .upsert(payload, { onConflict: 'n_siniestro' });

        setSaving(false);

        if (error) {
            alert(`Error al guardar factura: ${error.message}`);
        } else {
            alert("Factura guardada correctamente.");
            if (onSave) onSave();
        }
    };

    // ITEM HANDLERS
    const addItem = () => setItems([...items, { concepto: '', neto: 0, aplicaIva: true }]);

    const removeItem = (idx: number) => {
        const copy = [...items];
        copy.splice(idx, 1);
        if (copy.length === 0) copy.push({ concepto: '', neto: 0, aplicaIva: true });
        setItems(copy);
    };

    const updateItem = (idx: number, field: keyof FacturaItem, val: any) => {
        const copy = [...items];
        copy[idx] = { ...copy[idx], [field]: val };
        setItems(copy);
    };

    // CALCULATIONS
    const parseMonto = (val: any) => {
        if (typeof val === 'number') return val;
        // Basic parse logic similar to previous tabs
        let s = String(val || '').trim().replace(/\./g, '').replace(',', '.');
        return parseFloat(s) || 0;
    };

    const formatMonto = (val: number) => {
        return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
    };

    const calculateTotals = () => {
        let net = 0, iva = 0;
        items.forEach(it => {
            const n = parseMonto(it.neto);
            net += n;
            if (it.aplicaIva) iva += n * IVA_ALICUOTA;
        });
        return { totalNeto: net, totalIva: iva, totalGeneral: net + iva };
    };

    const totals = calculateTotals();

    // Updated for Dropzone (accepts File directly)
    const handleFileDrop = async (file: File) => {
        if (!file) return;

        try {
            setLoading(true);
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            let fullText = "";
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const strings = textContent.items.map((item: any) => item.str);
                fullText += strings.join(" ") + " ";
            }

            // Extract logic
            const cabecera = procesarCabeceraFactura(fullText);
            const nuevosItems = extraerItemsDesdeTextoFactura(fullText);

            if (cabecera.pv) setPv(cabecera.pv);
            if (cabecera.nf) setNf(cabecera.nf);
            if (cabecera.fecha) setFecha(cabecera.fecha);
            if (cabecera.cae) setCae(cabecera.cae);

            if (nuevosItems && nuevosItems.length > 0) {
                // Ensure state update triggers re-render
                setItems([...nuevosItems]);
            } else {
                alert("No se detectaron ítems en el PDF. Revisa el formato.");
            }

        } catch (error: any) {
            console.error("Error leyendo PDF:", error);
            alert(`Error al leer PDF: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div style={{ color: 'var(--muted-color)', padding: '20px' }}>Cargando...</div>;

    return (
        <div className={styles.wrapper}>
            <div className={styles.pdfBox} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <span className={styles.pdfLabel} style={{ marginBottom: '8px' }}>Auto-completar desde PDF:</span>
                <Dropzone
                    onFileSelect={handleFileDrop}
                    label="Arrastrá tu factura aquí (PDF)"
                    subLabel="o click para seleccionar"
                    accept="application/pdf"
                />
            </div>

            <div className={styles.gridHeader}>
                <div className={styles.field}>
                    <span className={styles.label}>Punto de Venta</span>
                    <input className={styles.input} value={pv} onChange={e => setPv(e.target.value)} placeholder="0001" />
                </div>
                <div className={styles.field}>
                    <span className={styles.label}>Nro Factura</span>
                    <input className={styles.input} value={nf} onChange={e => setNf(e.target.value)} placeholder="12345678" />
                </div>
                <div className={styles.field}>
                    <span className={styles.label}>Fecha Emisión</span>
                    <input type="date" className={styles.input} value={fecha} onChange={e => setFecha(e.target.value)} />
                </div>
                <div className={styles.field}>
                    <span className={styles.label}>N° CAE</span>
                    <input className={styles.input} value={cae} onChange={e => setCae(e.target.value)} />
                </div>
            </div>

            <div className={styles.sectionTitle}>
                <span className={styles.titleText}>Ítems de Factura</span>
                <button className={styles.btnAdd} onClick={addItem}>Agregar ítem +</button>
            </div>

            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th style={{ width: '40%' }}>Concepto</th>
                            <th style={{ textAlign: 'right' }}>Neto</th>
                            <th style={{ textAlign: 'center' }}>¿IVA?</th>
                            <th style={{ textAlign: 'right' }}>IVA</th>
                            <th style={{ textAlign: 'right' }}>Total</th>
                            <th style={{ width: '40px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it, idx) => {
                            const n = parseMonto(it.neto);
                            const i = it.aplicaIva ? n * IVA_ALICUOTA : 0;
                            return (
                                <tr key={idx}>
                                    <td>
                                        <input
                                            className={styles.inputCell}
                                            value={it.concepto}
                                            onChange={e => updateItem(idx, 'concepto', e.target.value)}
                                            placeholder="Descripción..."
                                        />
                                    </td>
                                    <td>
                                        <input
                                            className={styles.inputCell}
                                            style={{ textAlign: 'right' }}
                                            value={it.neto}
                                            onChange={e => updateItem(idx, 'neto', e.target.value)}
                                            placeholder="0.00"
                                        />
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={it.aplicaIva}
                                            onChange={e => updateItem(idx, 'aplicaIva', e.target.checked)}
                                        />
                                    </td>
                                    <td style={{ textAlign: 'right' }}>$ {formatMonto(i)}</td>
                                    <td style={{ textAlign: 'right' }}>$ {formatMonto(n + i)}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button className={styles.btnDel} onClick={() => removeItem(idx)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className={styles.totalsRow}>
                            <td>Totales</td>
                            <td style={{ textAlign: 'right' }}>$ {formatMonto(totals.totalNeto)}</td>
                            <td></td>
                            <td style={{ textAlign: 'right' }}>$ {formatMonto(totals.totalIva)}</td>
                            <td style={{ textAlign: 'right' }}>$ {formatMonto(totals.totalGeneral)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className={styles.actions}>
                <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar Factura'}
                </button>
            </div>
        </div>
    );
};
