import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import styles from './Tareas.module.css';
import { Plus, Trash2, Calendar, Clock, User } from 'lucide-react';

interface Tarea {
    id: number;
    n_siniestro: string; // or number depending on DB
    texto: string;
    fecha: string | null;
    hora: string | null;
    hecha: boolean;
    creada_en: string;
    asignado_a: string | null; // This is the new field we'll use (or store in text if column missing)
}

interface TareasProps {
    nSiniestro: string;
    defaultAssignee?: string; // e.g. 'Analista' name
}

export const Tareas = ({ nSiniestro, defaultAssignee }: TareasProps) => {
    const [tasks, setTasks] = useState<Tarea[]>([]);
    const [loading, setLoading] = useState(true);
    const [analistas, setAnalistas] = useState<any[]>([]);

    // Form State
    const [desc, setDesc] = useState('');
    const [fecha, setFecha] = useState('');
    const [hora, setHora] = useState('');
    const [assignee, setAssignee] = useState(defaultAssignee || '');

    useEffect(() => {
        if (nSiniestro) {
            fetchTasks();
            fetchAnalistas();
        }
    }, [nSiniestro]);

    // Update form default if prop changes
    useEffect(() => {
        if (defaultAssignee && !assignee) {
            setAssignee(defaultAssignee);
        }
    }, [defaultAssignee]);

    const fetchTasks = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('tareas')
            .select('*')
            .eq('n_siniestro', nSiniestro)
            .order('creada_en', { ascending: false });

        if (error) {
            console.error("Error fetching tasks:", error);
        } else {
            setTasks(data || []);
        }
        setLoading(false);
    };

    const fetchAnalistas = async () => {
        const { data } = await supabase.from('analistas').select('*').eq('activo', 1);
        if (data) setAnalistas(data);
    };

    const handleAddTask = async () => {
        if (!desc.trim()) return alert("Ingresa una descripción para la tarea.");

        const newTask = {
            n_siniestro: nSiniestro,
            texto: desc,
            fecha: fecha || null,
            hora: hora || null,
            hecha: false,
            // If 'asignado_a' column does not exist in DB yet, this might error or be ignored depending on Supabase setting.
            // Assumption: User requested adding another assignee, implying data persistence.
            // Responsive approach: Send it. If DB fails, we might need a migration. 
            // For now, let's assume we might need to use a distinct field or just trust it works/fails gracefully.
            // To be safe and compliant with prior 'detalle.html' which DID NOT have this field, 
            // we will stick to what the schema likely supports UNLESS we added it.
            // However, the prompt implies "ACORDATE QUE LAS QUE SE CARGUEN... DEBEN QUEDAR ASIGNADAS".
            // Since we can't migrate DB easily here without explicit instruction, I will try to save it.
            // If it fails, I'll catch it.
            asignado_a: assignee
        };

        try {
            const { error } = await supabase.from('tareas').insert([newTask]);
            if (error) {
                // Fallback: maybe column doesn't exist? Try without it just in case?
                // Or just throw to let user know.
                console.error("Error adding task:", error);
                if (error.code === '42703') { // Undefined column
                    alert("Error: La base de datos no tiene el campo 'asignado_a'. Contacta al administrador.");
                } else {
                    alert(`Error al crear tarea: ${error.message || 'Error desconocido'}`);
                }
                return;
            }

            // Reset form and reload
            setDesc('');
            setFecha('');
            setHora('');
            fetchTasks();

        } catch (err) {
            console.error(err);
        }
    };

    const toggleTask = async (task: Tarea) => {
        const newVal = !task.hecha;
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, hecha: newVal } : t));

        const { error } = await supabase
            .from('tareas')
            .update({ hecha: newVal })
            .eq('id', task.id);

        if (error) {
            console.error("Error updating task:", error);
            fetchTasks(); // revert
        }
    };

    const deleteTask = async (id: number) => {
        if (!confirm("¿Eliminar tarea?")) return;

        // Optimistic
        setTasks(prev => prev.filter(t => t.id !== id));

        const { error } = await supabase
            .from('tareas')
            .delete()
            .eq('id', id);

        if (error) {
            console.error("Error deleting task:", error);
            fetchTasks();
        }
    };

    return (
        <div className={styles.wrapper}>
            <div className={styles.topBar}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                    <div className={styles.field}>
                        <span className={styles.fieldLabel}>Descripción</span>
                        <input
                            className={styles.input}
                            placeholder="Nueva tarea..."
                            value={desc}
                            onChange={(e) => setDesc(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                        />
                    </div>
                </div>

                <div className={styles.inputGroup}>
                    <div className={styles.field} style={{ width: '150px' }}>
                        <span className={styles.fieldLabel}>Fecha Límite</span>
                        <input
                            type="date"
                            className={styles.input}
                            value={fecha}
                            onChange={(e) => setFecha(e.target.value)}
                        />
                    </div>
                    <div className={styles.field} style={{ width: '120px' }}>
                        <span className={styles.fieldLabel}>Hora</span>
                        <input
                            type="time"
                            className={styles.input}
                            value={hora}
                            onChange={(e) => setHora(e.target.value)}
                        />
                    </div>
                    <div className={styles.field} style={{ flex: 1 }}>
                        <span className={styles.fieldLabel}>Asignado A</span>
                        <select
                            className={styles.input}
                            value={assignee}
                            onChange={e => setAssignee(e.target.value)}
                        >
                            <option value="">- Sin asignar -</option>
                            {analistas.map(a => (
                                <option key={a.id} value={a.nombre}>{a.nombre}</option>
                            ))}
                        </select>
                    </div>
                    <button className={styles.btnAdd} onClick={handleAddTask}>
                        <Plus size={18} /> Agregar
                    </button>
                </div>
            </div>

            <div className={styles.taskList}>
                {loading && <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted-color)' }}>Cargando tareas...</div>}

                {!loading && tasks.length === 0 && (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted-color)' }}>
                        No hay tareas pendientes.
                    </div>
                )}

                {tasks.map(t => (
                    <div key={t.id} className={`${styles.taskItem} ${t.hecha ? styles.hecha : ''}`}>
                        <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={t.hecha}
                            onChange={() => toggleTask(t)}
                        />
                        <div className={styles.taskContent}>
                            <span className={styles.taskText}>{t.texto}</span>
                            <div className={styles.taskMeta}>
                                {t.fecha && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Calendar size={12} /> {t.fecha}
                                    </span>
                                )}
                                {t.hora && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={12} /> {t.hora}
                                    </span>
                                )}
                                {t.asignado_a && (
                                    <span className={styles.badgeUser}>
                                        <User size={10} /> {t.asignado_a}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button className={styles.btnDelete} onClick={() => deleteTask(t.id)}>
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
