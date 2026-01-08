import { useNavigate } from 'react-router-dom';
import styles from './Gestion.module.css';
import { FileText, Mail, FileCheck, ArrowRight, Printer } from 'lucide-react';

interface GestionProps {
    nSiniestro: string;
    id: number | string;
    mail?: string;
    checklist?: { text: string; checked: boolean }[];
    onStatusUpdate?: (status: { estado?: string, sub_estado?: string, fecha_cierre?: string | null }) => Promise<void>;
}

const SUB_ESTADOS_CERRADO = ["DESISTIDO", "RECHAZADO", "PAGADO", "DADO DE BAJA"];

export const Gestion = ({ nSiniestro, id, mail = '', checklist = [], onStatusUpdate }: GestionProps) => {
    const navigate = useNavigate();

    const handleAction = async (action: string) => {
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
            alert(`Acción "${action}" iniciada. Sub-estado actualizado a NOTA PENDIENTE.`);
            return;
        }

        if (action === 'Interrupción de Plazos') {
            console.log("Generando mail de interrupción...");
            const checklistArray = Array.isArray(checklist) ? checklist : [];
            const missingDocs = checklistArray
                .filter(item => !item.checked)
                .map(item => `- ${item.text}`)
                .join('\r\n');

            const subject = `Interrupción de Plazos - Siniestro ${nSiniestro}`;
            const body = `Buenas tardes,\r\nDe nuestra mayor consideración:\r\n\r\nNos dirigimos a Usted en relación al siniestro de referencia. Al respecto le informamos que, a los efectos de completar la evaluación del mismo, resulta imprescindible que nos sea remitida la siguiente documentación:\r\n\r\n${missingDocs}\r\n\r\nSe hace notar que hasta tanto sea recepcionada la documentación solicitada quedan suspendidos los plazos previstos para pronunciarse acerca del reclamo indemnizatorio, según lo establecido en el Art. 51 párrafo 2º de la ley 17.418.\r\n\r\nSin otro particular, saludamos atentamente.`;

            const mailtoUrl = `mailto:${mail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

            window.location.href = mailtoUrl;
            return;
        }

        alert(`Acción "${action}" para el siniestro ${nSiniestro} aún no implementada.`);
    };

    return (
        <div className={styles.wrapper}>
            <div className={styles.grid}>

                {/* INFORMES */}
                <div className={styles.col}>
                    <div className={styles.title}>Informes</div>
                    <div className={styles.buttons}>
                        <button className={styles.btn} onClick={() => handleAction('Generar Informe')}>
                            <span>INFORME</span> <Printer size={16} />
                        </button>
                        <button className={styles.btn} onClick={() => handleAction('Informe Desiste')}>
                            <span>INFORME DESISTE</span> <FileText size={16} />
                        </button>
                        <button className={styles.btn} onClick={() => handleAction('Preinforme')}>
                            <span>PREINFORME</span> <FileText size={16} />
                        </button>
                    </div>
                </div>

                {/* NOTAS */}
                <div className={styles.col}>
                    <div className={styles.title}>Notas</div>
                    <div className={styles.buttons}>
                        <button className={styles.btn} onClick={() => handleAction('Nota Desiste')}>
                            <span>NOTA DESISTE</span> <FileText size={16} />
                        </button>
                        <button className={styles.btn} onClick={() => handleAction('Nota Desiste C/Póliza')}>
                            <span>NOTA DESISTE C/PÓLIZA</span> <FileText size={16} />
                        </button>
                        <button className={styles.btn} onClick={() => handleAction('Nota Orden de Compra')}>
                            <span>NOTA ORDEN DE COMPRA</span> <FileText size={16} />
                        </button>
                        <button className={styles.btn} onClick={() => handleAction('Nota Efectivo')}>
                            <span>NOTA EFECTIVO</span> <FileText size={16} />
                        </button>
                    </div>
                </div>

                {/* GESTIÓN */}
                <div className={styles.col}>
                    <div className={styles.title}>Gestión</div>
                    <div className={styles.buttons}>
                        <button className={styles.btn} onClick={() => handleAction('Enviar a Informes')}>
                            <span>ENVIAR A INFORMES</span> <ArrowRight size={16} />
                        </button>
                        <button className={styles.btn} onClick={() => handleAction('Mail a OnCity')}>
                            <span>MAIL A ONCITY</span> <Mail size={16} />
                        </button>
                        <button className={styles.btn} onClick={() => handleAction('Declaración')}>
                            <span>DECLARACIÓN</span> <FileCheck size={16} />
                        </button>
                        <button className={styles.btn} onClick={() => handleAction('Interrupción de Plazos')}>
                            <span>INTERRUPCIÓN DE PLAZOS</span> <FileText size={16} />
                        </button>
                        <button className={styles.btn} onClick={() => handleAction('Consulta de Antecedentes')}>
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
                                style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}
                                onClick={async () => {
                                    if (confirm(`¿Está seguro de cerrar el caso como ${sub}?`)) {
                                        const hoy = new Date().toISOString().split('T')[0];
                                        await onStatusUpdate?.({
                                            estado: 'CERRADO',
                                            sub_estado: sub,
                                            fecha_cierre: hoy
                                        });
                                        alert(`Caso cerrado como ${sub}`);
                                    }
                                }}
                            >
                                {sub}
                            </button>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};
