import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Layout } from '../layouts/Layout';
import styles from './Tareas.module.css';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowUpDown } from 'lucide-react';

interface Tarea {
    id: number;
    n_siniestro: number;
    texto: string;
    fecha: string; // YYYY-MM-DD
    hora: string;
    hecha: boolean;
    creada_en: string;
    creada_por: string;
    asignado_a: string | null;
    casos: {
        id: number;
        asegurado: string;
        analista: string;
    };
}

export const Tareas = () => {
    const { user, profile } = useAuth();
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'pendientes' | 'hechas' | 'todas'>('pendientes');
    const [onlyMine, setOnlyMine] = useState(true);

    // Sorting
    const [sortCol, setSortCol] = useState<keyof Tarea | 'estado' | 'asegurado' | 'analista'>('fecha');
    const [sortAsc, setSortAsc] = useState(true);

    const userName = profile?.nombre || user?.user_metadata?.nombre || user?.email || '';

    useEffect(() => {
        fetchTareas();
    }, []);

    const fetchTareas = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('tareas')
                .select(`
                    *,
                    casos (
                        id,
                        asegurado,
                        analista
                    )
                `);

            if (error) throw error;
            setTareas(data as any[] || []);
        } catch (error: any) {
            console.error("Error fetching tasks:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleTask = async (id: number, currentStatus: boolean) => {
        // Optimistic update
        setTareas(prev => prev.map(t => t.id === id ? { ...t, hecha: !currentStatus } : t));

        const { error } = await supabase
            .from('tareas')
            .update({ hecha: !currentStatus })
            .eq('id', id);

        if (error) {
            alert("Error al actualizar tarea");
            // Revert
            setTareas(prev => prev.map(t => t.id === id ? { ...t, hecha: currentStatus } : t));
        }
    };

    const filteredTareas = useMemo(() => {
        return tareas.filter(t => {
            // Text Filter
            const s = search.toLowerCase();
            const matchesText =
                t.texto?.toLowerCase().includes(s) ||
                String(t.n_siniestro).includes(s) ||
                t.casos?.asegurado?.toLowerCase().includes(s) ||
                t.casos?.analista?.toLowerCase().includes(s) ||
                t.asignado_a?.toLowerCase().includes(s);

            if (!matchesText) return false;

            // Status Filter
            if (statusFilter === 'pendientes' && t.hecha) return false;
            if (statusFilter === 'hechas' && !t.hecha) return false;

            // My Tasks Filter
            if (onlyMine && userName) {
                const me = userName.toLowerCase();
                // Priority: Task assignee > Case Analyst
                const responsible = t.asignado_a || t.casos?.analista || '';
                if (!responsible.toLowerCase().includes(me) && !me.includes(responsible.toLowerCase())) return false;
            }

            return true;
        });
    }, [tareas, search, statusFilter, onlyMine, userName]);

    const sortedTareas = useMemo(() => {
        return [...filteredTareas].sort((a, b) => {
            let valA: any = a[sortCol as keyof Tarea];
            let valB: any = b[sortCol as keyof Tarea];

            if (sortCol === 'estado') {
                valA = a.hecha ? 1 : 0;
                valB = b.hecha ? 1 : 0;
            } else if (sortCol === 'asegurado') {
                valA = a.casos?.asegurado || '';
                valB = b.casos?.asegurado || '';
            } else if (sortCol === 'analista') {
                // Sort by displayed responsible person
                valA = a.asignado_a || a.casos?.analista || '';
                valB = b.asignado_a || b.casos?.analista || '';
            }

            if (valA < valB) return sortAsc ? -1 : 1;
            if (valA > valB) return sortAsc ? 1 : -1;
            return 0;
        });
    }, [filteredTareas, sortCol, sortAsc]);

    const handleSort = (col: any) => {
        if (sortCol === col) setSortAsc(!sortAsc);
        else {
            setSortCol(col);
            setSortAsc(true);
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "-";
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    };

    return (
        <Layout>
            <div className={styles.topBar}>
                <h2>Tareas Pendientes</h2>
                <p style={{ color: 'var(--muted-color)', fontSize: '14px' }}>Gestión global de tareas asignadas</p>
            </div>

            <div className={styles.panel}>
                <div className={styles.filtros}>
                    <input
                        type="text"
                        className={styles.input}
                        placeholder="Buscar tareas..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ minWidth: '300px' }}
                    />
                    <select
                        className={styles.select}
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as any)}
                    >
                        <option value="pendientes">Solo Pendientes</option>
                        <option value="hechas">Solo Hechas</option>
                        <option value="todas">Todas</option>
                    </select>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={onlyMine}
                            onChange={e => setOnlyMine(e.target.checked)}
                        />
                        <span>Solo mis casos</span>
                    </label>

                    <button className={styles.btnReset} onClick={() => {
                        setSearch('');
                        setStatusFilter('pendientes');
                        setOnlyMine(true);
                    }}>
                        Limpiar
                    </button>
                </div>
            </div>

            <div className={styles.tablaWrapper}>
                <table className={styles.table}>
                    <thead className={styles.thead}>
                        <tr>
                            <th className={styles.th} onClick={() => handleSort('n_siniestro')}>Siniestro <ArrowUpDown size={12} /></th>
                            <th className={styles.th} onClick={() => handleSort('asegurado')}>Asegurado <ArrowUpDown size={12} /></th>
                            <th className={styles.th} onClick={() => handleSort('analista')}>Analista <ArrowUpDown size={12} /></th>
                            <th className={styles.th} onClick={() => handleSort('texto')}>Tarea <ArrowUpDown size={12} /></th>
                            <th className={styles.th} onClick={() => handleSort('fecha')}>Fecha <ArrowUpDown size={12} /></th>
                            <th className={styles.th} onClick={() => handleSort('estado')}>Estado <ArrowUpDown size={12} /></th>
                            <th className={styles.th}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '20px' }}>Cargando tareas...</td>
                            </tr>
                        )}
                        {!loading && sortedTareas.length === 0 && (
                            <tr>
                                <td colSpan={7} className={styles.sinRegistros}>
                                    No se encontraron tareas con los filtros actuales.
                                </td>
                            </tr>
                        )}
                        {!loading && sortedTareas.map(t => (
                            <tr key={t.id} className={styles.tr}>
                                <td className={styles.td}>{t.n_siniestro}</td>
                                <td className={styles.td}>{t.casos?.asegurado || '-'}</td>
                                <td className={styles.td}>{t.asignado_a || t.casos?.analista || '-'}</td>
                                <td className={styles.td}>{t.texto}</td>
                                <td className={styles.td}>
                                    <div>{formatDate(t.fecha)}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--muted-color)' }}>{t.hora}</div>
                                </td>
                                <td className={styles.td}>
                                    <span className={`${styles.estadoPill} ${t.hecha ? styles.estadoHecha : styles.estadoPendiente}`}>
                                        {t.hecha ? 'HECHA' : 'PENDIENTE'}
                                    </span>
                                </td>
                                <td className={styles.td}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <input
                                            type="checkbox"
                                            className={styles.checkbox}
                                            checked={t.hecha}
                                            onChange={() => handleToggleTask(t.id, t.hecha)}
                                            title="Marcar como hecha/pendiente"
                                        />
                                        <Link to={`/detalle/${t.casos?.id}`} className={styles.linkCaso}>
                                            Ver Caso
                                        </Link>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className={styles.resumen}>
                Mostrando {sortedTareas.length} tarea(s). Total registradas: {tareas.length}.
            </div>
        </Layout>
    );
};
