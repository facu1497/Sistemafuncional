import { useNavigate } from 'react-router-dom';
import styles from './Gestion.module.css';
import { FileText, Mail, FileCheck, ArrowRight, Printer } from 'lucide-react';

interface GestionProps {
    nSiniestro: string;
    id: number | string;
}

export const Gestion = ({ nSiniestro, id }: GestionProps) => {
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

            </div>
        </div>
    );
};
