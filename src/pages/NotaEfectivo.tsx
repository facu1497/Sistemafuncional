import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { numeroALetras } from '../utils/NumberToWords';
import styles from './NotaEfectivo.module.css';
import { Printer, ArrowLeft } from 'lucide-react';

export const NotaEfectivo = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [caso, setCaso] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCaso();
    }, [id]);

    const fetchCaso = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('casos')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            setCaso(data);
        } catch (err) {
            console.error("Error fetching caso:", err);
            alert("No se pudo cargar el caso");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className={styles.page}>Cargando...</div>;
    if (!caso) return <div className={styles.page}>Caso no encontrado</div>;

    const parseMonto = (val: string | number): number => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        let s = String(val).trim();
        s = s.replace(/\$/g, '');
        s = s.replace(/\./g, '');
        s = s.replace(',', '.');
        const num = parseFloat(s);
        return isNaN(num) ? 0 : num;
    };

    const calculateTotalEfectivo = (danos: any[]) => {
        if (!danos || !Array.isArray(danos)) return 0;
        let total = 0;
        danos.forEach(cob => {
            (cob.items || []).forEach((item: any) => {
                if (!item.esProveedor) {
                    total += parseMonto(item.montoIndemnizacion);
                }
            });
        });
        return total;
    };

    const totalEfectivo = calculateTotalEfectivo(caso.tabla_daños);
    const montoLetras = numeroALetras(totalEfectivo);
    const fechaActual = new Date().toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className={styles.page}>
            <div className={styles.controls}>
                <button className={styles.btnBack} onClick={() => navigate(-1)}>
                    <ArrowLeft size={18} /> Volver
                </button>
                <button className={styles.btnPrint} onClick={handlePrint}>
                    <Printer size={18} /> Imprimir
                </button>
            </div>

            <div className={styles.document}>
                <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                    Buenos Aires, {fechaActual}
                </div>
                <div className={styles.recipient}>
                    Sr. Gerente<br />
                    {caso.cia || '.....................'}
                </div>

                <div className={styles.header}>
                    De mi mayor consideración:
                </div>

                <div className={styles.reference}>
                    Referencia:<br />
                    SINIESTRO {caso.n_siniestro || '.......'} / POLIZA {caso.poliza || '.......'}
                </div>

                <div className={styles.body}>
                    Por la presente, informo que, habiendo cumplido con la entrega de toda la información y
                    documentación requerida por el Estudio Gibert con fecha actual, acepto, conforme a las
                    condiciones contractuales vigentes, la siguiente liquidación en concepto de indemnización:
                    <br /><br />
                    <strong>Indemnización dineraria: $ {totalEfectivo.toLocaleString('es-AR')} ({montoLetras} PESOS).</strong>
                    <br /><br />
                    Solicito, asimismo, que el monto mencionado sea transferido a la siguiente cuenta bancaria
                    de mi titularidad en el Banco ________________________:
                </div>

                <div className={styles.bankDetails}>
                    <div className={styles.bankItem}>TIPO DE CUENTA:</div>
                    <div className={styles.bankItem}>NRO DE CUENTA:</div>
                    <div className={styles.bankItem}>CBU:</div>
                    <div className={styles.bankItem}>FILIAL:</div>
                </div>

                <div className={styles.body}>
                    Declaro que, una vez percibida la indemnización señalada, renuncio expresamente a
                    cualquier otro reclamo relacionado con el presente caso.
                    <br /><br />
                    Asimismo, confirmo que la única póliza vigente relacionada con el siniestro es aquella
                    contratada con {caso.cia || '.......'} y ratifico íntegramente las circunstancias que dieron lugar al
                    evento denunciado.
                    <br /><br />
                    Adicionalmente, declaro bajo juramento que no me encuentro incluido ni alcanzado dentro
                    de la categoría de "Personas Expuestas Políticamente" según la normativa vigente.
                    <br /><br />
                    Quedo a disposición para cualquier aclaración adicional y, sin otro particular, saludo a
                    usted con la mayor consideración.
                </div>

                <div className={styles.footer}>
                    Atentamente,
                    <br /><br />
                    <div className={styles.signatureLine}>FIRMA</div>
                    <div className={styles.infoLine}><strong>Aclaración:</strong> {caso.asegurado || '.....................'}</div>
                    <div className={styles.infoLine}><strong>DNI:</strong> {caso.dni || '.....................'}</div>
                </div>

                <div className={styles.disclaimer}>
                    <strong>Nota aclaratoria:</strong><br />
                    Se deja expresa constancia de que el presente constituye una propuesta de indemnización
                    formulada por el estudio liquidador para ser evaluada y aprobada por la aseguradora. Hasta
                    tanto dicha aprobación sea emitida, {caso.cia || '.......'} no asume obligación ni compromiso alguno
                    de pago respecto del asegurado o damnificado.
                </div>
            </div>
        </div>
    );
};
