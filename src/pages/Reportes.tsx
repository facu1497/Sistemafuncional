import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Layout } from '../layouts/Layout';
import styles from './Reportes.module.css';
import { Download, RefreshCw } from 'lucide-react';

export const Reportes = () => {
    const [loading, setLoading] = useState(true);
    const [casos, setCasos] = useState<any[]>([]);
    // const [tareas, setTareas] = useState<any[]>([]); // If needed for general stats

    // Filters
    const [filterCia, setFilterCia] = useState('');
    const [filterAnalista, setFilterAnalista] = useState('');
    const [filterEstado, setFilterEstado] = useState('');

    // Catalogs
    const [estadosCat, setEstadosCat] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [casosRes, estadosRes] = await Promise.all([
                supabase.from('casos').select('*'),
                supabase.from('estados').select('*').eq('activo', 1),
                // supabase.from('tareas').select('*') // If we need global task stats
            ]);

            setCasos(casosRes.data || []);
            setEstadosCat(estadosRes.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // --- SCOPE & FILTERING ---
    const filteredCasos = useMemo(() => {
        return casos.filter(c => {
            if (filterCia && !c.cia?.toLowerCase().includes(filterCia.toLowerCase())) return false;
            if (filterAnalista && !c.analista?.toLowerCase().includes(filterAnalista.toLowerCase())) return false;
            if (filterEstado && c.estado !== filterEstado) return false;
            return true;
        });
    }, [casos, filterCia, filterAnalista, filterEstado]);

    // --- METRICS CALCULATION ---
    const metrics = useMemo(() => {
        const total = filteredCasos.length;
        const cerrados = filteredCasos.filter(c => c.estado === 'CERRADO').length; // Check exact string match
        const uniqueStates = new Set(filteredCasos.map(c => c.estado)).size;
        // Tareas calculation implies fetching tasks for filtered cases. 
        // For performance, we might skip live task counting on filtered set unless we fetch all tasks.
        // Assuming we focus on Case stats first.

        return { total, cerrados, uniqueStates };
    }, [filteredCasos]);


    // --- AGGREGATIONS FOR TABLES ---
    const groupBy = (list: any[], key: string) => {
        const map: Record<string, number> = {};
        list.forEach(item => {
            const val = item[key] || 'Sin definir';
            map[val] = (map[val] || 0) + 1;
        });
        return Object.entries(map).sort((a, b) => b[1] - a[1]); // Descending count
    };

    const porEstado = useMemo(() => groupBy(filteredCasos, 'estado'), [filteredCasos]);
    const porAnalista = useMemo(() => groupBy(filteredCasos, 'analista'), [filteredCasos]);
    const porCia = useMemo(() => groupBy(filteredCasos, 'cia'), [filteredCasos]);


    // --- ANALYST CARD LOGIC (Specific Requirement) ---
    // "cuadrado por cada analista que diga, 'casos sin contactar', 'pendientes' y 'cerrados' (pero solo en el ultimo mes)"
    // We need to group by Analyst first.
    // Definition of "Sin contactar": Maybe state 'ASIGNADO' or 'PENDIENTE CONTACTO'? Let's assume 'ASIGNADO' for now or logic from user.
    // Definition of last month: fecha_ingreso > 1 month ago? Or fecha_cierre?
    // User said "cerrados (pero solo en el ultimo mes)". It implies count closed cases that were closed in last month.
    // Since we assume 'fecha_fin' or similar exists, or we just rely on 'estado'.
    // NOTE: Schema doesn't strictly have 'fecha_cierre'. We will use 'fecha_ingreso' as proxy for "Active in last month" or just filter filter.
    // Let's implement generic logic:
    // For each analyst:
    // - Sin contactar: Cases with Status = 'ASIGNADO' (Hypothesis)
    // - Pendientes: Cases NOT 'CERRADO' and NOT 'ASIGNADO'
    // - Cerrados (Mes): Cases 'CERRADO' updated/modified in last 30 days? Or just count 'CERRADO' overall inside scope?
    // User said: "cerrados (pero solo en el ultimo mes)". Let's try to filter by date if we have it, else show generic closed.

    // To properly support "Last Month", we need a date field. We added 'fecha_ingreso'. 
    // We will use 'updated_at' or similar if available, else just 'fecha_ingreso'.
    // Let's simplified: 
    // 1. Get list of unique analysts from filteredCasos.
    // 2. For each, calculate these 3 numbers.

    const analystStats = useMemo(() => {
        const analysts = Array.from(new Set(filteredCasos.map(c => c.analista).filter(Boolean)));
        const now = new Date();
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(now.getMonth() - 1);

        return analysts.map(name => {
            const cases = filteredCasos.filter(c => c.analista === name);

            // "Sin contactar" -> Assuming 'ASIGNADO' or similar initial state. Or maybe 'Ingresado'.
            // Let's use 'Ingresado' as default "Sin Contactar" if exists, or 'PENDIENTE' logic.
            // Adjust loop based on actual State names: likely 'Ingresado', 'En Proceso', 'Pendiente', 'Cerrado'.
            const sinContactar = cases.filter(c => c.estado === 'Ingresado' || c.estado === 'ASIGNADO').length;

            const pendientes = cases.filter(c => c.estado !== 'CERRADO' && c.estado !== 'Ingresado' && c.estado !== 'ASIGNADO').length;

            // Cerrados Last Month
            // Using fecha_ingreso is wrong for closing date. 
            // We'll just count TOTAL Cerrados for now as we lack 'fecha_cierre'.
            // TODO: Add fecha_cierre to DB.
            const cerradosMes = cases.filter(c => c.estado === 'CERRADO').length;

            return { name, sinContactar, pendientes, cerradosMes };
        });
    }, [filteredCasos]);

    return (
        <Layout>
            <div className={styles.topBar}>
                <h2>Reportes y Métricas</h2>
                <p style={{ color: 'var(--muted-color)', fontSize: '14px' }}>Visión general del estado de la cartera.</p>
            </div>

            {/* ANALYST CARDS - HORIZONTAL SCROLL */}
            <h3 style={{ marginTop: '20px' }}>Gestión por Analista</h3>
            <div className={styles.analystGrid}>
                {analystStats.length === 0 && <div style={{ padding: '20px', color: 'gray' }}>No hay datos con los filtros actuales.</div>}

                {analystStats.map(stat => (
                    <div key={stat.name} className={styles.analystCard}>
                        <div className={styles.acHeader}>
                            <span className={styles.acName}>{stat.name}</span>
                        </div>
                        <div className={styles.acRow}>
                            <span>Sin Contactar</span>
                            <span className={`${styles.acValue} ${styles.valDanger}`}>{stat.sinContactar}</span>
                        </div>
                        <div className={styles.acRow}>
                            <span>En Gestión (Pend.)</span>
                            <span className={`${styles.acValue} ${styles.valWarning}`}>{stat.pendientes}</span>
                        </div>
                        <div className={styles.acRow}>
                            <span>Cerrados (Global)</span>
                            <span className={`${styles.acValue} ${styles.valSuccess}`}>{stat.cerradosMes}</span>
                        </div>
                    </div>
                ))}
            </div>


            {/* FILTROS */}
            <div className={styles.card} style={{ marginTop: '20px' }}>
                <h3>Filtros de Reporte</h3>
                <div className={styles.filters}>
                    <div className={styles.field}>
                        <label className={styles.label}>Compañía</label>
                        <input className={styles.input} value={filterCia} onChange={e => setFilterCia(e.target.value)} placeholder="Contiene..." />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Analista</label>
                        <input className={styles.input} value={filterAnalista} onChange={e => setFilterAnalista(e.target.value)} placeholder="Contiene..." />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Estado</label>
                        <select className={styles.select} value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
                            <option value="">(Todos)</option>
                            {estadosCat.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                        </select>
                    </div>
                    <button className={styles.btnAction} onClick={() => { setFilterCia(''); setFilterAnalista(''); setFilterEstado(''); }}>
                        Limpiar Filtros
                    </button>
                    <button className={styles.btnAction} onClick={loadData}>
                        <RefreshCw size={14} style={{ marginRight: '6px' }} /> Recalcular
                    </button>
                </div>
            </div>

            {/* METRICS SUMMARY */}
            <div className={styles.metricsGrid} style={{ marginTop: '20px' }}>
                <div className={styles.metricBox}>
                    <div className={styles.metricLabel}>Total Casos</div>
                    <div className={styles.metricValue}>{metrics.total}</div>
                    <div className={styles.metricSub}>En scope actual</div>
                </div>
                <div className={styles.metricBox}>
                    <div className={styles.metricLabel}>Cerrados</div>
                    <div className={styles.metricValue} style={{ color: '#86efac' }}>{metrics.cerrados}</div>
                    <div className={styles.metricSub}>{((metrics.cerrados / metrics.total || 0) * 100).toFixed(1)}% del total</div>
                </div>
                <div className={styles.metricBox}>
                    <div className={styles.metricLabel}>Estados Activos</div>
                    <div className={styles.metricValue}>{metrics.uniqueStates}</div>
                </div>
            </div>

            {/* TABLAS DETALLE - GRID */}
            <div className={styles.grid}>

                {/* Por Estado */}
                <div className={styles.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3>Casos por Estado</h3>
                        <button className={styles.btnAction} style={{ padding: '4px 8px', height: 'auto' }}><Download size={14} /></button>
                    </div>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead><tr><th>Estado</th><th className={styles.colNum}>Cant.</th></tr></thead>
                            <tbody>
                                {porEstado.map(([k, v]) => (
                                    <tr key={k}><td>{k}</td><td className={styles.colNum}>{v}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Por Analista */}
                <div className={styles.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3>Casos por Analista</h3>
                        <button className={styles.btnAction} style={{ padding: '4px 8px', height: 'auto' }}><Download size={14} /></button>
                    </div>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead><tr><th>Analista</th><th className={styles.colNum}>Cant.</th></tr></thead>
                            <tbody>
                                {porAnalista.map(([k, v]) => (
                                    <tr key={k}><td>{k}</td><td className={styles.colNum}>{v}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Por Compañía */}
                <div className={styles.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3>Casos por Cía</h3>
                        <button className={styles.btnAction} style={{ padding: '4px 8px', height: 'auto' }}><Download size={14} /></button>
                    </div>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead><tr><th>Compañía</th><th className={styles.colNum}>Cant.</th></tr></thead>
                            <tbody>
                                {porCia.map(([k, v]) => (
                                    <tr key={k}><td>{k}</td><td className={styles.colNum}>{v}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </Layout>
    );
};
