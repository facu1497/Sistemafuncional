import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Layout } from '../layouts/Layout';
import styles from './Facturacion.module.css';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';

interface Factura {
    id: string; // or number, depends on DB. Usually UUID or int.
    n_siniestro: number;
    punto_venta: string;
    numero_factura: string;
    fecha_emision: string;
    cae: string;
    total_neto: number;
    total_iva: number;
    total_general: number;
    estado_pago: 'SIN_FACTURAR' | 'PENDIENTE' | 'PAGADA';
    fecha_cobro: string;
    orden_pago: string;
    casos: {
        id: number;
        asegurado: string;
        cia: string;
        analista: string;
    };
}

export const Facturacion = () => {
    const [facturas, setFacturas] = useState<Factura[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [periodoFilter, setPeriodoFilter] = useState('');
    const [analistaFilter, setAnalistaFilter] = useState('');
    const [ciaFilter, setCiaFilter] = useState('');

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Bulk Actions
    const [bulkOp, setBulkOp] = useState('');
    const [bulkFecha, setBulkFecha] = useState('');
    const [bulkEstado, setBulkEstado] = useState('');

    useEffect(() => {
        fetchFacturas();
    }, []);

    const fetchFacturas = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('facturas')
                .select(`
                    *,
                    casos (
                        id,
                        asegurado,
                        cia,
                        analista
                    )
                `);

            if (error) throw error;
            setFacturas(data as any[] || []);
        } catch (error: any) {
            console.error("Error fetching invoices:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateFactura = async (id: string, updates: Partial<Factura>) => {
        // Optimistic
        setFacturas(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));

        try {
            const { error } = await supabase
                .from('facturas')
                .update(updates)
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error("Error updating invoice:", error);
            fetchFacturas(); // Revert
        }
    };

    const handleBulkUpdate = async () => {
        if (selectedIds.size === 0) return alert("Seleccioná al menos una factura.");
        if (!confirm(`¿Actualizar ${selectedIds.size} facturas?`)) return;

        const updates: any = {};
        if (bulkOp) updates.orden_pago = bulkOp;
        if (bulkFecha) updates.fecha_cobro = bulkFecha;
        if (bulkEstado) updates.estado_pago = bulkEstado;

        if (Object.keys(updates).length === 0) return alert("Ingresá algún dato para actualizar.");

        try {
            const ids = Array.from(selectedIds);
            const { error } = await supabase
                .from('facturas')
                .update(updates)
                .in('id', ids);

            if (error) throw error;

            // Clean selection and reload
            setSelectedIds(new Set());
            setBulkOp('');
            setBulkFecha('');
            setBulkEstado('');
            fetchFacturas();

        } catch (error: any) {
            alert("Error actualización masiva: " + error.message);
        }
    };

    const filteredFacturas = useMemo(() => {
        return facturas.filter(f => {
            // Search
            const s = search.toLowerCase();
            const blob = [
                String(f.n_siniestro),
                f.casos?.asegurado,
                f.casos?.cia,
                f.casos?.analista,
                f.punto_venta,
                f.numero_factura,
                f.orden_pago
            ].join(' ').toLowerCase();

            if (s && !blob.includes(s)) return false;

            // Filters
            if (statusFilter && f.estado_pago !== statusFilter) return false;
            if (periodoFilter && !f.fecha_emision?.startsWith(periodoFilter)) return false;
            if (analistaFilter && !f.casos?.analista?.toLowerCase().includes(analistaFilter.toLowerCase())) return false;
            if (ciaFilter && !f.casos?.cia?.toLowerCase().includes(ciaFilter.toLowerCase())) return false;

            return true;
        });
    }, [facturas, search, statusFilter, periodoFilter, analistaFilter, ciaFilter]);

    // Sorting logic skipped for brevity, but same pattern as Tareas
    // We will just verify selection toggle

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const getResumen = (list: Factura[]) => {
        const total = list.reduce((acc, curr) => acc + (curr.total_general || 0), 0);
        const pendiente = list.filter(f => f.estado_pago === 'PENDIENTE').reduce((acc, curr) => acc + (curr.total_general || 0), 0);
        const pagado = list.filter(f => f.estado_pago === 'PAGADA').reduce((acc, curr) => acc + (curr.total_general || 0), 0);
        return { total, pendiente, pagado };
    };

    const resumen = getResumen(filteredFacturas);

    return (
        <Layout>
            <div className={styles.topBar}>
                <h2>Facturación</h2>
                <p style={{ color: 'var(--muted-color)', fontSize: '14px' }}>Control de facturas, pagos y cobranzas.</p>
            </div>

            {/* FILTROS */}
            <div className={styles.panel}>
                <div className={styles.panelTitle}>Filtros</div>
                <div className={styles.filtros}>
                    <div className={styles.field}>
                        <label className={styles.label}>Buscar</label>
                        <input className={styles.input} placeholder="Siniestro, asegurado, OP..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Estado</label>
                        <select className={styles.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="">(Todos)</option>
                            <option value="SIN_FACTURAR">Sin facturar</option>
                            <option value="PENDIENTE">Pendiente</option>
                            <option value="PAGADA">Pagada</option>
                        </select>
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Período</label>
                        <input type="month" className={styles.input} value={periodoFilter} onChange={e => setPeriodoFilter(e.target.value)} />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Analista</label>
                        <input className={styles.input} placeholder="Nombre..." value={analistaFilter} onChange={e => setAnalistaFilter(e.target.value)} />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Compañía</label>
                        <input className={styles.input} placeholder="Compañía..." value={ciaFilter} onChange={e => setCiaFilter(e.target.value)} />
                    </div>
                    <button className={styles.btnAction} onClick={() => {
                        setSearch('');
                        setStatusFilter('');
                        setPeriodoFilter('');
                        setAnalistaFilter('');
                        setCiaFilter('');
                    }}>Limpiar</button>
                    <button className={styles.btnAction}>
                        <Download size={16} /> Exportar
                    </button>
                </div>
            </div>

            {/* ACCIONES MASIVAS */}
            <div className={styles.panel}>
                <div className={styles.panelTitle}>Acciones Masivas</div>
                <div className={styles.filtros}>
                    <div className={styles.field}>
                        <label className={styles.label}>Orden de Pago</label>
                        <input className={styles.input} value={bulkOp} onChange={e => setBulkOp(e.target.value)} placeholder="OP-XXXX" />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Fecha Cobro</label>
                        <input type="date" className={styles.input} value={bulkFecha} onChange={e => setBulkFecha(e.target.value)} />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Estado</label>
                        <select className={styles.select} value={bulkEstado} onChange={e => setBulkEstado(e.target.value)}>
                            <option value="">(No cambiar)</option>
                            <option value="PENDIENTE">Pendiente</option>
                            <option value="PAGADA">Pagada</option>
                        </select>
                    </div>
                    <button className={`${styles.btnAction} ${styles.btnApply}`} onClick={handleBulkUpdate}>
                        Aplicar a {selectedIds.size} seleccionados
                    </button>
                </div>
            </div>

            {/* TABLA */}
            <div className={styles.tablaWrapper}>
                <table className={styles.table}>
                    <thead className={styles.thead}>
                        <tr>
                            <th className={styles.th} style={{ textAlign: 'center', width: '30px' }}>
                                <input
                                    type="checkbox"
                                    onChange={e => {
                                        if (e.target.checked) setSelectedIds(new Set(filteredFacturas.map(f => f.id)));
                                        else setSelectedIds(new Set());
                                    }}
                                    checked={filteredFacturas.length > 0 && selectedIds.size === filteredFacturas.length}
                                />
                            </th>
                            <th className={styles.th}>N° Sin.</th>
                            <th className={styles.th}>Asegurado</th>
                            <th className={styles.th}>Compañía</th>
                            <th className={styles.th}>Analista</th>
                            <th className={styles.th}>F. Emisión</th>
                            <th className={styles.th}>Factura</th>
                            <th className={`${styles.th} ${styles.colNum}`}>Total</th>
                            <th className={styles.th}>Estado</th>
                            <th className={styles.th}>Cobro / OP</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && <tr><td colSpan={10} style={{ textAlign: 'center', padding: '20px' }}>Cargando...</td></tr>}
                        {!loading && filteredFacturas.length === 0 && (
                            <tr><td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: 'var(--muted-color)' }}>No hay facturas.</td></tr>
                        )}
                        {!loading && filteredFacturas.map(f => (
                            <tr key={f.id} className={`${styles.tr} ${selectedIds.has(f.id) ? styles.trSelected : ''}`}>
                                <td className={styles.td} style={{ textAlign: 'center' }}>
                                    <input type="checkbox" checked={selectedIds.has(f.id)} onChange={() => toggleSelect(f.id)} />
                                </td>
                                <td className={styles.td}>
                                    <Link to={`/detalle/${f.casos?.id}`} className={styles.linkCaso}>{f.n_siniestro}</Link>
                                </td>
                                <td className={styles.td}>{f.casos?.asegurado || '-'}</td>
                                <td className={styles.td}>{f.casos?.cia || '-'}</td>
                                <td className={styles.td}>{f.casos?.analista || '-'}</td>
                                <td className={styles.td}>{f.fecha_emision ? new Date(f.fecha_emision).toLocaleDateString() : '-'}</td>
                                <td className={styles.td}>{f.punto_venta}-{f.numero_factura}</td>
                                <td className={`${styles.td} ${styles.colNum}`}>$ {f.total_general?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                <td className={styles.td}>
                                    <span className={`${styles.estadoPill} ${f.estado_pago === 'PAGADA' ? styles.estadoPagada :
                                        f.estado_pago === 'PENDIENTE' ? styles.estadoPendiente : styles.estadoSin
                                        }`}>
                                        {f.estado_pago || 'SIN FACTURAR'}
                                    </span>
                                </td>
                                <td className={styles.td}>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <input
                                            className={styles.inputInline}
                                            value={f.orden_pago || ''}
                                            placeholder="OP"
                                            onChange={e => handleUpdateFactura(f.id, { orden_pago: e.target.value })}
                                            style={{ width: '80px' }}
                                        />
                                        <select
                                            className={styles.selectInline}
                                            value={f.estado_pago || 'SIN_FACTURAR'}
                                            onChange={e => handleUpdateFactura(f.id, { estado_pago: e.target.value as any })}
                                        >
                                            <option value="SIN_FACTURAR">S/F</option>
                                            <option value="PENDIENTE">Pend.</option>
                                            <option value="PAGADA">Pagada</option>
                                        </select>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className={styles.resumen}>
                Facturas listadas: <strong>{filteredFacturas.length}</strong> |
                Total facturado: <strong>$ {resumen.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong> |
                Pendiente: <strong>$ {resumen.pendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong> |
                Cobrado: <strong>$ {resumen.pagado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
            </div>

        </Layout>
    );
};
