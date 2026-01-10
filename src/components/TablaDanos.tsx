import { useState, useEffect } from 'react';
import styles from './TablaDanos.module.css';
import { Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';

interface ItemDano {
    concepto: string;
    valorMercado: string | number;
    deduccionPorcentaje: string | number;
    montoIndemnizacion: string | number;
    esProveedor: boolean;
}

interface Cobertura {
    nombre: string;
    suma: string | number;
    items: ItemDano[];
}

interface TablaDanosProps {
    data: Cobertura[];
    onUpdate: (data: Cobertura[]) => void;
}

export const TablaDanos = ({ data, onUpdate }: TablaDanosProps) => {
    // Local state to handle edits before syncing up
    const [coberturas, setCoberturas] = useState<Cobertura[]>(data || []);

    useEffect(() => {
        // Map old data format to new format if necessary
        const mappedData = (data || []).map(cob => ({
            ...cob,
            items: (cob.items || []).map((item: any) => ({
                concepto: item.concepto || '',
                valorMercado: item.valorMercado || item.montoConvenido || '',
                deduccionPorcentaje: item.deduccionPorcentaje || '',
                montoIndemnizacion: item.montoIndemnizacion || '',
                esProveedor: item.esProveedor || false
            }))
        }));
        setCoberturas(mappedData);
    }, [data]);

    const handleUpdate = (newCoberturas: Cobertura[]) => {
        setCoberturas(newCoberturas);
        onUpdate(newCoberturas);
    };

    const addCobertura = () => {
        const nueva: Cobertura = { nombre: '', suma: '', items: [] };
        handleUpdate([...coberturas, nueva]);
    };

    const removeCobertura = (index: number) => {
        if (!confirm('¿Eliminar esta cobertura junto con sus ítems?')) return;
        const copy = [...coberturas];
        copy.splice(index, 1);
        handleUpdate(copy);
    };

    const updateCoberturaField = (index: number, field: keyof Cobertura, value: any) => {
        const copy = [...coberturas];
        copy[index] = { ...copy[index], [field]: value };
        handleUpdate(copy);
    };

    const addItem = (coberturaIndex: number) => {
        const copy = [...coberturas];
        if (!copy[coberturaIndex].items) copy[coberturaIndex].items = [];
        copy[coberturaIndex].items.push({
            concepto: '',
            valorMercado: '',
            deduccionPorcentaje: '',
            montoIndemnizacion: '',
            esProveedor: false
        });
        handleUpdate(copy);
    };

    const removeItem = (coberturaIndex: number, itemIndex: number) => {
        const copy = [...coberturas];
        copy[coberturaIndex].items.splice(itemIndex, 1);
        handleUpdate(copy);
    };

    const updateItem = (coberturaIndex: number, itemIndex: number, field: keyof ItemDano, value: any) => {
        const copy = [...coberturas];
        const items = [...copy[coberturaIndex].items];
        let newItem = { ...items[itemIndex], [field]: value };

        // Auto-calculate if valorMercado or deduccionPorcentaje changes
        if (field === 'valorMercado' || field === 'deduccionPorcentaje') {
            const vm = parseMonto(newItem.valorMercado);
            const porc = parseMonto(newItem.deduccionPorcentaje);
            if (vm > 0) {
                const calculated = vm * (1 - (porc / 100));
                newItem.montoIndemnizacion = calculated.toFixed(2);
            }
        }

        items[itemIndex] = newItem;
        copy[coberturaIndex].items = items;
        handleUpdate(copy);
    };

    const parseMonto = (val: string | number) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        let s = String(val).trim();
        s = s.replace(/\./g, '');
        s = s.replace(',', '.');
        const num = parseFloat(s);
        return isNaN(num) ? 0 : num;
    };

    // --- Totals Logic ---
    let totalAhorro = 0;
    let totalOrdenCompra = 0;
    let totalEfectivo = 0;

    coberturas.forEach(cob => {
        (cob.items || []).forEach(item => {
            const vm = parseMonto(item.valorMercado);
            const ind = parseMonto(item.montoIndemnizacion);
            totalAhorro += (vm - ind);
            if (item.esProveedor) {
                totalOrdenCompra += ind;
            } else {
                totalEfectivo += ind;
            }
        });
    });

    const totalPagado = totalEfectivo + totalOrdenCompra;

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);
    };

    return (
        <div className={styles.wrapper}>
            <div className={styles.topActions}>
                <button className={styles.btnAdd} onClick={addCobertura}>
                    <Plus size={16} /> Agregar Cobertura
                </button>
            </div>

            {coberturas.map((cob, idxCob) => {
                return (
                    <div key={idxCob} className={styles.cobertura}>
                        <div className={styles.cabecera}>
                            <div className={styles.coberturaInputGroup} style={{ flex: 2 }}>
                                <span className={styles.label}>Nombre Cobertura</span>
                                <input
                                    className={styles.input}
                                    value={cob.nombre}
                                    onChange={e => updateCoberturaField(idxCob, 'nombre', e.target.value)}
                                    placeholder="Ej: Robo TV"
                                />
                            </div>
                            <div className={styles.coberturaInputGroup} style={{ flex: 1 }}>
                                <span className={styles.label}>Suma Asegurada</span>
                                <input
                                    className={styles.input}
                                    value={cob.suma}
                                    onChange={e => updateCoberturaField(idxCob, 'suma', e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div className={styles.tableHeader}>
                            <div style={{ flex: 2 }}>Concepto</div>
                            <div style={{ flex: 1 }}>Valor Mercado</div>
                            <div style={{ flex: 0.8 }}>Franq/Desg %</div>
                            <div style={{ flex: 1 }}>Indemnización</div>
                            <div style={{ flex: 0.6, textAlign: 'center' }}>Proveedor</div>
                            <div style={{ width: '40px' }}></div>
                        </div>

                        {cob.items.map((item, idxItem) => (
                            <div key={idxItem} className={styles.itemRow}>
                                <input
                                    style={{ flex: 2 }}
                                    className={styles.input}
                                    value={item.concepto}
                                    onChange={e => updateItem(idxCob, idxItem, 'concepto', e.target.value)}
                                    placeholder="Descripción..."
                                />
                                <input
                                    style={{ flex: 1 }}
                                    className={styles.input}
                                    value={item.valorMercado}
                                    onChange={e => updateItem(idxCob, idxItem, 'valorMercado', e.target.value)}
                                    placeholder="0.00"
                                />
                                <input
                                    style={{ flex: 0.8 }}
                                    className={styles.input}
                                    value={item.deduccionPorcentaje}
                                    onChange={e => updateItem(idxCob, idxItem, 'deduccionPorcentaje', e.target.value)}
                                    placeholder="%"
                                />
                                <input
                                    style={{ flex: 1 }}
                                    className={styles.input}
                                    value={item.montoIndemnizacion}
                                    onChange={e => updateItem(idxCob, idxItem, 'montoIndemnizacion', e.target.value)}
                                    placeholder="0.00"
                                />
                                <div style={{ flex: 0.6, display: 'flex', justifyContent: 'center' }}>
                                    <button
                                        className={styles.btnAction}
                                        onClick={() => updateItem(idxCob, idxItem, 'esProveedor', !item.esProveedor)}
                                        style={{ color: item.esProveedor ? '#3699ff' : 'var(--muted-color)' }}
                                    >
                                        {item.esProveedor ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                                    </button>
                                </div>
                                <button className={styles.btnDelete} onClick={() => removeItem(idxCob, idxItem)}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}

                        <div className={styles.bottomActions}>
                            <button className={styles.btnAdd} style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => addItem(idxCob)}>
                                <Plus size={14} /> Ítem
                            </button>

                            <button className={styles.btnDeleteCobertura} onClick={() => removeCobertura(idxCob)}>
                                Eliminar Cobertura
                            </button>
                        </div>
                    </div>
                );
            })}

            {coberturas.length > 0 && (
                <div className={styles.summaryGrid}>
                    <div className={styles.summaryItem} style={{ color: '#10b981' }}>
                        <span className={styles.summaryLabel}>AHORRO TOTAL:</span>
                        <span className={styles.summaryValue}>{formatCurrency(totalAhorro)}</span>
                    </div>
                    <div className={styles.summaryItem} style={{ color: '#3699ff' }}>
                        <span className={styles.summaryLabel}>TOTAL ORDEN DE COMPRA:</span>
                        <span className={styles.summaryValue}>{formatCurrency(totalOrdenCompra)}</span>
                    </div>
                    <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>TOTAL EFECTIVO:</span>
                        <span className={styles.summaryValue}>{formatCurrency(totalEfectivo)}</span>
                    </div>
                    <div className={styles.summaryItem} style={{ borderTop: '2px solid var(--line-color)', marginTop: '10px', paddingTop: '10px', fontSize: '1.2em' }}>
                        <span className={styles.summaryLabel}>TOTAL PAGADO (Siniestro):</span>
                        <span className={styles.summaryValue}>{formatCurrency(totalPagado)}</span>
                    </div>
                </div>
            )}

            {coberturas.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted-color)' }}>
                    No hay coberturas cargadas. Agregá una para comenzar.
                </div>
            )}
        </div>
    );
};

