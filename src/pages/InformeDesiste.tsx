import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import styles from './InformeDesiste.module.css';
import { Save, Printer, ArrowLeft, FileText } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Configure worker for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const PdfToImage = ({ url, name }: { url: string, name: string }) => {
    const [images, setImages] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const renderPdf = async () => {
            try {
                const loadingTask = pdfjsLib.getDocument(url);
                const pdf = await loadingTask.promise;
                if (!pdf) throw new Error("Could not load PDF");

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                if (!context) throw new Error("Could not get canvas context");

                const imgs: string[] = [];

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 1.5 });
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    // @ts-ignore
                    await page.render({ canvasContext: context, viewport, canvas }).promise;
                    imgs.push(canvas.toDataURL('image/webp', 0.8));
                }
                setImages(imgs);
            } catch (err) {
                console.error("Error rendering PDF:", err);
            } finally {
                setLoading(false);
            }
        };
        if (url) renderPdf();
        else setLoading(false);
    }, [url]);

    if (!url) return null;
    if (loading) return <div style={{ textAlign: 'center', padding: '10px', color: '#666' }}>⏳ Procesando PDF {name.split('_').slice(1).join('_')}...</div>;
    if (images.length === 0) return <div style={{ textAlign: 'center', padding: '10px', color: 'red' }}>❌ Error al procesar PDF {name}</div>;

    return (
        <>
            {images.map((img, idx) => (
                <div key={idx} className={styles.docImageContainer} style={{ marginBottom: '40px' }}>
                    <img src={img} alt={`${name}-p${idx + 1}`} className={styles.docImage} />
                    <div className={styles.docLabel}>
                        {name.split('_').slice(1).join('_')} - Página {idx + 1}
                    </div>
                </div>
            ))}
        </>
    );
};

