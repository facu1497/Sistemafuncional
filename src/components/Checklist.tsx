import { useState, useEffect } from 'react';
import styles from './Checklist.module.css';
import { Plus, Trash2, CheckSquare } from 'lucide-react';

interface ChecklistItem {
    text: string;
    checked: boolean;
}

interface ChecklistProps {
    data: ChecklistItem[];
    causa: string;
    onUpdate: (items: ChecklistItem[]) => void;
}

const CHECKLIST_MAP: Record<string, string[]> = {
    "ROBO EN VIA PUBLICA": ["DNI", "DENUNCIA POLICIAL", "BAJA DE IMEI", "ULTIMA ACTIVIDAD"],
    "DAÑO ELECTRODOMESTICOS": ["DNI", "FACTURA DE COMPRA", "INFORME TÉCNICO", "FOTOS DEL DAÑO"],
    "VARIACION DE TENSION": ["DNI", "FACTURA DE COMPRA", "INFORME TÉCNICO", "COMPROBANTE DE ESTABILIZADOR"]
};

const DEFAULT_ITEMS = ["DNI", "DOCUMENTACIÓN RESPALDATORIA", "FOTOS / PRUEBAS", "OBSERVACIONES"];

export const Checklist = ({ data, causa, onUpdate }: ChecklistProps) => {
    const [items, setItems] = useState<ChecklistItem[]>([]);
    const [newItemText, setNewItemText] = useState('');

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
                            />
                            <span className={styles.label}>{item.text}</span>
                        </div>
                        <button
                            className={styles.btnDelete}
                            onClick={() => deleteItem(index)}
                            title="Eliminar item"
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
                />
                <button className={styles.btnAdd} onClick={addItem}>
                    <Plus size={16} /> Agregar
                </button>
            </div>
        </div>
    );
};
