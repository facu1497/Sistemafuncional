import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../layouts/Layout';
import { supabase } from '../supabaseClient';
import styles from './Detalle.module.css';
import { ChevronLeft } from 'lucide-react';
import { TablaDanos } from '../components/TablaDanos';
import { Checklist } from '../components/Checklist';
import { Tareas } from '../components/Tareas';
import { Factura } from '../components/Factura';
import { Documentacion } from '../components/Documentacion';
import { Comentarios } from '../components/Comentarios';
import { Gestion } from '../components/Gestion';
import { InfoCaso } from '../components/InfoCaso';

export const Detalle = () => {
    const { id } = useParams();
    const [activeTab, setActiveTab] = useState('info');
    const [caso, setCaso] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refreshTasks, setRefreshTasks] = useState(0); // Key to force refresh Tareas component
    const [catalogs, setCatalogs] = useState<{ analistas: any[], companias: any[], estados: any[] }>({ analistas: [], companias: [], estados: [] });

    useEffect(() => {
        if (id) {
            fetchCaso(id);
            loadCatalogs();
        }
    }, [id]);

    const loadCatalogs = async () => {
        try {
            const [resA, resC, resE] = await Promise.all([
                supabase.from('analistas').select('nombre'),
                supabase.from('companias').select('nombre'),
                supabase.from('estados').select('*').eq('activo', 1)
            ]);
            setCatalogs({
                analistas: resA.data || [],
                companias: resC.data || [],
                estados: resE.data || []
            });
        } catch (err) {
            console.error("Error fetching catalogs:", err);
        }
    };

    const fetchCaso = async (casoId: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('casos')
                .select('*')
                .eq('id', casoId) // or n_siniestro, depending on routing
                .single();

            if (error) throw error;
            setCaso(data);
        } catch (err) {
            console.error("Error fetching case:", err);
            // Handle error (redirect or show msg)
        } finally {
            setLoading(false);
        }
    };

    const createAutoTask = async (nSiniestro: string | number, analista: string | null, estado: string, subEstado?: string) => {
        if (!nSiniestro) {
            console.warn("Cannot create auto task: nSiniestro is missing");
            return;
        }
        const texto = subEstado ? `${estado} - ${subEstado}` : estado;

        try {
            // Use number if possible to match DB expectation in some parts of the app
            const nSiniestroNum = typeof nSiniestro === 'string' ? parseInt(nSiniestro) : nSiniestro;

            // Calculate tomorrow's date in LOCAL time
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(now.getDate() + 1);

            // YYYY-MM-DD LOCAL
            const y = tomorrow.getFullYear();
            const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
            const d = String(tomorrow.getDate()).padStart(2, '0');
            const fechaTomorrow = `${y}-${m}-${d}`;

            // HH:mm LOCAL
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            const horaNow = `${hh}:${mm}`;

            const { error } = await supabase.from('tareas').insert([{
                n_siniestro: nSiniestroNum,
                texto: texto,
                hecha: false,
                asignado_a: analista || null,
                fecha: fechaTomorrow,
                hora: horaNow,
                creada_en: now.toISOString()
            }]);

            if (error) {
                console.error("Supabase error creating auto task:", error);
            } else {
                setRefreshTasks(prev => prev + 1); // Trigger refresh
            }
        } catch (err) {
            console.error("Exception in createAutoTask:", err);
        }
    };

    const handleSaveDanos = async (nuevasCoberturas: any[]) => {
        // Update local state immediately for UI responsiveness
        const updatedCaso = { ...caso, tabla_daños: nuevasCoberturas };
        setCaso(updatedCaso);

        // Sync with backend
        setSaving(true);
        try {
            const { error } = await supabase
                .from('casos')
                .update({ tabla_daños: nuevasCoberturas })
                .eq('id', caso.id);

            if (error) throw error;
        } catch (err) {
            console.error("Error al guardar tabla de daños:", err);
            alert("Error al guardar cambios. Por favor revisa tu conexión.");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveChecklist = async (newItems: any[]) => {
        const updatedCaso = { ...caso, checklist: newItems };
        setCaso(updatedCaso);

        setSaving(true);
        try {
            // We assume 'checklist' column exists as JSONB in 'casos' based on earlier context
            // If it doesn't exist, we might need to alter table or assume it's part of a flexible json column.
            // Based on `detalle.html`, it was saving in localStorage. Here we save to Supabase.
            const { error } = await supabase
                .from('casos')
                .update({ checklist: newItems })
                .eq('id', caso.id);

            if (error) throw error;
        } catch (err) {
            console.error("Error saving checklist:", err);
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        if (caso.estado === newStatus) return;

        const updatedCaso = { ...caso, estado: newStatus };
        setCaso(updatedCaso);
        setSaving(true);
        try {
            const { error } = await supabase
                .from('casos')
                .update({ estado: newStatus })
                .eq('id', caso.id);

            if (error) throw error;

            // Auto task
            await createAutoTask(caso.n_siniestro, caso.analista, newStatus, caso.sub_estado);
        } catch (err) {
            console.error("Error saving status:", err);
            alert("Error al actualizar estado.");
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateInfo = async (updatedData: any) => {
        const { id, ...dataToUpdate } = updatedData; // Exclude ID from update payload to avoid checking it

        // Check if status changed via InfoCaso (e.g. Entrevistado button)
        const statusChanged = (dataToUpdate.estado && dataToUpdate.estado !== caso.estado) ||
            (dataToUpdate.sub_estado && dataToUpdate.sub_estado !== caso.sub_estado);

        setCaso(updatedData);
        setSaving(true);
        try {
            const { error } = await supabase
                .from('casos')
                .update(dataToUpdate)
                .eq('id', caso.id);

            if (error) throw error;

            if (statusChanged) {
                await createAutoTask(
                    updatedData.n_siniestro || caso.n_siniestro,
                    updatedData.analista || caso.analista,
                    dataToUpdate.estado || caso.estado,
                    dataToUpdate.sub_estado || caso.sub_estado
                );
            }
        } catch (err) {
            console.error("Error saving info:", err);
            alert("Error al guardar cambios de información.");
        } finally {
            setSaving(false);
        }
    };

    const getEstadoColor = (nombre: string) => {
        const est = catalogs.estados.find(e => e.nombre === nombre);
        if (est) return est.color;
        if (nombre === 'ENTREVISTAR') return '#ef4444';
        if (nombre === 'EN GESTION') return '#f59e0b';
        if (nombre === 'CERRADO') return '#10b981';
        return '#3699ff';
    };

    const handleStatusUpdate = async (status: {
        estado?: string,
        sub_estado?: string,
        fecha_cierre?: string | null,
        fecha_entrevista?: string | null,
        fecha_documentacion_completa?: string | null
    }) => {
        // Check if status changed
        const statusChanged = (status.estado && status.estado !== caso.estado) ||
            (status.sub_estado && status.sub_estado !== caso.sub_estado);

        const updatedCaso = { ...caso, ...status };
        setCaso(updatedCaso);
        setSaving(true);
        try {
            const { error } = await supabase
                .from('casos')
                .update(status)
                .eq('id', caso.id);

            if (error) throw error;

            if (statusChanged) {
                await createAutoTask(
                    caso.n_siniestro,
                    caso.analista,
                    status.estado || caso.estado,
                    status.sub_estado || caso.sub_estado
                );
            }
        } catch (err) {
            console.error("Error updating status:", err);
            alert("Error al actualizar el estado.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <Layout>
            <div style={{ color: 'var(--muted-color)', padding: '20px' }}>Cargando detalle del caso...</div>
        </Layout>
    );

    if (!caso) return (
        <Layout>
            <div style={{ color: 'var(--danger-color)', padding: '20px' }}>Caso no encontrado.</div>
        </Layout>
    );

    return (
        <Layout>
            <div className={styles.topBar}>
                <div>
                    <h1>Detalle del Caso #{caso.n_siniestro}</h1>
                    <Link to="/lista" className={styles.backLink}>
                        <ChevronLeft size={16} /> Volver al listado
                    </Link>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {saving && <span style={{ fontSize: '12px', color: 'var(--accent-color)' }}>Guardando...</span>}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <select
                            className={styles.statusSelect}
                            value={caso.estado || 'ENTREVISTAR'}
                            onChange={(e) => handleStatusChange(e.target.value)}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '20px',
                                border: `1px solid ${getEstadoColor(caso.estado || 'ENTREVISTAR')}30`,
                                backgroundColor: getEstadoColor(caso.estado || 'ENTREVISTAR') + '15',
                                color: getEstadoColor(caso.estado || 'ENTREVISTAR'),
                                fontWeight: '700',
                                fontSize: '13px',
                                cursor: 'pointer',
                                outline: 'none',
                                textAlign: 'center',
                                height: '32px'
                            }}
                        >
                            {['ENTREVISTAR', 'EN GESTION', 'CERRADO'].map(st => (
                                <option key={st} value={st} style={{ background: '#1a1a1a', color: '#fff' }}>{st}</option>
                            ))}
                        </select>

                        {caso.sub_estado && (
                            <span style={{
                                padding: '6px 14px',
                                borderRadius: '20px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                color: 'var(--text-color)',
                                fontWeight: '700',
                                fontSize: '12px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '32px',
                                whiteSpace: 'nowrap'
                            }}>
                                {caso.sub_estado}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className={styles.container}>
                {/* HEADERS SUMMARY */}
                <div className={styles.caseHeader}>
                    <div className={styles.headerItem}>
                        <span className={styles.headerLabel}>ASEGURADO</span>
                        <span className={styles.headerValue}>{caso.asegurado}</span>
                    </div>
                    <div className={styles.headerItem}>
                        <span className={styles.headerLabel}>COMPAÑÍA</span>
                        <span className={styles.headerValue}>{caso.cia}</span>
                    </div>
                    <div className={styles.headerItem}>
                        <span className={styles.headerLabel}>DNI</span>
                        <span className={styles.headerValue}>{caso.dni || '-'}</span>
                    </div>
                    <div className={styles.headerItem}>
                        <span className={styles.headerLabel}>PÓLIZA</span>
                        <span className={styles.headerValue}>{caso.poliza || '-'}</span>
                    </div>
                    <div className={styles.headerItem}>
                        <span className={styles.headerLabel}>RAMO</span>
                        <span className={styles.headerValue}>{caso.ramo || '-'}</span>
                    </div>
                </div>

                {/* TABS CONTAINER */}
                <div className={styles.tabsContainer}>
                    <div className={styles.tabsHeader}>
                        {['info', 'checklist', 'documentacion', 'tareas', 'comentarios', 'tabla-danos', 'factura', 'gestion'].map(tab => (
                            <button
                                key={tab}
                                className={`${styles.tabBtn} ${activeTab === tab ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab.toUpperCase().replace('-', ' ')}
                            </button>
                        ))}
                    </div>

                    <div className={styles.tabContent}>
                        {activeTab === 'info' && (
                            <InfoCaso caso={caso} catalogs={catalogs} onUpdate={handleUpdateInfo} />
                        )}

                        {activeTab === 'checklist' && (
                            <Checklist
                                data={caso.checklist || []}
                                causa={caso.causa}
                                onUpdate={handleSaveChecklist}
                                onStatusUpdate={handleStatusUpdate}
                            />
                        )}

                        {activeTab === 'tabla-danos' && (
                            <TablaDanos
                                data={caso.tabla_daños || []}
                                onUpdate={handleSaveDanos}
                            />
                        )}

                        {activeTab === 'documentacion' && (
                            <Documentacion nSiniestro={caso.n_siniestro} />
                        )}

                        {activeTab === 'tareas' && (
                            <Tareas
                                key={refreshTasks}
                                nSiniestro={caso.n_siniestro} // or caso.id depending on what tasks table uses. Usually n_siniestro.
                                defaultAssignee={caso.analista}
                            />
                        )}

                        {activeTab === 'factura' && (
                            <Factura nSiniestro={caso.n_siniestro} />
                        )}

                        {activeTab === 'comentarios' && (
                            <Comentarios nSiniestro={caso.n_siniestro} />
                        )}

                        {activeTab === 'gestion' && (
                            <Gestion
                                nSiniestro={caso.n_siniestro}
                                id={caso.id}
                                mail={caso.mail}
                                checklist={caso.checklist || []}
                                onStatusUpdate={handleStatusUpdate}
                            />
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
};
