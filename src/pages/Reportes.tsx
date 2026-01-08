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
    const [filterMes, setFilterMes] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // Catalogs
    const [estadosCat, setEstadosCat] = useState<any[]>([]);
    const [companiasCat, setCompaniasCat] = useState<any[]>([]);
    const [analistasCat, setAnalistasCat] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [casosRes, estadosRes, ciaRes, anaRes] = await Promise.all([
                supabase.from('casos').select('*'),
                supabase.from('estados').select('*').eq('activo', 1),
                supabase.from('companias').select('*').eq('activo', 1),
                supabase.from('analistas').select('*').eq('activo', 1)
            ]);

            setCasos(casosRes.data || []);
            setEstadosCat(estadosRes.data || []);
            setCompaniasCat(ciaRes.data || []);
            setAnalistasCat(anaRes.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // --- SCOPE & FILTERING ---
    const filteredCasos = useMemo(() => {
        return casos.filter(c => {
            if (filterCia && c.cia !== filterCia) return false;
            if (filterAnalista && c.analista !== filterAnalista) return false;
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
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        return analysts.map(name => {
            const cases = filteredCasos.filter(c => c.analista === name);

            const sinContactar = cases.filter(c => c.estado === 'ENTREVISTAR').length;

            const pendientes = cases.filter(c => c.estado === 'EN GESTION').length;

            // Cerrados Last Month (using newly added fecha_cierre)
            const cerradosMes = cases.filter(c => {
                if (c.estado !== 'CERRADO') return false;
                if (!c.fecha_cierre) return false;
                const d = new Date(c.fecha_cierre);
                return d >= firstDayOfMonth;
            }).length;

            return { name, sinContactar, pendientes, cerradosMes };
        });
    }, [filteredCasos]);

    const activityMetrics = useMemo(() => {
        if (!filterMes) return { ingresados: 0, entrevistados: 0, documentados: 0, cerrados: 0 };

        const target = filterMes; // YYYY-MM

        const countInMonth = (list: any[], dateField: string) => {
            return list.filter(c => c[dateField] && c[dateField].startsWith(target)).length;
        };

        return {
            ingresados: countInMonth(casos, 'fecha_ingreso'),
            entrevistados: countInMonth(casos, 'fecha_entrevista'),
            documentados: countInMonth(casos, 'fecha_documentacion_completa'),
            cerrados: countInMonth(casos, 'fecha_cierre')
        };
    }, [casos, filterMes]);

    if (loading) return (
        <Layout>
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted-color)' }}>
                Cargando métricas...
            </div>
        </Layout>
    );

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
                            <span>Cerrados (Mes)</span>
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
                        <select className={styles.select} value={filterCia} onChange={e => setFilterCia(e.target.value)}>
                            <option value="">(Todas)</option>
                            {companiasCat.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                        </select>
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Analista</label>
                        <select className={styles.select} value={filterAnalista} onChange={e => setFilterAnalista(e.target.value)}>
                            <option value="">(Todos)</option>
                            {analistasCat.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                        </select>
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Estado</label>
                        <select className={styles.select} value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
                            <option value="">(Todos)</option>
                            {estadosCat.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                        </select>
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Actividad del Mes</label>
                        <input
                            type="month"
                            className={styles.input}
                            value={filterMes}
                            onChange={e => setFilterMes(e.target.value)}
                        />
                    </div>
                    <button className={styles.btnAction} onClick={() => { setFilterCia(''); setFilterAnalista(''); setFilterEstado(''); setFilterMes(new Date().toISOString().slice(0, 7)); }}>
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

            {/* MONTHLY ACTIVITY SUMMARY */}
            <h3 style={{ marginTop: '30px' }}>Resumen de Actividad: {filterMes}</h3>
            <div className={styles.metricsGrid} style={{ marginTop: '10px' }}>
                <div className={styles.metricBox} style={{ borderLeft: '4px solid #3699ff' }}>
                    <div className={styles.metricLabel}>Ingresados</div>
                    <div className={styles.metricValue}>{activityMetrics.ingresados}</div>
                    <div className={styles.metricSub}>En el mes seleccionado</div>
                </div>
                <div className={styles.metricBox} style={{ borderLeft: '4px solid #ef4444' }}>
                    <div className={styles.metricLabel}>Entrevistados</div>
                    <div className={styles.metricValue}>{activityMetrics.entrevistados}</div>
                    <div className={styles.metricSub}>En el mes seleccionado</div>
                </div>
                <div className={styles.metricBox} style={{ borderLeft: '4px solid #f59e0b' }}>
                    <div className={styles.metricLabel}>Doc. Completas</div>
                    <div className={styles.metricValue}>{activityMetrics.documentados}</div>
                    <div className={styles.metricSub}>En el mes seleccionado</div>
                </div>
                <div className={styles.metricBox} style={{ borderLeft: '4px solid #10b981' }}>
                    <div className={styles.metricLabel}>Cerrados (Salidos)</div>
                    <div className={styles.metricValue}>{activityMetrics.cerrados}</div>
                    <div className={styles.metricSub}>En el mes seleccionado</div>
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