export const InformeDesiste = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [caso, setCaso] = useState<any>(null);
    const [reportData, setReportData] = useState<any>({});
    const [stats, setStats] = useState({ suma: 0, conv: 0, ahor: 0 });
    const [docs, setDocs] = useState<any[]>([]);

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
            setReportData(data.informe_desiste || data.informe || {});

            let s = 0, c = 0, a = 0;
            (data.tabla_daños || []).forEach((cob: any) => {
                let conv = 0;
                (cob.items || []).forEach((it: any) => conv += Number(it.montoConvenido || 0));
                const sumaVal = Number(cob.suma || 0);
                s += sumaVal;
                c += conv;
                a += Math.max(0, sumaVal - conv);
            });
            setStats({ suma: s, conv: c, ahor: a });

            if (data.n_siniestro) {
                const { data: files, error: storageError } = await supabase.storage
                    .from('documentos')
                    .list(`casos/${data.n_siniestro}`);

                if (!storageError && files) {
                    const validFiles = files.filter(f => f.name !== '.emptyFolderPlaceholder');
                    const docsWithUrls = await Promise.all(validFiles.map(async (f) => {
                        try {
                            const { data: urlData, error: urlError } = await supabase.storage
                                .from('documentos')
                                .createSignedUrl(`casos/${data.n_siniestro}/${f.name}`, 3600);

                            if (urlError) {
                                console.error(`Error creating signed URL for ${f.name}:`, urlError);
                                return null;
                            }

                            return {
                                ...f,
                                url: urlData?.signedUrl,
                                // Supabase Storage list result might have metadata directly or nested
                                mime: (f as any).metadata?.mimetype || (f as any).mimetype || ''
                            };
                        } catch (e) {
                            console.error(`Unexpected error processing file ${f.name}:`, e);
                            return null;
                        }
                    }));
                    // Filter out any null entries from failed signed URLs
                    setDocs(docsWithUrls.filter(d => d !== null));
                }
            }
        } catch (err) {
            console.error("Error loading case:", err);
            navigate(-1);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (silent = false) => {
        try {
            const { error } = await supabase
                .from('casos')
                .update({ informe_desiste: reportData })
                .eq('id', id);
            if (error) throw error;
            if (!silent) alert("Informe Desiste guardado.");
        } catch (err: any) {
            alert("Error al guardar: " + err.message);
        }
    };

    const handlePrint = async () => {
        await handleSave(true);
        window.print();
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
                <button className={styles.btn} onClick={() => navigate(-1)}><ArrowLeft size={16} /> Volver</button>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => handleSave(false)}><Save size={16} /> Guardar</button>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handlePrint}><Printer size={16} /> Imprimir / PDF</button>
            </div>

            <div className={styles.page}>
                <div className={styles.header}>
                    <div className={styles.logoInfo}>
                        <h2 className={styles.companyName}>H.M.Gibert</h2>
                        <p>CONTADOR PUBLICO NACIONAL<br />ESTUDIO DE LIQUIDACIÓN DE SINIESTROS</p>
                    </div>
                    <div className={styles.ahorroBox}>
                        <div className={styles.ahorroBadge}>
                            *AHORRO GENERADO*
                            <div className={styles.ahorroValue}>{money(stats.ahor)}</div>
                        </div>
                    </div>
                    <div className={styles.founding}>
                        Fundado en 1955
                        <div className={styles.logoCircle}>G</div>
                    </div>
                </div>

                <div className={styles.labelBand}>COMPAÑÍA: {caso.cia?.toUpperCase()}</div>

                <table className={styles.mainTable}>
                    <tbody>
                        <tr>
                            <td className={styles.label}>SINIESTRO</td>
                            <td className={styles.label}>POLIZA</td>
                            <td className={styles.label}>ANALISTA</td>
                        </tr>
                        <tr>
                            <td className={styles.val}>{caso.n_siniestro}</td>
                            <td className={styles.val}>{caso.poliza}</td>
                            <td className={styles.val}>{caso.analista}</td>
                        </tr>
                    </tbody>
                </table>

                <div className={styles.sectionTitle}>Datos personales del asegurado</div>
                <table className={styles.mainTable}>
                    <tbody>
                        <tr>
                            <td className={styles.label} style={{ width: '70%' }}>APELLIDO Y NOMBRE</td>
                            <td className={styles.label}>TIPO Y N° DOCUMENTO</td>
                        </tr>
                        <tr>
                            <td className={styles.val}>{caso.asegurado}</td>
                            <td className={styles.val}>DNI {caso.dni}</td>
                        </tr>
                    </tbody>
                </table>

                <div className={styles.sectionTitle}>Ubicación del riesgo afectado</div>
                <table className={styles.mainTable}>
                    <tbody>
                        <tr>
                            <td className={styles.label} style={{ width: '40%' }}>CALLE</td>
                            <td className={styles.label} style={{ width: '10%' }}>N°</td>
                            <td className={styles.label} style={{ width: '10%' }}>PISO</td>
                            <td className={styles.label} style={{ width: '20%' }}>LOCALIDAD</td>
                            <td className={styles.label} style={{ width: '20%' }}>PROVINCIA</td>
                        </tr>
                        <tr>
                            <td className={styles.val}>{caso.calle_riesgo}</td>
                            <td className={styles.val}>{caso.nro_r}</td>
                            <td className={styles.val}>{caso.piso_r}</td>
                            <td className={styles.val}>{caso.localidad_r}</td>
                            <td className={styles.val}>{caso.provincia_r}</td>
                        </tr>
                    </tbody>
                </table>

                <div className={styles.sectionTitle}>Datos del siniestro</div>
                <table className={styles.mainTable}>
                    <tbody>
                        <tr>
                            <td className={styles.label} style={{ width: '33%' }}>FECHA DEL SINIESTRO</td>
                            <td className={styles.label} style={{ width: '33%' }}>HORA DEL SINIESTRO</td>
                            <td className={styles.label} style={{ width: '33%' }}>FECHA DE DENUNCIA</td>
                        </tr>
                        <tr>
                            <td className={styles.val}><input className={styles.ghostInput} value={reportData.f_sin || caso.fecha_siniestro || ''} onChange={e => handleChange('f_sin', e.target.value)} /></td>
                            <td className={styles.val}><input className={styles.ghostInput} value={reportData.h_sin || ''} onChange={e => handleChange('h_sin', e.target.value)} /></td>
                            <td className={styles.val}><input className={styles.ghostInput} value={reportData.f_den || caso.fecha_denuncia || ''} onChange={e => handleChange('f_den', e.target.value)} /></td>
                        </tr>
                    </tbody>
                </table>

                <div className={styles.subLabel}>DENUNCIADO COMO OCURRIDO:</div>
                <div className={styles.textAreaBox}>
                    <textarea className={styles.ghostTextarea} value={reportData.ocurrencia || ''} onChange={e => handleChange('ocurrencia', e.target.value)} />
                </div>

                <table className={styles.mainTable} style={{ marginTop: '10px' }}>
                    <tbody>
                        <tr>
                            <td className={styles.label} colSpan={2}>VIGENCIA DE POLIZA</td>
                            <td className={styles.label} rowSpan={2}>FECHA DE CIERRE</td>
                        </tr>
                        <tr>
                            <td className={styles.label}>DESDE</td>
                            <td className={styles.label}>HASTA</td>
                        </tr>
                        <tr>
                            <td className={styles.val}><input className={styles.ghostInput} value={reportData.vig_desde || caso.fecha_contratacion || ''} onChange={e => handleChange('vig_desde', e.target.value)} /></td>
                            <td className={styles.val}><input className={styles.ghostInput} value={reportData.vig_hasta || caso.vigencia_hasta || ''} onChange={e => handleChange('vig_hasta', e.target.value)} /></td>
                            <td className={styles.val}><input className={styles.ghostInput} value={reportData.f_cierre || ''} onChange={e => handleChange('f_cierre', e.target.value)} /></td>
                        </tr>
                    </tbody>
                </table>

                <table className={styles.mainTable} style={{ marginTop: '10px' }}>
                    <tbody>
                        <tr>
                            <td className={styles.label} style={{ width: '50%' }}>RAMO</td>
                            <td className={styles.label} style={{ width: '50%' }}>TIPO DE SINIESTRO</td>
                        </tr>
                        <tr>
                            <td className={styles.val}>{caso.ramo}</td>
                            <td className={styles.val}>{caso.causa}</td>
                        </tr>
                    </tbody>
                </table>

                <table className={styles.mainTable} style={{ marginTop: '10px' }}>
                    <tbody>
                        <tr>
                            <td className={styles.label}>INTERVENCION POLICIAL</td>
                            <td className={styles.val} style={{ width: '80px' }}><input className={styles.ghostInput} value={reportData.int_pol || 'NO'} onChange={e => handleChange('int_pol', e.target.value)} /></td>
                            <td className={styles.label}>INTERVENCION BOMBEROS</td>
                            <td className={styles.val} style={{ width: '80px' }}><input className={styles.ghostInput} value={reportData.int_bom || 'NO'} onChange={e => handleChange('int_bom', e.target.value)} /></td>
                        </tr>
                    </tbody>
                </table>

                <div className={styles.sectionTitle}>OTROS AFECTADOS O PROPIETARIO EN CASO DE RC</div>
                <table className={styles.mainTable}>
                    <tbody>
                        <tr>
                            <td className={styles.label} style={{ width: '50%' }}>DOMICILIO</td>
                            <td className={styles.label} style={{ width: '25%' }}>DNI</td>
                            <td className={styles.label} style={{ width: '25%' }}>TEL</td>
                        </tr>
                        <tr>
                            <td className={styles.val}><input className={styles.ghostInput} value={reportData.rc_dom || ''} onChange={e => handleChange('rc_dom', e.target.value)} /></td>
                            <td className={styles.val}><input className={styles.ghostInput} value={reportData.rc_dni || ''} onChange={e => handleChange('rc_dni', e.target.value)} /></td>
                            <td className={styles.val}><input className={styles.ghostInput} value={reportData.rc_tel || ''} onChange={e => handleChange('rc_tel', e.target.value)} /></td>
                        </tr>
                    </tbody>
                </table>

                <div className={styles.sectionTitle}>COBERTURAS AFECTADAS</div>
                <table className={styles.printableTable}>
                    <thead>
                        <tr>
                            <th>COBERTURA</th>
                            <th>SUMA ASEGURADA</th>
                            <th>DAÑOS CONVALIDADOS</th>
                            <th>MONTO AHORRADO</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(caso.tabla_daños || []).map((cob: any, idx: number) => {
                            let conv = 0;
                            (cob.items || []).forEach((it: any) => conv += Number(it.montoConvenido || 0));
                            const sumaVal = Number(cob.suma || 0);
                            const ahorro = Math.max(0, sumaVal - conv);
                            return (
                                <tr key={idx}>
                                    <td>{cob.nombre}</td>
                                    <td>{money(sumaVal)}</td>
                                    <td>{money(conv)}</td>
                                    <td>{money(ahorro)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <div className={styles.sectionTitle}>RESULTADO DE LA VERIFICACIÓN</div>
                <table className={styles.noBorderTable}>
                    <tbody>
                        <tr>
                            <td style={{ width: '50%' }}>
                                <div className={styles.resultBox}>
                                    <div className={styles.label}>MONTO A LIQUIDAR</div>
                                    <div className={styles.val} style={{ fontSize: '18px' }}>$ {money(stats.conv)}</div>
                                </div>
                            </td>
                            <td style={{ width: '50%', paddingLeft: '10px' }}>
                                <div className={styles.resultBox} style={{ border: '2px solid #ff0000' }}>
                                    <div className={styles.label} style={{ color: '#ff0000' }}>CAUSA DE RECHAZO / DESISTIMIENTO</div>
                                    <textarea className={styles.ghostTextarea} style={{ minHeight: '40px' }} value={reportData.causa_rechazo || ''} onChange={e => handleChange('causa_rechazo', e.target.value)} />
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div className={styles.sectionTitle}>MOTIVO DE LA DERIVACION</div>
                <div className={styles.textAreaBox}>
                    <textarea className={styles.ghostTextarea} value={reportData.motivo_derivacion || caso.motivo_derivacion || ''} onChange={e => handleChange('motivo_derivacion', e.target.value)} />
                </div>

                <div className={styles.pageBreak} />
                <div className={styles.sectionTitle}>COMENTARIOS DE LOS HECHOS</div>
                <div className={styles.textAreaBox} style={{ minHeight: '300px' }}>
                    <textarea className={styles.ghostTextarea} style={{ height: '300px' }} value={reportData.hechos || caso.entrevista || ''} onChange={e => handleChange('hechos', e.target.value)} />
                </div>

                <div className={styles.pageBreak} />
                <div className={styles.sectionTitle}>ANTECEDENTES DEL ASEGURADO</div>
                <div className={styles.textAreaBox} style={{ minHeight: '150px' }}>
                    <textarea className={styles.ghostTextarea} style={{ height: '150px' }} value={reportData.antecedentes || ''} onChange={e => handleChange('antecedentes', e.target.value)} />
                </div>

                <table className={styles.mainTable} style={{ marginTop: '20px' }}>
                    <thead>
                        <tr>
                            <th className={styles.label}>CONCEPTO</th>
                            <th className={styles.label}>DETALLE</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className={styles.label}>¿ACONSEJA LA CONTINUIDAD DE LA COBERTURA?</td>
                            <td className={styles.val}><input className={styles.ghostInput} value={reportData.continuidad || ''} onChange={e => handleChange('continuidad', e.target.value)} /></td>
                        </tr>
                        <tr>
                            <td className={styles.label}>PERSONA ENTREVISTADA</td>
                            <td className={styles.val}><input className={styles.ghostInput} value={reportData.entrevistado || ''} onChange={e => handleChange('entrevistado', e.target.value)} /></td>
                        </tr>
                        <tr>
                            <td className={styles.label}>LUGAR DE LA ENTREVISTA</td>
                            <td className={styles.val}><input className={styles.ghostInput} value={reportData.lugar_entrevista || ''} onChange={e => handleChange('lugar_entrevista', e.target.value)} /></td>
                        </tr>
                        <tr>
                            <td className={styles.label}>INCONVENIENTES PARA REALIZAR LA ENTREVISTA</td>
                            <td className={styles.val}><input className={styles.ghostInput} value={reportData.inconvenientes || 'NINGUNO'} onChange={e => handleChange('inconvenientes', e.target.value)} /></td>
                        </tr>
                    </tbody>
                </table>

                <div className={styles.sectionTitle}>ANTECEDENTES SINIESTRALES</div>
                <div className={styles.textAreaBox} style={{ minHeight: '100px' }}>
                    <textarea className={styles.ghostTextarea} style={{ height: '100px' }} value={reportData.ant_siniestrales || ''} onChange={e => handleChange('ant_siniestrales', e.target.value)} />
                </div>

                {docs.length > 0 && (
                    <>
                        <div className={styles.pageBreak} />
                        <div className={styles.sectionTitle}>DOCUMENTACIÓN ADJUNTA</div>
                        <div className={styles.docsGrid}>
                            {docs.map((doc, idx) => {
                                if (!doc || !doc.url) return null;

                                const mime = (doc.mime || "").toLowerCase();
                                const name = (doc.name || "").toLowerCase();

                                const isImg = mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/.test(name);
                                const isPdf = mime === 'application/pdf' || name.endsWith('.pdf');

                                return (
                                    <div key={idx} className={styles.docItem}>
                                        {isImg ? (
                                            <div className={styles.docImageContainer}>
                                                <img src={doc.url} alt={doc.name} className={styles.docImage} />
                                                <div className={styles.docLabel}>{doc.name.split('_').slice(1).join('_')}</div>
                                            </div>
                                        ) : isPdf ? (
                                            <PdfToImage url={doc.url} name={doc.name} />
                                        ) : (
                                            <div className={styles.docFile}>
                                                <FileText size={48} />
                                                <div className={styles.docLabel}>{doc.name.split('_').slice(1).join('_')}</div>
                                                <div className={styles.docMeta}>Archivo: {doc.mime || 'Desconocido'}</div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
