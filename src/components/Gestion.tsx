import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Gestion.module.css';
import { FileText, Mail, FileCheck, ArrowRight, Printer, Paperclip, Download } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Dropzone } from './Dropzone';
import { numeroALetras } from '../utils/NumberToWords';
import { useAuth } from '../contexts/AuthContext';
import jsPDF from 'jspdf';

interface GestionProps {
    caso: any;
    onStatusUpdate?: (status: {
        estado?: string,
        sub_estado?: string,
        fecha_cierre?: string | null,
        fecha_entrevista?: string | null,
        fecha_documentacion_completa?: string | null
    }) => Promise<void>;
}

const SUB_ESTADOS_CERRADO = ["DESISTIDO", "RECHAZADO", "PAGADO", "DADO DE BAJA"];
const BUCKET = 'documentos';

export const Gestion = ({ caso, onStatusUpdate }: GestionProps) => {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [uploadingReport, setUploadingReport] = useState(false);
    const [reportFile, setReportFile] = useState<{ name: string, url: string } | null>(null);
    const [companyEmail, setCompanyEmail] = useState('');

    const { n_siniestro, id, mail, checklist = [], cia, asegurado, dni, telefono, calle, nro, localidad, provincia, poliza, analista, tramitador } = caso;

    useEffect(() => {
        if (n_siniestro) {
            fetchExistingReport();
            fetchCompanyEmail();
        }
    }, [n_siniestro, cia]);

    const fetchCompanyEmail = async () => {
        if (!cia) return;
        const { data } = await supabase.from('companias').select('email').eq('nombre', cia).single();
        if (data?.email) setCompanyEmail(data.email);
    };

    const fetchExistingReport = async () => {
        try {
            const { data: files } = await supabase.storage.from(BUCKET).list(`casos/${n_siniestro}`);
            if (files) {
                const reportFileFromStorage = files
                    .filter(f => f.name.startsWith('INFORME_GESTION_'))
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

                if (reportFileFromStorage) {
                    const { data } = supabase.storage.from(BUCKET).getPublicUrl(`casos/${n_siniestro}/${reportFileFromStorage.name}`);
                    setReportFile({ name: reportFileFromStorage.name.split('_').slice(2).join('_'), url: data.publicUrl });
                }
            }
        } catch (err) {
            console.error("Error fetching existing report:", err);
        }
    };

    const parseMonto = (val: string | number) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        let s = String(val).trim();
        s = s.replace(/\./g, '');
        s = s.replace(',', '.');
        const num = parseFloat(s);
        return isNaN(num) ? 0 : num;
    };

    const calculateTotalFromDanos = (danos: any[], soloProveedor: boolean = false) => {
        if (!danos || !Array.isArray(danos)) return 0;
        return danos.reduce((sum, cob) => {
            const items = cob.items || [];
            return sum + items.reduce((iSum: number, item: any) => {
                if (soloProveedor && !item.esProveedor) return iSum;
                if (!soloProveedor && item.esProveedor) return iSum; // Inverse
                return iSum + parseMonto(item.montoIndemnizacion);
            }, 0);
        }, 0);
    };

    const generateNotaEfectivo = () => {
        const total = calculateTotalFromDanos(caso.tabla_daños, false);
        const doc = new jsPDF('p', 'mm', 'a4');
        const margin = 20;
        let y = 20;

        const addText = (text: string, size = 11, bold = false, spacing = 5.5) => {
            doc.setFontSize(size);
            doc.setFont('times', bold ? 'bold' : 'normal');
            const lines = doc.splitTextToSize(text, 170);
            doc.text(lines, margin, y);
            const increment = lines.length * spacing;
            y += increment;
            return increment;
        };

        const fecha = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
        doc.setFontSize(11);
        doc.setFont('times', 'normal');
        doc.text(`Buenos Aires, ${fecha}`, 190, y, { align: 'right' });
        y += 15;

        addText(`Sr. Gerente\n${cia || '.....................'}`, 11, true);
        y += 1;
        addText('De mi mayor consideración:', 11);
        y += 4;
        addText(`Referencia:\nSINIESTRO ${n_siniestro || '.......'} / POLIZA ${poliza || '.......'}`, 11, true);
        y += 4;

        addText(`Por la presente, informo que, habiendo cumplido con la entrega de toda la información y documentación requerida por el Estudio Gibert con fecha actual, acepto, conforme a las condiciones contractuales vigentes, la siguiente liquidación en concepto de indemnización:`, 11);

        y += 3;
        const montoStrQuery = numeroALetras(total);
        addText(`Indemnización dineraria: $ ${total.toLocaleString('es-AR')} (${montoStrQuery}).`, 11, true);

        y += 3;
        addText(`Solicito, asimismo, que el monto mencionado sea transferido a la siguiente cuenta bancaria de mi titularidad en el Banco ________________________:`, 11);

        y += 3;
        addText('TIPO DE CUENTA:\nNRO DE CUENTA:\nCBU:\nFILIAL:', 11, true, 7);

        y += 1;
        addText(`Declaro que, una vez percibida la indemnización señalada, renuncio expresamente a cualquier otro reclamo relacionado con el presente caso.`, 11);
        y += 1;
        addText(`Asimismo, confirmo que la única póliza vigente relacionada con el siniestro es aquella contratada con ${cia || '.......'} y ratifico íntegramente las circunstancias que dieron lugar al evento denunciado.`, 11);
        y += 1;
        addText(`Adicionalmente, declaro bajo juramento que no me encuentro incluido ni alcanzado dentro de la categoría de "Personas Expuestas Políticamente" según la normativa vigente.`, 11);
        y += 1;
        addText(`Quedo a disposición para cualquier aclaración adicional y, sin otro particular, saludo a usted con la mayor consideración.`, 11);

        y += 5;
        addText('Atentamente,', 11);
        y += 3;
        addText('FIRMA', 11, true);
        y += 3;
        addText(`Aclaración: ${asegurado || '.....................'}`, 11, true, 7);
        y += 3;
        addText(`DNI: ${dni || '.....................'}`, 11, true, 7);

        y += 10; // Reducido el espacio drásticamente de y += 25 a y += 10
        doc.setLineWidth(0.2);
        doc.line(margin, y, 190, y);
        y += 6;
        addText('Nota aclaratoria:', 9, true, 4);
        addText(`Se deja expresa constancia de que el presente constituye una propuesta de indemnización formulada por el estudio liquidador para ser evaluada y aprobada por la aseguradora. Hasta tanto dicha aprobación sea emitida, ${cia || '.......'} no asume obligación ni compromiso alguno de pago respecto del asegurado o damnificado.`, 8.5, false, 3.5);

        doc.save(`Nota_Efectivo_${n_siniestro}.pdf`);
    };

    const handleAction = async (action: string) => {
        const isAdmin = profile?.rol === 'Administrador';
        const isClosed = caso?.estado === 'CERRADO';

        if (isClosed && !isAdmin) {
            alert("El caso está cerrado. Las acciones están bloqueadas.");
            return;
        }

        if (action === 'Generar Informe') {
            navigate(`/informe/${id}`);
            return;
        }
        if (action === 'Informe Desiste') {
            navigate(`/informe-desiste/${id}`);
            return;
        }

        // Logic for Notas: Transition to NOTA PENDIENTE
        const noteActions = ['Nota Desiste', 'Nota Desiste C/Póliza', 'Nota Orden de Compra', 'Nota Efectivo'];
        if (noteActions.includes(action)) {
            await onStatusUpdate?.({ sub_estado: 'NOTA PENDIENTE' });
            if (action === 'Nota Efectivo') {
                generateNotaEfectivo();
            } else {
                alert(`Acción "${action}" iniciada. Sub-estado actualizado a NOTA PENDIENTE.`);
            }
            return;
        }

        if (action === 'Interrupción de Plazos') {
            const checklistArray = Array.isArray(checklist) ? checklist : [];
            const missingDocs = checklistArray
                .filter(item => !item.checked)
                .map(item => `- ${item.text}`)
                .join('\r\n');

            const subject = `Interrupción de Plazos - Siniestro ${n_siniestro}`;
            const body = `Buenas tardes,\r\nDe nuestra mayor consideración:\r\n\r\nNos dirigimos a Usted en relación al siniestro de referencia. Al respecto le informamos que, a los efectos de completar la evaluación del mismo, resulta imprescindible que nos sea remitida la siguiente documentación:\r\n\r\n${missingDocs}\r\n\r\nSe hace notar que hasta tanto sea recepcionada la documentación solicitada quedan suspendidos los plazos previstos para pronunciarse acerca del reclamo indemnizatorio, según lo establecido en el Art. 51 párrafo 2º de la ley 17.418.\r\n\r\nSin otro particular, saludamos atentamente.`;

            const mailtoUrl = `mailto:${mail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            window.location.href = mailtoUrl;
            return;
        }

        if (action === 'Mail a Proveedor') {
            // Get total from tabla_daños ONLY for items marked as esProveedor
            const monto = calculateTotalFromDanos(caso.tabla_daños, true);
            const montoTexto = numeroALetras(monto);
            const statusMonto = monto > 0 ? `$ ${monto.toLocaleString('es-AR')}` : '[ORDEN DE COMPRA]';
            const statusLetras = monto > 0 ? montoTexto : '[ENLETRASOC]';

            const subject = `Orden de Compra Abierta - Siniestro ${n_siniestro}`;

            let body = `Por medio de la presente solicitamos la siguiente ORDEN DE COMPRA ABIERTA\r\n\r\n`;

            body += `MONTO: ${statusMonto} (pesos ${statusLetras})\r\n`;
            body += `ASEGURADORA: ${cia || '[compañía]'}\r\n\r\n`;

            body += `DATOS DE CONTACTO:\r\n`;
            body += `--------------------------\r\n`;
            body += `ASEGURADO: ${asegurado || '[NOMBRE]'}\r\n`;
            body += `DNI: ${dni || '[DNI]'}\r\n`;
            body += `TE DE CONTACTO: ${telefono || '[telefono]'}\r\n`;
            body += `DOMICILIO: ${calle || ''} ${nro || ''}, ${localidad || ''}, ${provincia || ''}\r\n`;
            body += `STRO. NRO.: ${n_siniestro || '[SINIESTRO]'}\r\n`;
            body += `PÓLIZA NRO.: ${poliza || '[POLIZA]'}\r\n`;
            body += `CORREO: ${mail || '[mail]'}\r\n\r\n`;

            body += `FAVOR CONTACTAR PRONTAMENTE. CONFIRMAR RECEPCIÓN GRACIAS\r\n\r\n`;
            body += `TRAMITADOR: ${tramitador || analista || '[tramitador]'} <${companyEmail || ''}>`;

            const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            window.location.href = mailtoUrl;
            return;
        }

        if (action === 'Enviar a Informes') {
            // Find invoice and report links
            const { data: files } = await supabase.storage.from(BUCKET).list(`casos/${n_siniestro}`);

            let invoiceLink = "";
            let reportLink = "";

            if (files) {
                // Get latest invoice
                const invoiceFile = files
                    .filter(f => f.name.startsWith('FACTURA_'))
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

                if (invoiceFile) {
                    const { data } = supabase.storage.from(BUCKET).getPublicUrl(`casos/${n_siniestro}/${invoiceFile.name}`);
                    invoiceLink = data.publicUrl;
                }

                // Get latest report
                const reportFileFromStorage = files
                    .filter(f => f.name.startsWith('INFORME_GESTION_'))
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

                if (reportFileFromStorage) {
                    const { data } = supabase.storage.from(BUCKET).getPublicUrl(`casos/${n_siniestro}/${reportFileFromStorage.name}`);
                    reportLink = data.publicUrl;
                }
            }

            const subject = `Informe y Factura - Siniestro ${n_siniestro}`;
            let body = `Adjunto informe y factura por el presente caso.\r\n\r\n`;

            if (reportLink) body += `Link Informe: ${reportLink}\r\n`;
            if (invoiceLink) body += `Link Factura: ${invoiceLink}\r\n`;

            if (!reportLink && !invoiceLink) {
                body += `(Nota: No se encontraron archivos cargados en las pestañas correspondientes)\r\n`;
            }

            const mailtoUrl = `mailto:${mail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            window.location.href = mailtoUrl;
            return;
        }

        alert(`Acción "${action}" para el siniestro ${n_siniestro} aún no implementada.`);
    };

    const handleUploadReport = async (files: File[]) => {
        const isAdmin = profile?.rol === 'Administrador';
        const isClosed = caso?.estado === 'CERRADO';

        if (isClosed && !isAdmin) {
            alert("No se pueden subir informes a un caso cerrado.");
            return;
        }

        const file = files[0];
        if (!file) return;

        setUploadingReport(true);
        try {
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const filePath = `casos/${n_siniestro}/INFORME_GESTION_${Date.now()}_${sanitizedName}`;

            const { error } = await supabase.storage
                .from(BUCKET)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
            setReportFile({ name: file.name, url: data.publicUrl });
            alert("Informe cargado correctamente.");

        } catch (error: any) {
            console.error("Error uploading report:", error);
            alert(`Error al subir informe: ${error.message}`);
        } finally {
            setUploadingReport(false);
        }
    };

    const handleDownloadReport = () => {
        if (reportFile) {
            window.open(reportFile.url, '_blank');
        }
    };

    const isAdmin = profile?.rol === 'Administrador';
    const isClosed = caso?.estado === 'CERRADO';
    const actionsDisabled = isClosed && !isAdmin;

    return (
        <div className={styles.wrapper}>
            <div className={styles.grid}>

                {/* INFORMES */}
                <div className={styles.col}>
                    <div className={styles.title}>Informes</div>
                    <div className={styles.buttons}>
                        <button
                            className={styles.btn}
                            onClick={() => handleAction('Generar Informe')}
                            disabled={actionsDisabled}
                            style={{ opacity: actionsDisabled ? 0.6 : 1, cursor: actionsDisabled ? 'not-allowed' : 'pointer' }}
                        >
                            <span>INFORME</span> <Printer size={16} />
                        </button>
                        <button
                            className={styles.btn}
                            onClick={() => handleAction('Informe Desiste')}
                            disabled={actionsDisabled}
                            style={{ opacity: actionsDisabled ? 0.6 : 1, cursor: actionsDisabled ? 'not-allowed' : 'pointer' }}
                        >
                            <span>INFORME DESISTE</span> <FileText size={16} />
                        </button>
                        <button
                            className={styles.btn}
                            onClick={() => handleAction('Preinforme')}
                            disabled={actionsDisabled}
                            style={{ opacity: actionsDisabled ? 0.6 : 1, cursor: actionsDisabled ? 'not-allowed' : 'pointer' }}
                        >
                            <span>PREINFORME</span> <FileText size={16} />
                        </button>
                    </div>
                </div>

                {/* NOTAS */}
                <div className={styles.col}>
                    <div className={styles.title}>Notas</div>
                    <div className={styles.buttons}>
                        <button
                            className={styles.btn}
                            onClick={() => handleAction('Nota Desiste')}
                            disabled={actionsDisabled}
                            style={{ opacity: actionsDisabled ? 0.6 : 1, cursor: actionsDisabled ? 'not-allowed' : 'pointer' }}
                        >
                            <span>NOTA DESISTE</span> <FileText size={16} />
                        </button>
                        <button
                            className={styles.btn}
                            onClick={() => handleAction('Nota Desiste C/Póliza')}
                            disabled={actionsDisabled}
                            style={{ opacity: actionsDisabled ? 0.6 : 1, cursor: actionsDisabled ? 'not-allowed' : 'pointer' }}
                        >
                            <span>NOTA DESISTE C/PÓLIZA</span> <FileText size={16} />
                        </button>
                        <button
                            className={styles.btn}
                            onClick={() => handleAction('Nota Orden de Compra')}
                            disabled={actionsDisabled}
                            style={{ opacity: actionsDisabled ? 0.6 : 1, cursor: actionsDisabled ? 'not-allowed' : 'pointer' }}
                        >
                            <span>NOTA ORDEN DE COMPRA</span> <FileText size={16} />
                        </button>
                        <button
                            className={styles.btn}
                            onClick={() => handleAction('Nota Efectivo')}
                            disabled={actionsDisabled}
                            style={{ opacity: actionsDisabled ? 0.6 : 1, cursor: actionsDisabled ? 'not-allowed' : 'pointer' }}
                        >
                            <span>NOTA EFECTIVO</span> <FileText size={16} />
                        </button>
                    </div>
                </div>

                {/* GESTIÓN */}
                <div className={styles.col}>
                    <div className={styles.title}>Gestión</div>
                    <div className={styles.buttons}>
                        <button
                            className={styles.btn}
                            onClick={() => handleAction('Enviar a Informes')}
                            disabled={actionsDisabled}
                            style={{ opacity: actionsDisabled ? 0.6 : 1, cursor: actionsDisabled ? 'not-allowed' : 'pointer' }}
                        >
                            <span>ENVIAR A INFORMES</span> <ArrowRight size={16} />
                        </button>
                        <button
                            className={styles.btn}
                            onClick={() => handleAction('Mail a Proveedor')}
                            disabled={actionsDisabled}
                            style={{ opacity: actionsDisabled ? 0.6 : 1, cursor: actionsDisabled ? 'not-allowed' : 'pointer' }}
                        >
                            <span>MAIL A PROVEEDOR</span> <Mail size={16} />
                        </button>
                        <button
                            className={styles.btn}
                            onClick={() => handleAction('Declaración')}
                            disabled={actionsDisabled}
                            style={{ opacity: actionsDisabled ? 0.6 : 1, cursor: actionsDisabled ? 'not-allowed' : 'pointer' }}
                        >
                            <span>DECLARACIÓN</span> <FileCheck size={16} />
                        </button>
                        <button
                            className={styles.btn}
                            onClick={() => handleAction('Interrupción de Plazos')}
                            disabled={actionsDisabled}
                            style={{ opacity: actionsDisabled ? 0.6 : 1, cursor: actionsDisabled ? 'not-allowed' : 'pointer' }}
                        >
                            <span>INTERRUPCIÓN DE PLAZOS</span> <FileText size={16} />
                        </button>
                        <button
                            className={styles.btn}
                            onClick={() => handleAction('Consulta de Antecedentes')}
                            disabled={actionsDisabled}
                            style={{ opacity: actionsDisabled ? 0.6 : 1, cursor: actionsDisabled ? 'not-allowed' : 'pointer' }}
                        >
                            <span>CONSULTA DE ANTECEDENTES</span> <FileText size={16} />
                        </button>
                    </div>
                </div>

                {/* ACCION CERRAR */}
                <div className={styles.col} style={{ gridColumn: '1 / -1' }}>
                    <div className={styles.title}>Cerrar Caso</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                        {SUB_ESTADOS_CERRADO.map(sub => (
                            <button
                                key={sub}
                                className={styles.btn}
                                disabled={actionsDisabled}
                                style={{
                                    background: 'rgba(16, 185, 129, 0.1)',
                                    borderColor: 'rgba(16, 185, 129, 0.2)',
                                    color: '#10b981',
                                    fontWeight: '800',
                                    textAlign: 'center',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    opacity: actionsDisabled ? 0.6 : 1,
                                    cursor: actionsDisabled ? 'not-allowed' : 'pointer'
                                }}
                                onClick={async () => {
                                    if (confirm(`¿Está seguro de cerrar el caso como ${sub}?`)) {
                                        const hoy = new Date().toISOString().split('T')[0];
                                        await onStatusUpdate?.({
                                            estado: 'CERRADO',
                                            sub_estado: sub,
                                            fecha_cierre: hoy
                                        });
                                    }
                                }}
                            >
                                {sub}
                            </button>
                        ))}
                    </div>

                    {/* NUEVO CAMPO ADJUNTAR PDF */}
                    <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--line-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div className={styles.title} style={{ borderBottom: 'none', margin: 0, padding: 0, fontSize: '12px' }}>Adjuntar Informe PDF (Gestión)</div>
                            {reportFile && (
                                <button
                                    onClick={handleDownloadReport}
                                    style={{
                                        padding: '4px 10px',
                                        fontSize: '11px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        background: 'rgba(54, 153, 255, 0.1)',
                                        border: '1px solid rgba(54, 153, 255, 0.2)',
                                        borderRadius: '4px',
                                        color: '#3699ff',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <FileText size={12} /> Ver Informe Actual <Download size={12} />
                                </button>
                            )}
                        </div>
                        {uploadingReport ? (
                            <div style={{ textAlign: 'center', padding: '10px', color: 'var(--primary-color)' }}>Subiendo...</div>
                        ) : (
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <Dropzone
                                        onFileSelect={handleUploadReport}
                                        label={reportFile ? reportFile.name : "Seleccionar Informe"}
                                        subLabel="PDF format"
                                        accept="application/pdf"
                                    />
                                </div>
                                {reportFile && <Paperclip size={20} color="var(--primary-color)" />}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};
