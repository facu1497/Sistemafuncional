import { useNavigate } from 'react-router-dom';
import styles from './Gestion.module.css';
import { FileText, Mail, FileCheck, ArrowRight, Printer } from 'lucide-react';

interface GestionProps {
    nSiniestro: string;
    id: number | string;
    onStatusUpdate?: (status: { estado?: string, sub_estado?: string }) => Promise<void>;
}

const SUB_ESTADOS_CERRADO = ["DESISTIDO", "RECHAZADO", "PAGADO", "DADO DE BAJA"];

export const Gestion = ({ nSiniestro, id, onStatusUpdate }: GestionProps) => {
    const navigate = useNavigate();

    const handleAction = (action: string) => {
        if (action === 'Generar Informe') {
            navigate(`/informe/${id}`);
            return;
        }
        if (action === 'Informe Desiste') {
            navigate(`/informe-desiste/${id}`);
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
                                style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                onClick={async () => {
                                    if (confirm(`¿Está seguro de cerrar el caso como ${sub}?`)) {
                                        await onStatusUpdate?.({ estado: 'CERRADO', sub_estado: sub });
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
