import { useState, useEffect } from 'react';
import styles from './TablaDanos.module.css';
import { Plus, Trash2 } from 'lucide-react';

interface ItemDano {
    concepto: string;
    montoConvenido: string | number;
    montoIndemnizacion: string | number;
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
        setCoberturas(data || []);
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
        copy[coberturaIndex].items.push({ concepto: '', montoConvenido: '', montoIndemnizacion: '' });
        handleUpdate(copy);
    };

    const removeItem = (coberturaIndex: number, itemIndex: number) => {
        const copy = [...coberturas];
        copy[coberturaIndex].items.splice(itemIndex, 1);
        handleUpdate(copy);
    };

    const updateItem = (coberturaIndex: number, itemIndex: number, field: keyof ItemDano, value: any) => {
        const copy = [...coberturas];
        // Ensure items array exists effectively
        const items = [...copy[coberturaIndex].items];
        items[itemIndex] = { ...items[itemIndex], [field]: value };
        copy[coberturaIndex].items = items;
        handleUpdate(copy);
    };

    // Helper: Parse string to float safely
    const parseMonto = (val: string | number) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        // Handle common formats: 1.000,00 or 1000.00
        // Best effort: remove dots (thousands), replace comma with dot
        let s = String(val).trim();
        s = s.replace(/\./g, '');
        s = s.replace(',', '.');
        const num = parseFloat(s);
        return isNaN(num) ? 0 : num;
    };

    const calculateTotalCobertura = (items: ItemDano[]) => {
        return items.reduce((sum, item) => sum + parseMonto(item.montoIndemnizacion), 0);
    };

    const totalGlobal = coberturas.reduce((sum, cob) => sum + calculateTotalCobertura(cob.items), 0);

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
                const totalCob = calculateTotalCobertura(cob.items);

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
                            <div>Concepto</div>
                            <div>Monto Convenido</div>
                            <div>Monto Indemnización</div>
                            <div></div>
                        </div>

                        {cob.items.map((item, idxItem) => (
                            <div key={idxItem} className={styles.itemRow}>
                                <input
                                    className={styles.input}
                                    value={item.concepto}
                                    onChange={e => updateItem(idxCob, idxItem, 'concepto', e.target.value)}
                                    placeholder="Descripción del daño..."
                                />
                                <input
                                    className={styles.input}
                                    value={item.montoConvenido}
                                    onChange={e => updateItem(idxCob, idxItem, 'montoConvenido', e.target.value)}
                                    placeholder="0.00"
                                />
                                <input
                                    className={styles.input}
                                    value={item.montoIndemnizacion}
                                    onChange={e => updateItem(idxCob, idxItem, 'montoIndemnizacion', e.target.value)}
                                    placeholder="0.00"
                                />
                                <button className={styles.btnDelete} onClick={() => removeItem(idxCob, idxItem)}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}

                        <div className={styles.bottomActions}>
                            <button className={styles.btnAdd} style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => addItem(idxCob)}>
                                <Plus size={14} /> Ítem
                            </button>

                            <div className={styles.totalRow}>
                                <span className={styles.label}>Total Cobertura:</span>
                                <span className={styles.totalValue}>{formatCurrency(totalCob)}</span>
                            </div>

                            <button className={styles.btnDeleteCobertura} onClick={() => removeCobertura(idxCob)}>
                                Eliminar Cobertura
                            </button>
                        </div>
                    </div>
                );
            })}

            {coberturas.length > 0 && (
                <div className={styles.globalTotal}>
                    TOTAL GLOBAL INDEMNIZACIÓN: {formatCurrency(totalGlobal)}
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
