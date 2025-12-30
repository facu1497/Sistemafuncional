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
        patente: '',
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
        motivo_derivacion: ''
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
            cia, asegurado, dni, nSiniestro, poliza, ramo, analista,
            telefono, mail, fecha_ingreso, fecha_denuncia, fecha_siniestro, motivo_derivacion
        } = newCase;

        if (!cia || !asegurado || !nSiniestro) {
            alert("Completa los campos obligatorios (*)");
            return;
        }

        try {
            const payload = {
                cia, asegurado, dni, n_siniestro: nSiniestro, poliza, ramo, analista,
                telefono, mail, fecha_ingreso, fecha_denuncia, fecha_siniestro, motivo_derivacion,
                estado: 'Ingresado', // Default state
                // fecha_ingreso is now user-defined
            };

            const { error } = await supabase.from('casos').insert(payload);
            if (error) throw error;

            alert("Caso creado correctamente");
            setShowNewCase(false);
            setNewCase({
                cia: '', asegurado: '', dni: '', nSiniestro: '', poliza: '', ramo: '', analista: '',
                telefono: '', mail: '', fecha_ingreso: new Date().toISOString().split('T')[0], fecha_denuncia: '', fecha_siniestro: '', motivo_derivacion: ''
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

                // Map data to DB columns using fuzzy matching
                const mappedData = data.map((row: any) => ({
                    n_siniestro: findVal(row, ['siniestro', 'n_siniestro', 'n siniestro', 'numero siniestro', 'num siniestro', 'nro siniestro', 'expediente', 'carpeta', 'caso']),
                    cia: findVal(row, ['compania', 'cia', 'aseguradora', 'empresa', 'cliente']),
                    asegurado: findVal(row, ['asegurado', 'nombre', 'asociado', 'tercero']),
                    dni: findVal(row, ['dni', 'documento', 'cuit', 'cuil', 'nro doc']),
                    poliza: findVal(row, ['poliza', 'nro poliza', 'num poliza', 'policy']),
                    ramo: findVal(row, ['ramo', 'tipo', 'cobertura']),
                    analista: findVal(row, ['analista', 'gestor', 'asignado', 'asignado a']),
                    patente: findVal(row, ['patente', 'dominio', 'vehiculo', 'matricula']),
                    estado: 'Ingresado',
                    fecha_ingreso: new Date().toISOString()
                })).filter((item: any) => item.n_siniestro && item.cia);

                if (mappedData.length === 0) {
                    alert('No se pudieron encontrar casos válidos. Verifique los nombres de las columnas (Siniestro, Compania, Asegurado).');
                    return;
                }

                const { error } = await supabase.from('casos').insert(mappedData);

                if (error) {
                    console.error('Error importing cases:', error);
                    alert('Error al importar casos: ' + error.message);
                } else {
                    alert(`${mappedData.length} casos importados correctamente.`);
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
                    <div className={styles.formGrid}>
                        <div className={styles.filterGroup}>
                            <label>Compañía *</label>
                            <select
                                className={styles.select}
                                value={newCase.cia}
                                onChange={e => setNewCase({ ...newCase, cia: e.target.value })}
                            >
                                <option value="">Seleccionar...</option>
                                {catalogs.companias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                            </select>
                        </div>
                        <div className={styles.filterGroup}>
                            <label>Asegurado *</label>
                            <input className={styles.input} type="text" placeholder="Nombre completo"
                                value={newCase.asegurado} onChange={e => setNewCase({ ...newCase, asegurado: e.target.value })} />
                        </div>
                        <div className={styles.filterGroup}>
                            <label>DNI</label>
                            <input className={styles.input} type="text"
                                value={newCase.dni} onChange={e => setNewCase({ ...newCase, dni: e.target.value })} />
                        </div>
                        <div className={styles.filterGroup}>
                            <label>N° Siniestro *</label>
                            <input className={styles.input} type="text"
                                value={newCase.nSiniestro} onChange={e => setNewCase({ ...newCase, nSiniestro: e.target.value })} />
                        </div>
                        <div className={styles.filterGroup}>
                            <label>Póliza</label>
                            <input className={styles.input} type="text"
                                value={newCase.poliza} onChange={e => setNewCase({ ...newCase, poliza: e.target.value })} />
                        </div>
                        <div className={styles.filterGroup}>
                            <label>Mail</label>
                            <input className={styles.input} type="text"
                                value={newCase.mail} onChange={e => setNewCase({ ...newCase, mail: e.target.value })} />
                        </div>
                        <div className={styles.filterGroup}>
                            <label>Teléfono</label>
                            <input className={styles.input} type="text"
                                value={newCase.telefono} onChange={e => setNewCase({ ...newCase, telefono: e.target.value })} />
                        </div>
                        <div className={styles.filterGroup}>
                            <label>Fecha Asignación</label>
                            <input className={styles.input} type="date"
                                value={newCase.fecha_ingreso} onChange={e => setNewCase({ ...newCase, fecha_ingreso: e.target.value })} />
                        </div>
                        <div className={styles.filterGroup}>
                            <label>Fecha Denuncia</label>
                            <input className={styles.input} type="date"
                                value={newCase.fecha_denuncia} onChange={e => setNewCase({ ...newCase, fecha_denuncia: e.target.value })} />
                        </div>
                        <div className={styles.filterGroup}>
                            <label>Fecha Siniestro</label>
                            <input className={styles.input} type="date"
                                value={newCase.fecha_siniestro} onChange={e => setNewCase({ ...newCase, fecha_siniestro: e.target.value })} />
                        </div>
                        <div className={styles.filterGroup} style={{ gridColumn: '1 / -1' }}>
                            <label>Comentario de Derivación</label>
                            <textarea className={styles.textarea} style={{ height: '60px' }}
                                value={newCase.motivo_derivacion} onChange={e => setNewCase({ ...newCase, motivo_derivacion: e.target.value })} />
                        </div>
                        <div className={styles.filterGroup}>
                            <label>Ramo</label>
                            <input className={styles.input} type="text"
                                value={newCase.ramo} onChange={e => setNewCase({ ...newCase, ramo: e.target.value })} />
                        </div>
                        <div className={styles.filterGroup}>
                            <label>Analista</label>
                            <select
                                className={styles.select}
                                value={newCase.analista}
                                onChange={e => setNewCase({ ...newCase, analista: e.target.value })}
                            >
                                <option value="">Seleccionar...</option>
                                {catalogs.analistas.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className={styles.primaryBtn} onClick={handleSaveNewCase}>Guardar Caso</button>
                        <button className={styles.secondaryBtn} onClick={() => setShowNewCase(false)}>Cancelar</button>
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
                                    <td>
                                        <span
                                            className={styles.badge}
                                            style={{
                                                backgroundColor: getEstadoColor(caso.estado) + '22',
                                                color: getEstadoColor(caso.estado) === '#ffffff' ? '#333' : getEstadoColor(caso.estado)
                                            }}
                                        >
                                            {caso.estado || 'SIN ESTADO'}
                                        </span>
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
