import { useState, useEffect } from 'react';
import styles from './Checklist.module.css';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ChecklistItem {
    text: string;
    checked: boolean;
}

interface ChecklistProps {
    data: ChecklistItem[];
    causa: string;
    isClosed?: boolean;
    onUpdate: (items: ChecklistItem[]) => void;
    onStatusUpdate?: (status: { estado?: string, sub_estado?: string, fecha_documentacion_completa?: string | null }) => void;
}

const CHECKLIST_MAP: Record<string, string[]> = {
    "ROBO EN VIA PUBLICA": ["DNI", "DENUNCIA POLICIAL", "BAJA DE IMEI", "ULTIMA ACTIVIDAD"],
    "DAÑO ELECTRODOMESTICOS": ["DNI", "FACTURA DE COMPRA", "INFORME TÉCNICO", "FOTOS DEL DAÑO"],
    "VARIACION DE TENSION": ["DNI", "FACTURA DE COMPRA", "INFORME TÉCNICO", "COMPROBANTE DE ESTABILIZADOR"]
};

const DEFAULT_ITEMS = ["DNI", "DOCUMENTACIÓN RESPALDATORIA", "FOTOS / PRUEBAS", "OBSERVACIONES"];

export const Checklist = ({ data, causa, isClosed = false, onUpdate, onStatusUpdate }: ChecklistProps) => {
    const { profile, user } = useAuth();
    const [items, setItems] = useState<ChecklistItem[]>([]);
    const [newItemText, setNewItemText] = useState('');

    const isAdmin = profile?.rol === 'Administrador' || user?.user_metadata?.rol === 'Administrador';
    const disabled = isClosed && !isAdmin;

    useEffect(() => {
        // Init logic: if data exists (and is array), use it.
        // If empty/null and we have a causa, load defaults.
        if (Array.isArray(data) && data.length > 0) {
            setItems(data);
        } else {
            // Load defaults based on causa
            const defaults = CHECKLIST_MAP[causa?.toUpperCase()] || DEFAULT_ITEMS;
            const initialItems = defaults.map(text => ({ text, checked: false }));
            setItems(initialItems);
            // We do NOT auto-save defaults yet to avoid polluting DB with empty states 
            // until user actually interacts, OR we could. Let's wait for interaction.
        }
    }, [data, causa]);

    const handleUpdate = (newItems: ChecklistItem[]) => {
        setItems(newItems);
        onUpdate(newItems);
    };

    const toggleItem = (index: number) => {
        const copy = [...items];
        copy[index].checked = !copy[index].checked;
        handleUpdate(copy);
    };

    const deleteItem = (index: number) => {
        const copy = [...items];
        copy.splice(index, 1);
        handleUpdate(copy);
    };

    const addItem = () => {
        if (!newItemText.trim()) return;
        const copy = [...items, { text: newItemText.trim(), checked: false }];
        handleUpdate(copy);
        setNewItemText('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            addItem();
        }
    };

    return (
        <div className={styles.wrapper}>
            <div className={styles.header}>
                <div className={styles.title}>Requisitos para: {causa || 'GENERAL'}</div>
                <div className={styles.subtitle}>Marcá los elementos recibidos o completados.</div>
            </div>

            <div className={styles.list}>
                {items.map((item, index) => (
                    <div
                        key={index}
                        className={`${styles.item} ${item.checked ? styles.checked : ''}`}
                    >
                        <div className={styles.itemLeft}>
                            <input
                                type="checkbox"
                                className={styles.checkbox}
                                checked={item.checked}
                                onChange={() => toggleItem(index)}
                                disabled={disabled}
                            />
                            <span className={styles.label}>{item.text}</span>
                        </div>
                        <button
                            className={styles.btnDelete}
                            onClick={() => deleteItem(index)}
                            title="Eliminar item"
                            disabled={disabled}
                            style={{ opacity: disabled ? 0.3 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>

            <div className={styles.inputRow}>
                <input
                    type="text"
                    className={styles.input}
                    placeholder="Agregar nuevo requisito..."
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                />
                <button className={styles.btnAdd} onClick={addItem} disabled={disabled} style={{ opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
                    <Plus size={16} /> Agregar
                </button>
            </div>

            <button
                className={styles.btnAdd}
                style={{
                    width: '100%',
                    marginTop: '25px',
                    background: '#10b981',
                    padding: '16px',
                    fontSize: '15px',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    opacity: (disabled || (!isAdmin && items.some(i => !i.checked))) ? 0.5 : 1,
                    cursor: (disabled || (!isAdmin && items.some(i => !i.checked))) ? 'not-allowed' : 'pointer'
                }}
                disabled={disabled || (!isAdmin && items.some(i => !i.checked))}
                onClick={() => {
                    const hoy = new Date().toISOString().split('T')[0];
                    onStatusUpdate?.({
                        sub_estado: 'ANALISIS',
                        fecha_documentacion_completa: hoy
                    });
                }}
            >
                {(!isAdmin && items.some(i => !i.checked)) ? 'Faltan requisitos' : 'Documentación completada'}
            </button>
        </div>
    );
};
