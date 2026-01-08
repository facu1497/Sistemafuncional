import { useEffect, useState, useRef } from 'react';
import { Layout } from '../layouts/Layout';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import styles from './Lista.module.css';
import { read, utils } from 'xlsx';

export const Lista = () => {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [casos, setCasos] = useState<any[]>([]);
    const [filteredCasos, setFilteredCasos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [catalogs, setCatalogs] = useState({
        companias: [] as any[],
        analistas: [] as any[],
        estados: [] as any[]
    });

    const [filters, setFilters] = useState({
        siniestro: '',
        asegurado: '',
        dni: '',
        compania: '',
        analista: '',
        estado: '',
        misCasos: false
    });

    const [showNewCase, setShowNewCase] = useState(false);
    const [newCase, setNewCase] = useState({
        cia: '',
        asegurado: '',
        dni: '',
        nSiniestro: '',
        poliza: '',
        ramo: '',
        analista: '',
        telefono: '',
        mail: '',
        fecha_ingreso: new Date().toISOString().split('T')[0],
        fecha_denuncia: '',
        fecha_siniestro: '',
        motivo_derivacion: '',
        causa: '',
        tramitador: '',
        fecha_contratacion: '',
        vigencia_hasta: '',
        calle: '',
        nro: '',
        piso: '',
        localidad: '',
        provincia: '',
        calle_riesgo: '',
        nro_r: '',
        piso_r: '',
        localidad_r: '',
        provincia_r: ''
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadData();
    }, []);

    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' }>({
        key: 'id',
        direction: 'ascending'
    });

    useEffect(() => {
        applyFilters();
    }, [filters, casos, sortConfig]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Load Catalogs
            const [ciaRes, anaRes, estRes] = await Promise.all([
                supabase.from('companias').select('*').eq('activo', 1),
                supabase.from('analistas').select('*').eq('activo', 1),
                supabase.from('estados').select('*').eq('activo', 1)
            ]);

            setCatalogs({
                companias: ciaRes.data || [],
                analistas: anaRes.data || [],
                estados: estRes.data || []
            });

            // 2. Load Casos
            const { data, error } = await supabase
                .from('casos')
                .select('*')
                .order('id', { ascending: true }); // Default fetching ascending, client sorts anyway

            if (error) throw error;
            setCasos(data || []);
        } catch (err) {
            console.error("Error loading data:", err);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let res = [...casos]; // Create copy

        if (filters.misCasos && (user || profile)) {
            const userName = profile?.nombre || user?.user_metadata?.nombre;
            if (userName) {
                const target = userName.toLowerCase();
                res = res.filter(c => c.analista && c.analista.toLowerCase() === target);
            }
        }

        if (filters.siniestro) res = res.filter(c => String(c.n_siniestro).toLowerCase().includes(filters.siniestro.toLowerCase()));
        if (filters.asegurado) res = res.filter(c => c.asegurado?.toLowerCase().includes(filters.asegurado.toLowerCase()));
        if (filters.dni) res = res.filter(c => String(c.dni).includes(filters.dni));
        if (filters.compania) res = res.filter(c => c.cia === filters.compania);
        if (filters.analista) res = res.filter(c => c.analista === filters.analista);
        if (filters.estado) res = res.filter(c => c.estado === filters.estado);

        // Sorting
        res.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (a[sortConfig.key] > b[sortConfig.key]) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });

        setFilteredCasos(res);
    };

    const requestSort = (key: string) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleFilterChange = (field: string, value: any) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveNewCase = async () => {
        const {
            cia, asegurado, nSiniestro, fecha_ingreso
        } = newCase;

        if (!cia || !asegurado || !nSiniestro || !fecha_ingreso) {
            alert("Completa los campos obligatorios (*): Asegurado, Compañía, N° Siniestro y Fecha de Asignación");
            return;
        }

        try {
            const payload = {
                ...newCase,
                n_siniestro: newCase.nSiniestro,
                estado: 'ENTREVISTAR'
            };
            // Remove the temporary camelCase key
            delete (payload as any).nSiniestro;

            const { error } = await supabase.from('casos').insert(payload);
            if (error) throw error;

            alert("Caso creado correctamente");
            setShowNewCase(false);
            setNewCase({
                cia: '',
                asegurado: '',
                dni: '',
                nSiniestro: '',
                poliza: '',
                ramo: '',
                analista: '',
                telefono: '',
                mail: '',
                fecha_ingreso: new Date().toISOString().split('T')[0],
                fecha_denuncia: '',
                fecha_siniestro: '',
                motivo_derivacion: '',
                causa: '',
                tramitador: '',
                fecha_contratacion: '',
                vigencia_hasta: '',
                calle: '',
                nro: '',
                piso: '',
                localidad: '',
                provincia: '',
                calle_riesgo: '',
                nro_r: '',
                piso_r: '',
                localidad_r: '',
                provincia_r: ''
            });
            loadData(); // Reload list
        } catch (err: any) {
            alert("Error al guardar: " + err.message);
        }
    };

    // --- IMPORT EXCEL ---
    const handleImportClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = utils.sheet_to_json(ws);

                if (data.length === 0) {
                    alert('El archivo está vacío.');
                    return;
                }

                // Helper to normalize keys and finding values
                const normalize = (str: string) => str.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                const findVal = (row: any, aliases: string[]) => {
                    const keys = Object.keys(row);
                    const match = keys.find(k => aliases.includes(normalize(k)));
                    return match ? row[match] : null;
                };

                const parseDate = (val: any) => {
                    if (!val) return null;
                    // If it's a number (Excel serial date)
                    if (typeof val === 'number') {
                        const date = new Date((val - 25569) * 86400 * 1000);
                        return date.toISOString().split('T')[0];
                    }
                    // If it's a string
                    if (typeof val === 'string') {
                        // Check if it's DD/MM/YYYY
                        const parts = val.split('/');
                        if (parts.length === 3) {
                            const d = parts[0].padStart(2, '0');
                            const m = parts[1].padStart(2, '0');
                            const y = parts[2];
                            return `${y}-${m}-${d}`;
                        }
                        // Default browser parsing (for ISO etc)
                        const d = new Date(val);
                        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
                    }
                    return val;
                };

                // Map data to DB columns using fuzzy matching
                const mappedData = data.map((row: any) => {
                    const statusVal = String(findVal(row, ['estado', 'status', 'situacion']) || '').toUpperCase().trim();
                    const validStatus = catalogs.estados.find(e => e.nombre.toUpperCase() === statusVal);

                    const mapped = {
                        n_siniestro: String(findVal(row, ['siniestro', 'n_siniestro', 'n siniestro', 'numero siniestro', 'num siniestro', 'nro siniestro', 'expediente', 'carpeta', 'caso']) || '').trim(),
                        cia: findVal(row, ['compania', 'cia', 'aseguradora', 'empresa', 'cliente']),
                        asegurado: findVal(row, ['asegurado', 'nombre', 'asociado', 'tercero']),
                        dni: findVal(row, ['dni', 'documento', 'cuit', 'cuil', 'nro doc']),
                        poliza: findVal(row, ['poliza', 'nro poliza', 'num poliza', 'policy']),
                        ramo: findVal(row, ['ramo', 'tipo', 'cobertura']),
                        analista: findVal(row, ['analista', 'gestor', 'asignado', 'asignado a']),
                        telefono: findVal(row, ['telefono', 'tel', 'celular', 'cel']),
                        mail: findVal(row, ['mail', 'correo', 'email']),
                        fecha_ingreso: parseDate(findVal(row, ['fecha ingreso', 'fecha_ingreso', 'asignacion', 'fecha asignacion', 'f_ingreso', 'f_asignacion'])) || new Date().toISOString().split('T')[0],
                        fecha_denuncia: parseDate(findVal(row, ['fecha denuncia', 'fecha_denuncia', 'f_denuncia'])),
                        fecha_siniestro: parseDate(findVal(row, ['fecha siniestro', 'fecha_siniestro', 'f_siniestro', 'fecha del hecho'])),
                        motivo_derivacion: findVal(row, ['comentarios', 'comentario derivacion', 'motivo', 'derivacion', 'obs', 'observaciones']),
                        causa: findVal(row, ['causa', 'motivo siniestro']),
                        tramitador: findVal(row, ['tramitador', 'inspector']),
                        fecha_contratacion: parseDate(findVal(row, ['contratacion', 'fecha contratacion', 'f_contratacion'])),
                        vigencia_hasta: parseDate(findVal(row, ['vigencia', 'vigencia hasta', 'vencimiento'])),
                        calle: findVal(row, ['calle', 'domicilio', 'direccion']),
                        nro: findVal(row, ['nro', 'numero', 'altura']),
                        piso: findVal(row, ['piso', 'depto', 'departamento']),
                        localidad: findVal(row, ['localidad', 'ciudad']),
                        provincia: findVal(row, ['provincia', 'estado prov']),
                        calle_riesgo: findVal(row, ['calle riesgo', 'direccion riesgo', 'lugar del hecho']),
                        nro_r: findVal(row, ['nro riesgo', 'numero riesgo']),
                        piso_r: findVal(row, ['piso riesgo', 'depto riesgo']),
                        localidad_r: findVal(row, ['localidad riesgo', 'ciudad riesgo']),
                        provincia_r: findVal(row, ['provincia riesgo']),
                        estado: validStatus ? validStatus.nombre : 'ENTREVISTAR'
                    };
                    return mapped;
                }).filter((item: any) => item.n_siniestro && item.cia && item.asegurado && item.fecha_ingreso);

                if (mappedData.length === 0) {
                    alert('No se pudieron encontrar casos válidos. Verifique los nombres de las columnas (Siniestro, Compania, Asegurado).');
                    return;
                }

                // --- DUPLICATE CHECK ---
                // 1. Internal deduplication (within the same Excel)
                const uniqueInFile: any[] = [];
                const seenInFile = new Set();
                mappedData.forEach(m => {
                    if (!seenInFile.has(m.n_siniestro)) {
                        seenInFile.add(m.n_siniestro);
                        uniqueInFile.push(m);
                    }
                });

                // 2. Database check
                const allSiniestros = uniqueInFile.map(m => m.n_siniestro);
                const { data: existingCasos } = await supabase
                    .from('casos')
                    .select('n_siniestro')
                    .in('n_siniestro', allSiniestros);

                const existingSet = new Set(existingCasos?.map(c => String(c.n_siniestro).trim()) || []);
                const finalData = uniqueInFile.filter(m => !existingSet.has(m.n_siniestro));
                const skippedCount = mappedData.length - finalData.length;

                if (finalData.length === 0) {
                    alert(`No hay casos nuevos para importar. Los ${mappedData.length} casos ya existen en el sistema (o están duplicados en su Excel).`);
                    return;
                }

                const { error } = await supabase.from('casos').insert(finalData);

                if (error) {
                    console.error('Error importing cases:', error);
                    alert('Error al importar casos: ' + error.message);
                } else {
                    let msg = `${finalData.length} casos importados correctamente.`;
                    if (skippedCount > 0) msg += ` Se omitieron ${skippedCount} casos por estar ya registrados.`;
                    alert(msg);
                    loadData();
                }

            } catch (error: any) {
                console.error('Error parsing file:', error);
                alert('Error al procesar el archivo Excel: ' + error.message);
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const getEstadoColor = (nombre: string) => {
        const est = catalogs.estados.find(e => e.nombre === nombre);
        return est?.color || '#3699ff'; // Default blue
    };

    return (
        <Layout>
            <div className={styles.topActions}>
                <div className={styles.titleSection}>
                    <h1>Listado de Casos</h1>
                    <p>{filteredCasos.length} casos encontrados</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                        accept=".xlsx, .xls"
                    />
                    <button className={styles.secondaryBtn} onClick={handleImportClick}>
                        Importar Excel
                    </button>
                    <button className={styles.primaryBtn} onClick={() => setShowNewCase(!showNewCase)}>
                        {showNewCase ? 'Cerrar Panel' : 'Nuevo Caso +'}
                    </button>
                </div>
            </div>

            {/* PANEL NUEVO CASO */}
            {showNewCase && (
                <div className={styles.newCasePanel}>
                    <h3 className={styles.filterHeader}>Alta de Nuevo Caso</h3>

                    <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                        <div style={{ color: 'var(--primary-color)', fontWeight: 600, borderBottom: '1px solid var(--line-color)', paddingBottom: '8px', marginBottom: '15px' }}>Datos Principales</div>
                        <div className={styles.formGrid}>
                            <div className={styles.filterGroup}>
                                <label>Compañía *</label>
                                <select className={styles.select} value={newCase.cia} onChange={e => setNewCase({ ...newCase, cia: e.target.value })}>
                                    <option value="">Seleccionar...</option>
                                    {catalogs.companias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                                </select>
                            </div>
                            <div className={styles.filterGroup}>
                                <label>Asegurado *</label>
                                <input className={styles.input} type="text" placeholder="Nombre completo" value={newCase.asegurado} onChange={e => setNewCase({ ...newCase, asegurado: e.target.value })} />
                            </div>
                            <div className={styles.filterGroup}>
                                <label>N° Siniestro *</label>
                                <input className={styles.input} type="text" value={newCase.nSiniestro} onChange={e => setNewCase({ ...newCase, nSiniestro: e.target.value })} />
                            </div>
                            <div className={styles.filterGroup}>
                                <label>Fecha Asignación *</label>
                                <input className={styles.input} type="date" value={newCase.fecha_ingreso} onChange={e => setNewCase({ ...newCase, fecha_ingreso: e.target.value })} />
                            </div>
                            <div className={styles.filterGroup}>
                                <label>Analista</label>
                                <select className={styles.select} value={newCase.analista} onChange={e => setNewCase({ ...newCase, analista: e.target.value })}>
                                    <option value="">Seleccionar...</option>
                                    {catalogs.analistas.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                                </select>
                            </div>
                            <div className={styles.filterGroup}>
                                <label>DNI</label>
                                <input className={styles.input} type="text" value={newCase.dni} onChange={e => setNewCase({ ...newCase, dni: e.target.value })} />
                            </div>
                            <div className={styles.filterGroup}>
                                <label>Póliza</label>
                                <input className={styles.input} type="text" value={newCase.poliza} onChange={e => setNewCase({ ...newCase, poliza: e.target.value })} />
                            </div>
                            <div className={styles.filterGroup}>
                                <label>Ramo</label>
                                <input className={styles.input} type="text" value={newCase.ramo} onChange={e => setNewCase({ ...newCase, ramo: e.target.value })} />
                            </div>
                            <div className={styles.filterGroup}>
                                <label>Causa</label>
                                <input className={styles.input} type="text" value={newCase.causa} onChange={e => setNewCase({ ...newCase, causa: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                        <div style={{ color: 'var(--primary-color)', fontWeight: 600, borderBottom: '1px solid var(--line-color)', paddingBottom: '8px', marginBottom: '15px' }}>Contacto y Detalles</div>
                        <div className={styles.formGrid}>
                            <div className={styles.filterGroup}>
                                <label>Mail</label>
                                <input className={styles.input} type="text" value={newCase.mail} onChange={e => setNewCase({ ...newCase, mail: e.target.value })} />
                            </div>
                            <div className={styles.filterGroup}>
                                <label>Teléfono</label>
                                <input className={styles.input} type="text" value={newCase.telefono} onChange={e => setNewCase({ ...newCase, telefono: e.target.value })} />
                            </div>
                            <div className={styles.filterGroup}>
                                <label>Tramitador</label>
                                <input className={styles.input} type="text" value={newCase.tramitador} onChange={e => setNewCase({ ...newCase, tramitador: e.target.value })} />
                            </div>
                            <div className={styles.filterGroup} style={{ gridColumn: '1 / -1' }}>
                                <label>Motivo de Derivación (Comentarios)</label>
                                <textarea className={styles.textarea} style={{ height: '60px' }} value={newCase.motivo_derivacion} onChange={e => setNewCase({ ...newCase, motivo_derivacion: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                        <div style={{ color: 'var(--primary-color)', fontWeight: 600, borderBottom: '1px solid var(--line-color)', paddingBottom: '8px', marginBottom: '15px' }}>Fechas Adicionales</div>
                        <div className={styles.formGrid}>
                            <div className={styles.filterGroup}>
                                <label>Fecha Siniestro</label>
                                <input className={styles.input} type="date" value={newCase.fecha_siniestro} onChange={e => setNewCase({ ...newCase, fecha_siniestro: e.target.value })} />
                            </div>
                            <div className={styles.filterGroup}>
                                <label>Fecha Denuncia</label>
                                <input className={styles.input} type="date" value={newCase.fecha_denuncia} onChange={e => setNewCase({ ...newCase, fecha_denuncia: e.target.value })} />
                            </div>
                            <div className={styles.filterGroup}>
                                <label>Fecha Contratación</label>
                                <input className={styles.input} type="date" value={newCase.fecha_contratacion} onChange={e => setNewCase({ ...newCase, fecha_contratacion: e.target.value })} />
                            </div>
                            <div className={styles.filterGroup}>
                                <label>Vigencia Hasta</label>
                                <input className={styles.input} type="date" value={newCase.vigencia_hasta} onChange={e => setNewCase({ ...newCase, vigencia_hasta: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                        <div style={{ color: 'var(--primary-color)', fontWeight: 600, borderBottom: '1px solid var(--line-color)', paddingBottom: '8px', marginBottom: '15px' }}>Domicilios</div>
                        <div className={styles.formGrid}>
                            <div className={styles.filterGroup}><label>Calle</label><input className={styles.input} value={newCase.calle} onChange={e => setNewCase({ ...newCase, calle: e.target.value })} /></div>
                            <div className={styles.filterGroup}><label>Nro</label><input className={styles.input} value={newCase.nro} onChange={e => setNewCase({ ...newCase, nro: e.target.value })} /></div>
                            <div className={styles.filterGroup}><label>Piso</label><input className={styles.input} value={newCase.piso} onChange={e => setNewCase({ ...newCase, piso: e.target.value })} /></div>
                            <div className={styles.filterGroup}><label>Localidad</label><input className={styles.input} value={newCase.localidad} onChange={e => setNewCase({ ...newCase, localidad: e.target.value })} /></div>
                            <div className={styles.filterGroup} style={{ gridColumn: 'span 2' }}><label>Provincia</label><input className={styles.input} value={newCase.provincia} onChange={e => setNewCase({ ...newCase, provincia: e.target.value })} /></div>

                            <div className={styles.filterGroup} style={{ gridColumn: '1 / -1', marginTop: '10px', paddingTop: '10px', borderTop: '1px dotted var(--line-color)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <input type="checkbox" id="copyAddr" onChange={e => {
                                        if (e.target.checked) {
                                            setNewCase(prev => ({ ...prev, calle_riesgo: prev.calle, nro_r: prev.nro, piso_r: prev.piso, localidad_r: prev.localidad, provincia_r: prev.provincia }));
                                        }
                                    }} />
                                    <label htmlFor="copyAddr" style={{ margin: 0, cursor: 'pointer' }}>Mismo domicilio de riesgo</label>
                                </div>
                            </div>

                            <div className={styles.filterGroup}><label>Calle (R)</label><input className={styles.input} value={newCase.calle_riesgo} onChange={e => setNewCase({ ...newCase, calle_riesgo: e.target.value })} /></div>
                            <div className={styles.filterGroup}><label>Nro (R)</label><input className={styles.input} value={newCase.nro_r} onChange={e => setNewCase({ ...newCase, nro_r: e.target.value })} /></div>
                            <div className={styles.filterGroup}><label>Piso (R)</label><input className={styles.input} value={newCase.piso_r} onChange={e => setNewCase({ ...newCase, piso_r: e.target.value })} /></div>
                            <div className={styles.filterGroup}><label>Localidad (R)</label><input className={styles.input} value={newCase.localidad_r} onChange={e => setNewCase({ ...newCase, localidad_r: e.target.value })} /></div>
                            <div className={styles.filterGroup} style={{ gridColumn: 'span 2' }}><label>Provincia (R)</label><input className={styles.input} value={newCase.provincia_r} onChange={e => setNewCase({ ...newCase, provincia_r: e.target.value })} /></div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '30px', paddingBottom: '20px' }}>
                        <button className={styles.primaryBtn} onClick={handleSaveNewCase} style={{ padding: '12px 30px', fontSize: '16px' }}>Guardar</button>
                        <button className={styles.secondaryBtn} onClick={() => setShowNewCase(false)} style={{ padding: '12px 30px', fontSize: '16px' }}>Cancelar</button>
                    </div>
                </div>
            )}

            {/* PANEL FILTROS */}
            <div className={styles.filterPanel}>
                <div className={styles.filterHeader}>FILTROS DE BÚSQUEDA</div>
                <div className={styles.filters}>
                    <div className={styles.filterGroup}>
                        <label>N° Siniestro</label>
                        <input className={styles.input} type="text" placeholder="Buscar..."
                            value={filters.siniestro} onChange={e => handleFilterChange('siniestro', e.target.value)} />
                    </div>
                    <div className={styles.filterGroup}>
                        <label>Asegurado</label>
                        <input className={styles.input} type="text" placeholder="Buscar..."
                            value={filters.asegurado} onChange={e => handleFilterChange('asegurado', e.target.value)} />
                    </div>
                    <div className={styles.filterGroup}>
                        <label>DNI</label>
                        <input className={styles.input} type="text" placeholder="Buscar..."
                            value={filters.dni} onChange={e => handleFilterChange('dni', e.target.value)} />
                    </div>
                    <div className={styles.filterGroup}>
                        <label>Compañía</label>
                        <select className={styles.select} value={filters.compania} onChange={e => handleFilterChange('compania', e.target.value)}>
                            <option value="">Todas</option>
                            {catalogs.companias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                        </select>
                    </div>
                    <div className={styles.filterGroup}>
                        <label>Analista</label>
                        <select className={styles.select} value={filters.analista} onChange={e => handleFilterChange('analista', e.target.value)}>
                            <option value="">Todos</option>
                            {catalogs.analistas.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                        </select>
                    </div>
                    <div className={styles.filterGroup}>
                        <label>Estado</label>
                        <select className={styles.select} value={filters.estado} onChange={e => handleFilterChange('estado', e.target.value)}>
                            <option value="">Todos</option>
                            {catalogs.estados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                        </select>
                    </div>
                    <div className={styles.filterGroup} style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: '8px' }}>
                        <input type="checkbox" id="misCasos"
                            checked={filters.misCasos} onChange={e => handleFilterChange('misCasos', e.target.checked)} />
                        <label htmlFor="misCasos" style={{ cursor: 'pointer', margin: 0 }}>Solo mis casos</label>
                    </div>
                </div>
            </div>

            {/* TABLA DE RESULTADOS */}
            <div className={styles.tableContainer}>
                {loading ? <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted-color)' }}>Cargando datos...</div> : (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th onClick={() => requestSort('id')} style={{ cursor: 'pointer' }}>
                                    Nº {sortConfig.key === 'id' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                                </th>
                                <th onClick={() => requestSort('n_siniestro')} style={{ cursor: 'pointer' }}>
                                    N° Siniestro {sortConfig.key === 'n_siniestro' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                                </th>
                                <th onClick={() => requestSort('asegurado')} style={{ cursor: 'pointer' }}>
                                    Asegurado / DNI {sortConfig.key === 'asegurado' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                                </th>
                                <th onClick={() => requestSort('cia')} style={{ cursor: 'pointer' }}>
                                    Compañía {sortConfig.key === 'cia' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                                </th>
                                <th onClick={() => requestSort('analista')} style={{ cursor: 'pointer' }}>
                                    Analista {sortConfig.key === 'analista' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                                </th>
                                <th onClick={() => requestSort('estado')} style={{ cursor: 'pointer' }}>
                                    Estado {sortConfig.key === 'estado' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                                </th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCasos.map(caso => (
                                <tr key={caso.id}>
                                    <td style={{ color: 'var(--muted-color)', fontSize: '12px' }}>{caso.id}</td>
                                    <td style={{ fontWeight: 600 }}>{caso.n_siniestro}</td>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{caso.asegurado}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--muted-color)' }}>{caso.dni || '-'}</div>
                                    </td>
                                    <td style={{ color: 'var(--muted-color)' }}>{caso.cia}</td>
                                    <td style={{ color: 'var(--muted-color)' }}>{caso.analista || '-'}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                                            <span
                                                className={styles.badge}
                                                style={{
                                                    backgroundColor: getEstadoColor(caso.estado) + '15',
                                                    color: getEstadoColor(caso.estado),
                                                    borderColor: getEstadoColor(caso.estado) + '30',
                                                    fontSize: '11px',
                                                    fontWeight: '700',
                                                    padding: '4px 10px',
                                                    borderRadius: '12px',
                                                    width: 'fit-content'
                                                }}
                                            >
                                                {caso.estado || 'SIN ESTADO'}
                                            </span>
                                            {caso.sub_estado && (
                                                <span style={{
                                                    fontSize: '10px',
                                                    color: 'var(--muted-color)',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    textAlign: 'center',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.5px'
                                                }}>
                                                    {caso.sub_estado}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <button
                                            className={styles.actionBtn}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/detalle/${caso.id}`); // Assuming ID or n_siniestro
                                            }}
                                        >
                                            Ver Detalle
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredCasos.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--muted-color)' }}>
                                        No se encontraron casos que coincidan con los filtros.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </Layout>
    );
};
