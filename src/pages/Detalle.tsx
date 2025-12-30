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
    const [catalogs, setCatalogs] = useState<{ analistas: any[], companias: any[] }>({ analistas: [], companias: [] });

    useEffect(() => {
        if (id) {
            fetchCaso(id);
            loadCatalogs();
        }
    }, [id]);

    const loadCatalogs = async () => {
        try {
            const [resA, resC] = await Promise.all([
                supabase.from('analistas').select('nombre'),
                supabase.from('companias').select('nombre')
            ]);
            setCatalogs({
                analistas: resA.data || [],
                companias: resC.data || []
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
        const updatedCaso = { ...caso, estado: newStatus };
        setCaso(updatedCaso);
        setSaving(true);
        try {
            const { error } = await supabase
                .from('casos')
                .update({ estado: newStatus })
                .eq('id', caso.id);

            if (error) throw error;
        } catch (err) {
            console.error("Error saving status:", err);
            alert("Error al actualizar estado.");
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateInfo = async (updatedData: any) => {
        const { id, ...dataToUpdate } = updatedData; // Exclude ID from update payload to avoid checking it
        setCaso(updatedData);
        setSaving(true);
        try {
            const { error } = await supabase
                .from('casos')
                .update(dataToUpdate)
                .eq('id', caso.id);

            if (error) throw error;
        } catch (err) {
            console.error("Error saving info:", err);
            alert("Error al guardar cambios de información.");
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
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {saving && <span style={{ fontSize: '12px', color: 'var(--accent-color)' }}>Guardando...</span>}
                    <select
                        className={styles.statusSelect}
                        value={caso.estado || 'SIN ASIGNAR'}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        style={{
                            // Basic style inline for now, ideally in css module
                            padding: '6px 12px',
                            borderRadius: '20px',
                            border: 'none',
                            backgroundColor: '#e1f0ff',
                            color: '#3699ff',
                            fontWeight: '600',
                            cursor: 'pointer',
                            outline: 'none'
                        }}
                    >
                        {['SIN ASIGNAR', 'EN PROCESO', 'PENDIENTE', 'CERRADO'].map(st => (
                            <option key={st} value={st}>{st}</option>
                        ))}
                    </select>
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
                            <Gestion nSiniestro={caso.n_siniestro} id={caso.id} />
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
};
