import { useState, useEffect, useRef } from 'react';
import styles from './InfoCaso.module.css';
import { Mic, Upload, ChevronDown, ChevronUp, FileAudio } from 'lucide-react';

interface InfoCasoProps {
    caso: any;
    catalogs: {
        analistas: any[];
        companias: any[];
    };
    onUpdate: (data: any) => Promise<void>;
}

export const InfoCaso = ({ caso, catalogs, onUpdate }: InfoCasoProps) => {
    const [form, setForm] = useState<any>(caso || {});
    const [expanded, setExpanded] = useState(false);
    const [transcribing, setTranscribing] = useState(false);
    const audioInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setForm(caso || {});
    }, [caso]);

    const handleChange = (field: string, value: any) => {
        setForm((prev: any) => ({ ...prev, [field]: value }));
    };

    const handleAddressCopy = (e: any) => {
        if (e.target.checked) {
            setForm((prev: any) => ({
                ...prev,
                calle_riesgo: prev.calle,
                nro_r: prev.nro,
                piso_r: prev.piso,
                localidad_r: prev.localidad,
                provincia_r: prev.provincia
            }));
        }
    };

    const handleSave = async () => {
        await onUpdate(form);
    };

    const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setTranscribing(true);

        const formData = new FormData();
        formData.append('file', file);

        try {
            // Call local backend (Ensure node server is running on port 5000)
            const res = await fetch('http://localhost:5000/api/transcribe', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Error en servidor de transcripción');
            }

            const newText = `\n[Transcripción ${file.name}]:\n${data.text}`;
            setForm((prev: any) => ({ ...prev, entrevista: (prev.entrevista || '') + newText }));

        } catch (err: any) {
            console.error("Transcription failed:", err);
            alert("Error al transcribir: " + err.message + "\n\nAsegúrate de que el servidor backend esté corriendo (cd server && npm start) y la API KEY configurada.");
        } finally {
            setTranscribing(false);
            if (audioInputRef.current) audioInputRef.current.value = '';
        }
    };

    return (
        <div className={styles.grid}>

            {/* VIEW MODE: IMPORTANT INFO + INTERVIEW */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* HEADERS SUMMARY */}
                <div className={styles.summaryBox}>
                    <div>
                        <div className={styles.label}>N° Siniestro</div>
                        <div style={{ fontWeight: 600 }}>{form.n_siniestro}</div>
                    </div>
                    <div>
                        <div className={styles.label}>Asegurado</div>
                        <div style={{ fontWeight: 600 }}>{form.asegurado}</div>
                    </div>
                    <div>
                        <div className={styles.label}>Compañía</div>
                        <div>{form.cia}</div>
                    </div>
                    <div>
                        <div className={styles.label}>Teléfono</div>
                        <div>{form.telefono || '-'}</div>
                    </div>
                    <div>
                        <div className={styles.label}>Mail</div>
                        <div>{form.mail || '-'}</div>
                    </div>
                </div>

                {/* COMENTARIOS DE DERIVACIÓN (READ-ONLY) */}
                {form.motivo_derivacion && (
                    <div className={styles.field}>
                        <label className={styles.label} style={{ fontSize: '14px', color: '#86efac' }}>
                            Comentarios de Derivación (Inicial)
                        </label>
                        <textarea
                            className={styles.input}
                            style={{ minHeight: '80px', lineHeight: '1.5', resize: 'none', opacity: 0.7, cursor: 'not-allowed' }}
                            value={form.motivo_derivacion || ''}
                            readOnly
                        />
                    </div>
                )}

                {/* ENTREVISTA + TRANSCRIPTION */}
                <div className={styles.field}>
                    <label className={styles.label} style={{ fontSize: '14px', color: 'var(--primary-color)' }}>
                        Comentarios de Entrevista (Transcripción)
                    </label>
                    <textarea
                        className={styles.input}
                        style={{ minHeight: '120px', lineHeight: '1.5', resize: 'vertical' }}
                        value={form.entrevista || ''}
                        onChange={e => handleChange('entrevista', e.target.value)}
                        placeholder="Escriba los comentarios o cargue un audio para transcribir..."
                    />

                    <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                        <input
                            type="file"
                            accept="audio/*,video/*"
                            ref={audioInputRef}
                            onChange={handleAudioUpload}
                            style={{ display: 'none' }}
                        />
                        <button
                            className={styles.btnSave}
                            style={{ width: 'auto', background: 'var(--secondary-color)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                            onClick={() => audioInputRef.current?.click()}
                            disabled={transcribing}
                        >
                            {transcribing ? 'Transcribiendo...' : 'Importar Audio/Video'}
                            <Upload size={14} />
                        </button>
                    </div>
                </div>

                <button className={styles.btnSave} onClick={handleSave} style={{ background: 'var(--secondary-color)' }}>
                    Guardar Cambios Principales
                </button>

                {/* TOGGLE FULL FORM */}
                <div
                    className={styles.toggleBtn}
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? 'Ocultar Datos Completos' : 'Modificar / Ver Datos Completos'}
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>

            </div>

            {/* FULL FORM (COLLAPSIBLE) */}
            {expanded && (
                <>
                    <div className={styles.sectionTitle}>Datos Completos del Caso</div>

                    <div className={styles.field}>
                        <label className={styles.label}>Analista</label>
                        <select className={styles.select} value={form.analista || ''} onChange={e => handleChange('analista', e.target.value)}>
                            <option value="">Seleccionar...</option>
                            {catalogs.analistas?.map((a: any) => <option key={a.id || a.nombre} value={a.nombre}>{a.nombre}</option>)}
                        </select>
                    </div>
                    {/* Simplified list, repeating critical fields to allow editing */}
                    <div className={styles.field}><label className={styles.label}>Asegurado</label><input className={styles.input} value={form.asegurado || ''} onChange={e => handleChange('asegurado', e.target.value)} /></div>
                    <div className={styles.field}><label className={styles.label}>DNI</label><input className={styles.input} value={form.dni || ''} onChange={e => handleChange('dni', e.target.value)} /></div>
                    <div className={styles.field}><label className={styles.label}>Teléfono</label><input className={styles.input} value={form.telefono || ''} onChange={e => handleChange('telefono', e.target.value)} /></div>
                    <div className={styles.field}><label className={styles.label}>Mail</label><input className={styles.input} value={form.mail || ''} onChange={e => handleChange('mail', e.target.value)} /></div>

                    <div className={styles.field}><label className={styles.label}>N° Siniestro</label><input className={styles.input} value={form.n_siniestro || ''} onChange={e => handleChange('n_siniestro', e.target.value)} /></div>
                    <div className={styles.field}><label className={styles.label}>Póliza</label><input className={styles.input} value={form.poliza || ''} onChange={e => handleChange('poliza', e.target.value)} /></div>
                    <div className={styles.field}><label className={styles.label}>Ramo</label><input className={styles.input} value={form.ramo || ''} onChange={e => handleChange('ramo', e.target.value)} /></div>
                    <div className={styles.field}><label className={styles.label}>Causa</label><input className={styles.input} value={form.causa || ''} onChange={e => handleChange('causa', e.target.value)} /></div>

                    <div className={styles.field}><label className={styles.label}>Tramitador</label><input className={styles.input} value={form.tramitador || ''} onChange={e => handleChange('tramitador', e.target.value)} /></div>

                    <div className={styles.sectionTitle}>Fechas</div>
                    <div className={styles.field}><label className={styles.label}>F. Contratación</label><input type="date" className={styles.input} value={form.fecha_contratacion || ''} onChange={e => handleChange('fecha_contratacion', e.target.value)} /></div>
                    <div className={styles.field}><label className={styles.label}>Vigencia Hasta</label><input type="date" className={styles.input} value={form.vigencia_hasta || ''} onChange={e => handleChange('vigencia_hasta', e.target.value)} /></div>
                    <div className={styles.field}><label className={styles.label}>F. Siniestro</label><input type="date" className={styles.input} value={form.fecha_siniestro || ''} onChange={e => handleChange('fecha_siniestro', e.target.value)} /></div>
                    <div className={styles.field}><label className={styles.label}>F. Denuncia</label><input type="date" className={styles.input} value={form.fecha_denuncia || ''} onChange={e => handleChange('fecha_denuncia', e.target.value)} /></div>
                    <div className={styles.field}><label className={styles.label}>F. Asignación</label><input type="date" className={styles.input} value={form.fecha_ingreso || ''} onChange={e => handleChange('fecha_ingreso', e.target.value)} /></div>

                    <div className={styles.sectionTitle}>Domicilio Asegurado</div>
                    <div className={styles.field}><label className={styles.label}>Calle</label><input className={styles.input} value={form.calle || ''} onChange={e => handleChange('calle', e.target.value)} /></div>
                    <div className={styles.field}><label className={styles.label}>N°</label><input className={styles.input} value={form.nro || ''} onChange={e => handleChange('nro', e.target.value)} /></div>
                    <div className={styles.field}><label className={styles.label}>Piso</label><input className={styles.input} value={form.piso || ''} onChange={e => handleChange('piso', e.target.value)} /></div>
                    <div className={styles.field}><label className={styles.label}>Localidad</label><input className={styles.input} value={form.localidad || ''} onChange={e => handleChange('localidad', e.target.value)} /></div>
                    <div className={styles.field}><label className={styles.label}>Provincia</label><input className={styles.input} value={form.provincia || ''} onChange={e => handleChange('provincia', e.target.value)} /></div>

                    <div className={styles.sectionTitle}>Domicilio Riesgo</div>
                    <label className={styles.checkboxLabel}><input type="checkbox" onChange={handleAddressCopy} /> Copiar Domicilio</label>
                    <div className={styles.field}><label className={styles.label}>Calle (R)</label><input className={styles.input} value={form.calle_riesgo || ''} onChange={e => handleChange('calle_riesgo', e.target.value)} /></div>
                    <div className={styles.field}><label className={styles.label}>N° (R)</label><input className={styles.input} value={form.nro_r || ''} onChange={e => handleChange('nro_r', e.target.value)} /></div>
                    <div className={styles.field}><label className={styles.label}>Piso (R)</label><input className={styles.input} value={form.piso_r || ''} onChange={e => handleChange('piso_r', e.target.value)} /></div>
                    <div className={styles.field}><label className={styles.label}>Localidad (R)</label><input className={styles.input} value={form.localidad_r || ''} onChange={e => handleChange('localidad_r', e.target.value)} /></div>
                    <div className={styles.field}><label className={styles.label}>Provincia (R)</label><input className={styles.input} value={form.provincia_r || ''} onChange={e => handleChange('provincia_r', e.target.value)} /></div>

                    <button className={styles.btnSave} onClick={handleSave} style={{ marginTop: '20px', background: 'var(--secondary-color)' }}>
                        Guardar Todos los Cambios
                    </button>
                </>
            )}

        </div>
    );
};
