import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import styles from './Informe.module.css';
import { Save, Printer, ArrowLeft, Trash2 } from 'lucide-react';

export const Informe = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [caso, setCaso] = useState<any>(null);
    const [reportData, setReportData] = useState<any>({});
    const [stats, setStats] = useState({ suma: 0, conv: 0, indem: 0 });

    useEffect(() => {
        if (id) fetchCaso(id);
    }, [id]);

    const fetchCaso = async (casoId: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('casos')
                .select('*')
                .eq('id', casoId)
                .single();

            if (error) throw error;

            setCaso(data);
            setReportData(data.informe || {});

            // Calculate Totals
            let s = 0, c = 0, i = 0;
            (data.tabla_daños || []).forEach((cob: any) => {
                let conv = 0, ind = 0;
                (cob.items || []).forEach((it: any) => {
                    conv += Number(it.montoConvenido || 0);
                    ind += Number(it.montoIndemnizacion || 0);
                });
                s += Number(cob.suma || 0);
                c += conv;
                i += ind;
            });
            setStats({ suma: s, conv: c, indem: i });

        } catch (err) {
            console.error("Error loading case:", err);
            alert("Error al cargar el caso.");
            navigate(-1);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (silent = false) => {
        try {
            const { error } = await supabase
                .from('casos')
                .update({ informe: reportData })
                .eq('id', id);

            if (error) throw error;
            if (!silent) alert("Informe guardado.");
        } catch (err: any) {
            alert("Error al guardar: " + err.message);
        }
    };

    const handlePrint = async () => {
        await handleSave(true);
        window.print();
    };

    const handleClear = async () => {
        if (!confirm("¿Borrar todo el contenido del informe?")) return;
        setReportData({});
        await handleSave(true);
    };

    const handleChange = (field: string, val: string) => {
        setReportData((prev: any) => ({ ...prev, [field]: val }));
    };

    const money = (val: number) => val?.toLocaleString('es-AR', { minimumFractionDigits: 2 });

    if (loading) return <div className={styles.container}>Cargando...</div>;
    if (!caso) return <div className={styles.container}>Caso no encontrado.</div>;

    return (
        <div className={styles.container}>
            <div className={styles.toolbar}>
                <button className={styles.btn} onClick={() => navigate(-1)}>
                    <ArrowLeft size={16} /> Volver
                </button>
                <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleClear}>
                    <Trash2 size={16} /> Borrar
                </button>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => handleSave(false)}>
                    <Save size={16} /> Guardar
                </button>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handlePrint}>
                    <Printer size={16} /> Imprimir / PDF
                </button>
            </div>

            <div className={styles.page}>
                <table className={styles.noBorder}>
                    <tbody>
                        <tr>
                            <td>
                                <b>H.M.Gibert</b><br />
                                Fundado en 1955<br />
                                CONTADOR PUBLICO NACIONAL<br />
                                ESTUDIO DE LIQUIDACIÓN DE SINIESTROS
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '14px' }}>
                                {caso.cia?.toUpperCase()}
                            </td>
                        </tr>
                    </tbody>
                </table>

                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>SINIESTRO</th>
                            <th>POLIZA</th>
                            <th>ANALISTA</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>{caso.n_siniestro}</td>
                            <td>{caso.poliza}</td>
                            <td>{caso.analista}</td>
                        </tr>
                    </tbody>
                </table>

                <div className={styles.section}> Datos personales del asegurado</div>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>APELLIDO Y NOMBRE</th>
                            <th>DNI</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>{caso.asegurado}</td>
                            <td>{caso.dni}</td>
                        </tr>
                    </tbody>
                </table>

                <div className={styles.section}> Ubicación del riesgo afectado</div>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>CALLE</th>
                            <th>N°</th>
                            <th>PISO</th>
                            <th>LOCALIDAD</th>
                            <th>PROVINCIA</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>{caso.calle_riesgo || ''}</td>
                            <td>{caso.nro_r || ''}</td>
                            <td>{caso.piso_r || ''}</td>
                            <td>{caso.localidad_r || ''}</td>
                            <td>{caso.provincia_r || ''}</td>
                        </tr>
                    </tbody>
                </table>

                <div className={styles.section}> Datos del siniestro</div>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>FECHA SINIESTRO</th>
                            <th>FECHA DENUNCIA</th>
                            <th>FECHA CIERRE</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            {/* Uses input to match original design which allowed editing? Or display only? 
                                Original had <input id="inFechaSiniestro"> implies editable. 
                                We map them to reportData if they are overrides, OR display from DB if not?
                                Legacy loaded from DB if available? No, inputs were empty by default?
                                Let's assume we read from DB (caso.fecha_siniestro) but allow Override via reportData? 
                                For simplicity, let's just show DB data or editable inputs binded to reportData.
                                I'll bind to reportData with fallback to DB values.
                            */}
                            <td><input className={styles.input} value={reportData.fecha_siniestro || caso.fecha_siniestro || ''} onChange={e => handleChange('fecha_siniestro', e.target.value)} /></td>
                            <td><input className={styles.input} value={reportData.fecha_denuncia || caso.fecha_denuncia || ''} onChange={e => handleChange('fecha_denuncia', e.target.value)} /></td>
                            <td><input className={styles.input} value={reportData.fecha_cierre || ''} onChange={e => handleChange('fecha_cierre', e.target.value)} /></td>
                        </tr>
                    </tbody>
                </table>

                <div className={styles.section}> DENUNCIADO COMO OCURRIDO</div>
                <div className={styles.box}>
                    <textarea className={styles.textarea} value={reportData.txOcurrencia || ''} onChange={e => handleChange('txOcurrencia', e.target.value)} />
                </div>

                <div className={styles.section}> COBERTURAS AFECTADAS</div>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>COBERTURA</th>
                            <th>SUMA ASEGURADA</th>
                            <th>DAÑOS CONVALIDADOS</th>
                            <th>MONTO INDEMNIZADO</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(caso.tabla_daños || []).map((cob: any, idx: number) => {
                            let conv = 0, ind = 0;
                            (cob.items || []).forEach((it: any) => {
                                conv += Number(it.montoConvenido || 0);
                                ind += Number(it.montoIndemnizacion || 0);
                            });
                            return (
                                <tr key={idx}>
                                    <td>{cob.nombre}</td>
                                    <td>{money(cob.suma)}</td>
                                    <td>{money(conv)}</td>
                                    <td>{money(ind)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td><b>TOTAL</b></td>
                            <td>{money(stats.suma)}</td>
                            <td>{money(stats.conv)}</td>
                            <td>{money(stats.indem)}</td>
                        </tr>
                    </tfoot>
                </table>

                <div className={styles.section}> DETALLE DE LA LIQUIDACION</div>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>DETALLE</th>
                            <th>MONTO CONVALIDADO</th>
                            <th>MONTO INDEMNIZADO</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>{money(stats.indem)}</td>
                        </tr>
                        <tr>
                            <td><b>TOTAL</b></td>
                            <td colSpan={2}><b>{money(stats.indem)}</b></td>
                        </tr>
                    </tbody>
                </table>

                <div className={styles.section}> RESULTADOS DE LA VERIFICACIÓN</div>
                <table className={styles.table}>
                    <tbody>
                        <tr>
                            <th>OC</th>
                            <td><input className={styles.input} value={reportData.inOC || ''} onChange={e => handleChange('inOC', e.target.value)} /></td>
                            <th>AHORRO</th>
                            <td><input className={styles.input} value={reportData.inAhorro || ''} onChange={e => handleChange('inAhorro', e.target.value)} /></td>
                        </tr>
                        <tr>
                            <th>EFECTIVO</th>
                            <td><input className={styles.input} value={reportData.inEfectivo || ''} onChange={e => handleChange('inEfectivo', e.target.value)} /></td>
                            <th>TOTAL</th>
                            <td><input className={styles.input} value={reportData.inTotal || money(stats.indem)} onChange={e => handleChange('inTotal', e.target.value)} /></td>
                        </tr>
                    </tbody>
                </table>

                <div className={styles.section}> MOTIVO DE LA DERIVACIÓN</div>
                <div className={styles.box}><textarea className={styles.textarea} value={reportData.txMotivo || ''} onChange={e => handleChange('txMotivo', e.target.value)} /></div>

                <div className={styles.section}> COMENTARIOS DE LOS HECHOS</div>
                <div className={styles.box}><textarea className={styles.textarea} value={reportData.txHechos || ''} onChange={e => handleChange('txHechos', e.target.value)} /></div>

                <div className={styles.section}> ANTECEDENTES DEL ASEGURADO</div>
                <div className={styles.box}><textarea className={styles.textarea} value={reportData.txAntecedentes || ''} onChange={e => handleChange('txAntecedentes', e.target.value)} /></div>

                <div className={styles.bigline}>Opinión___________________________________________________________</div>
                <div className={styles.box}><textarea className={styles.textarea} value={reportData.txContinuidad || ''} onChange={e => handleChange('txContinuidad', e.target.value)} /></div>

                <div className={styles.bigline}>Desarrollo________________________________________________________</div>

                <div className={styles.section}>Técnico</div>
                <div className={styles.box}><textarea className={styles.textarea} value={reportData.txTecnico || ''} onChange={e => handleChange('txTecnico', e.target.value)} /></div>

                <div className={styles.section}>Clima</div>
                <div className={styles.box}><textarea className={styles.textarea} value={reportData.txClima || ''} onChange={e => handleChange('txClima', e.target.value)} /></div>

                <div className={styles.section}>Conclusión</div>
                <div className={styles.box}><textarea className={styles.textarea} value={reportData.txConclusion || ''} onChange={e => handleChange('txConclusion', e.target.value)} /></div>
            </div>
        </div>
    );
};
