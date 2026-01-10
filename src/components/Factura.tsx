import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import styles from './Factura.module.css';
import { Trash2, Download, FileText } from 'lucide-react';
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

interface FacturaProps {
    nSiniestro: string;
    onSave?: () => void;
}

const IVA_ALICUOTA = 0.21;
const BUCKET = 'documentos';

export const Factura = ({ nSiniestro, onSave }: FacturaProps) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [existingFile, setExistingFile] = useState<{ name: string, url: string } | null>(null);

    // Header Fields
    const [pv, setPv] = useState('');
    const [nf, setNf] = useState('');
    const [fecha, setFecha] = useState('');
    const [cae, setCae] = useState('');

    // Items
    const [items, setItems] = useState<FacturaItem[]>([{ concepto: '', neto: 0, aplicaIva: true }]);

    useEffect(() => {
        if (nSiniestro) {
            loadFactura();
            fetchExistingFile();
        }
    }, [nSiniestro]);

    const fetchExistingFile = async () => {
        try {
            const { data: files } = await supabase.storage.from(BUCKET).list(`casos/${nSiniestro}`);
            if (files) {
                const invoiceFile = files
                    .filter(f => f.name.startsWith('FACTURA_'))
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

                if (invoiceFile) {
                    const { data } = supabase.storage.from(BUCKET).getPublicUrl(`casos/${nSiniestro}/${invoiceFile.name}`);
                    setExistingFile({ name: invoiceFile.name, url: data.publicUrl });
                }
            }
        } catch (err) {
            console.error("Error fetching existing invoice file:", err);
        }
    };

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
        const { totalNeto, totalIva, totalGeneral } = calculateTotals();
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

    const handleFileDrop = async (files: File[]) => {
        const file = files[0];
        if (!file) return;

        try {
            setLoading(true);

            // 1. Upload file to storage
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const fileName = `FACTURA_${Date.now()}_${sanitizedName}`;
            const filePath = `casos/${nSiniestro}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from(BUCKET)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                console.error("Error uploading invoice file:", uploadError);
                alert(`Error al subir archivo de factura: ${uploadError.message}. Se intentará procesar los datos igualmente.`);
            } else {
                const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
                setExistingFile({ name: file.name, url: data.publicUrl });
            }

            // 2. Parse PDF contents
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            let fullText = "";
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const strings = textContent.items.map((item: any) => item.str);
                fullText += strings.join(" ") + " ";
            }

            const cabecera = procesarCabeceraFactura(fullText);
            const nuevosItems = extraerItemsDesdeTextoFactura(fullText);

            if (cabecera.pv) setPv(cabecera.pv);
            if (cabecera.nf) setNf(cabecera.nf);
            if (cabecera.fecha) setFecha(cabecera.fecha);
            if (cabecera.cae) setCae(cabecera.cae);

            if (nuevosItems && nuevosItems.length > 0) {
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

    const handleDownload = () => {
        if (existingFile) {
            window.open(existingFile.url, '_blank');
        }
    };

    if (loading) return <div style={{ color: 'var(--muted-color)', padding: '20px' }}>Cargando...</div>;

    return (
        <div className={styles.wrapper}>
            <div className={styles.pdfBox} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className={styles.pdfLabel}>Auto-completar desde PDF:</span>
                    {existingFile && (
                        <button
                            onClick={handleDownload}
                            className={styles.btn}
                            style={{
                                padding: '4px 10px',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'rgba(54, 153, 255, 0.1)',
                                borderColor: 'rgba(54, 153, 255, 0.2)',
                                color: '#3699ff'
                            }}
                        >
                            <FileText size={14} /> Ver Factura Actual <Download size={14} />
                        </button>
                    )}
                </div>
                <Dropzone
                    onFileSelect={handleFileDrop}
                    label={existingFile ? existingFile.name : "Arrastrá tu factura aquí (PDF)"}
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

