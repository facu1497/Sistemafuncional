import { useEffect, useState, useRef } from 'react';
import { Layout } from '../layouts/Layout';
import { supabase } from '../supabaseClient';
import styles from './Administracion.module.css';

export const Administracion = () => {
    const [activeTab, setActiveTab] = useState('companias');
    const [, setLoading] = useState(false);

    const [data, setData] = useState({
        companias: [] as any[],
        analistas: [] as any[],
        causas: [] as any[],
        coberturas: [] as any[],
        estados: [] as any[],
        usuarios: [] as any[]
    });

    const [formState, setFormState] = useState({
        companias: { id: null, nombre: '', cuit: '', activo: '1', notas: '' },
        analistas: { id: null, nombre: '', email: '', tel: '', activo: '1' },
        causas: { id: null, nombre: '', tipo: '', activo: '1' },
        coberturas: { id: null, nombre: '', ramo: '', activo: '1' },
        estados: { id: null, nombre: '', color: '', activo: '1' },
        usuarios: { id: null, nombre: '', email: '', password: '', rol: 'user', activo: '1' }
    });

    const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

    useEffect(() => {
        loadData(activeTab);
    }, [activeTab]);

    const TABS = [
        { key: 'companias', label: 'Compañías' },
        { key: 'analistas', label: 'Analistas' },
        { key: 'causas', label: 'Causas' },
        { key: 'coberturas', label: 'Coberturas' },
        { key: 'estados', label: 'Estados' },
        { key: 'usuarios', label: 'Usuarios' },
    ];

    const TABLE_NAMES: any = {
        companias: 'companias',
        analistas: 'analistas',
        causas: 'causas',
        coberturas: 'coberturas',
        estados: 'estados',
        usuarios: 'perfiles'
    };

    const loadData = async (key: string) => {
        setLoading(true);
        try {
            const table = TABLE_NAMES[key];
            const { data: res, error } = await supabase.from(table).select('*').order('id', { ascending: true });
            if (error) throw error;
            setData(prev => ({ ...prev, [key]: res || [] }));
        } catch (err: any) {
            console.error('Error loading ' + key, err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (key: string) => {
        const form = (formState as any)[key];
        const table = TABLE_NAMES[key];

        // Validation
        if (!form.nombre) return alert("El nombre es requerido");
        if (key === 'usuarios' && !form.email) return alert("El email es requerido");

        setLoading(true);
        try {
            if (key === 'usuarios' && !form.id) {
                // CREATE USER (AUTH)
                if ((form.password || '').length < 6) {
                    setLoading(false);
                    return alert("La contraseña debe tener al menos 6 caracteres");
                }

                // Note: supabase.auth.signUp might sign in the user immediately if email confirmation is off.
                // ideally use a second client or edge function. Here we proceed as requested.
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: form.email,
                    password: form.password,
                    options: {
                        data: { nombre: form.nombre, rol: form.rol }
                    }
                });

                if (authError) throw authError;

                if (authData.user) {
                    // Manual upsert to profile just in case trigger fails or we want to be sure
                    const payload = {
                        id: authData.user.id,
                        nombre: form.nombre,
                        email: form.email,
                        rol: form.rol,
                        activo: parseInt(form.activo)
                    };
                    await supabase.from('perfiles').upsert(payload);
                    alert("Usuario creado. ATENCIÓN: Es posible que su sesión haya cambiado a la del nuevo usuario.");
                }

            } else {
                // STANDARD UPSERT
                const payload = { ...form };
                delete payload.password; // Don't save password to DB column directly if generic
                delete payload.id; // handled by upsert match if we pass it separately? No, pass ID for update using match.

                // For upsert, we need the ID if it exists.
                if (form.id) {
                    const { error } = await supabase.from(table).update(payload).eq('id', form.id);
                    if (error) throw error;
                } else {
                    const { error } = await supabase.from(table).insert(payload);
                    if (error) throw error;
                }
            }

            // AUTO-CREATE ANALYST IF ROLE IS 'Analista'
            if (key === 'usuarios' && form.rol === 'Analista') {
                try {
                    // Check if analyst exists by email or name
                    let { data: existing } = await supabase.from('analistas')
                        .select('id')
                        .or(`email.eq.${form.email},nombre.eq.${form.nombre}`)
                        .maybeSingle(); // Use maybeSingle to avoid error if not found

                    const analystPayload = {
                        nombre: form.nombre,
                        email: form.email,
                        activo: parseInt(form.activo)
                    };

                    if (existing) {
                        // Update existing (optional, but good for consistency)
                        await supabase.from('analistas').update(analystPayload).eq('id', existing.id);
                    } else {
                        // Insert new
                        await supabase.from('analistas').insert(analystPayload);
                    }
                } catch (syncErr) {
                    console.error("Error syncing analyst:", syncErr);
                    // Don't block the main success alert
                }
            }

            alert("Guardado correctamente");
            resetForm(key);
            loadData(key);
        } catch (err: any) {
            alert("Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (key: string, id: string) => {
        if (!confirm("¿Estás seguro de eliminar este registro?")) return;
        try {
            const table = TABLE_NAMES[key];
            const { error } = await supabase.from(table).delete().eq('id', id);
            if (error) throw error;
            loadData(key);
        } catch (err: any) {
            alert("Error al eliminar: " + err.message);
        }
    };

    const handleEdit = (key: string, item: any) => {
        const currentForm = (formState as any)[key];
        const newForm = { ...currentForm, ...item, activo: String(item.activo) };
        if (key === 'usuarios') {
            // Don't autofill password
            newForm.password = '';
        }
        setFormState(prev => ({ ...prev, [key]: newForm }));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = (key: string) => {
        setFormState(prev => ({
            ...prev,
            [key]: { ...prev[key as keyof typeof prev], id: null, nombre: '', ...(key === 'usuarios' ? { email: '', password: '' } : {}) }
        }));
    };

    const updateForm = (key: string, field: string, value: any) => {
        setFormState(prev => ({
            ...prev,
            [key]: { ...(prev as any)[key], [field]: value }
        }));
    };

    // EXPORT / IMPORT
    const handleExport = (key: string) => {
        const json = JSON.stringify(data[key as keyof typeof data], null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `master_${key}.json`;
        a.click();
    };

    const handleImportClick = (key: string) => {
        fileInputRefs.current[key]?.click();
    };

    const handleImportFile = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const json = JSON.parse(evt.target?.result as string);
                if (!Array.isArray(json)) throw new Error("Format invalid: expected array");

                // Confirm
                if (!confirm(`Se importarán ${json.length} registros en ${key}. Esto puede sobrescribir datos existentes.`)) return;

                const table = TABLE_NAMES[key];
                const { error } = await supabase.from(table).upsert(json);
                if (error) throw error;

                alert("Importación exitosa");
                loadData(key);
            } catch (err: any) {
                alert("Error importando: " + err.message);
            } finally {
                if (fileInputRefs.current[key]) fileInputRefs.current[key]!.value = '';
            }
        };
        reader.readAsText(file);
    };

    // --- RENDERERS ---

    const renderTabs = () => (
        <div className={styles.tabs}>
            {TABS.map(t => (
                <button
                    key={t.key}
                    className={`${styles.tabBtn} ${activeTab === t.key ? styles.active : ''}`}
                    onClick={() => setActiveTab(t.key)}
                >
                    {t.label}
                </button>
            ))}
        </div>
    );

    const renderCommonForm = (
        key: string,
        fields: { label: string, field: string, type?: string, placeholder?: string, options?: { val: string, label: string }[] }[]
    ) => {
        const form = (formState as any)[key];
        return (
            <div className={styles.card}>
                <h2>{form.id ? 'Editar' : 'Alta de'} {TABS.find(t => t.key === key)?.label}</h2>
                <div className={styles.formGrid}>
                    {fields.map(f => (
                        <div key={f.field} className={styles.formGroup}>
                            <label>{f.label}</label>
                            {f.type === 'select' ? (
                                <select
                                    className={styles.select}
                                    value={form[f.field]}
                                    onChange={e => updateForm(key, f.field, e.target.value)}
                                >
                                    {f.options?.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                                </select>
                            ) : f.type === 'textarea' ? (
                                <textarea
                                    className={styles.textarea}
                                    rows={3}
                                    placeholder={f.placeholder}
                                    value={form[f.field]}
                                    onChange={e => updateForm(key, f.field, e.target.value)}
                                />
                            ) : (
                                <input
                                    type={f.type || 'text'}
                                    className={styles.input}
                                    placeholder={f.placeholder}
                                    value={form[f.field]}
                                    onChange={e => updateForm(key, f.field, e.target.value)}
                                    // Special case for User Password: hide if editing
                                    style={f.field === 'password' && form.id ? { display: 'none' } : {}}
                                />
                            )}
                            {f.field === 'password' && form.id && <small className={styles.muted}>La contraseña no se puede editar aquí.</small>}
                        </div>
                    ))}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <button className={styles.primaryBtn} onClick={() => handleSave(key)}>
                            {form.id ? 'Actualizar' : 'Guardar'}
                        </button>
                        {form.id && (
                            <button className={styles.secondaryBtn} onClick={() => resetForm(key)}>
                                Cancelar Edición
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderTable = (key: string, cols: { field: string, header: string, render?: (val: any) => any }[]) => {
        const rows = (data as any)[key] || [];
        return (
            <div className={styles.card}>
                <div className={styles.toolbar}>
                    <h2>Listado</h2>
                    <div className={styles.actions}>
                        <button className={styles.secondaryBtn} onClick={() => handleExport(key)}>Exportar JSON</button>
                        <button className={styles.secondaryBtn} onClick={() => handleImportClick(key)}>Importar JSON</button>
                        <input
                            type="file"
                            style={{ display: 'none' }}
                            ref={el => { fileInputRefs.current[key] = el; }}
                            onChange={(e) => handleImportFile(key, e)}
                            accept=".json"
                        />
                    </div>
                </div>
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                {cols.map(c => <th key={c.field}>{c.header}</th>)}
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row: any) => (
                                <tr key={row.id}>
                                    {cols.map(c => (
                                        <td key={c.field}>
                                            {c.render ? c.render(row[c.field]) : row[c.field]}
                                        </td>
                                    ))}
                                    <td>
                                        <button className={styles.editBtn} onClick={() => handleEdit(key, row)}>Editar</button>
                                        <button className={styles.dangerBtn} onClick={() => handleDelete(key, row.id)}>Borrar</button>
                                    </td>
                                </tr>
                            ))}
                            {rows.length === 0 && <tr><td colSpan={cols.length + 1} style={{ textAlign: 'center', padding: '20px' }}>No hay datos</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    // --- SPECIFIC SECTIONS ---

    const renderCompanias = () => (
        <div className={styles.grid}>
            {renderCommonForm('companias', [
                { label: 'Nombre', field: 'nombre', placeholder: 'Ej: Life Seguros' },
                { label: 'CUIT', field: 'cuit', placeholder: '30-12345678-9' },
                { label: 'Estado', field: 'activo', type: 'select', options: [{ val: '1', label: 'Activa' }, { val: '0', label: 'Inactiva' }] },
                { label: 'Notas', field: 'notas', type: 'textarea' }
            ])}
            {renderTable('companias', [
                { field: 'id', header: 'ID' },
                { field: 'nombre', header: 'Nombre' },
                { field: 'cuit', header: 'CUIT' },
                { field: 'activo', header: 'Activo', render: v => v === 1 ? <span className={styles.activeTag}>Sí</span> : <span className={styles.inactiveTag}>No</span> }
            ])}
        </div>
    );

    const renderAnalistas = () => (
        <div className={styles.grid}>
            {renderCommonForm('analistas', [
                { label: 'Nombre', field: 'nombre', placeholder: 'Ej: Juan Pérez' },
                { label: 'Email', field: 'email', placeholder: 'juan@estudio.com' },
                { label: 'Teléfono', field: 'tel', placeholder: '11-1234-5678' },
                { label: 'Estado', field: 'activo', type: 'select', options: [{ val: '1', label: 'Activo' }, { val: '0', label: 'Inactivo' }] }
            ])}
            {renderTable('analistas', [
                { field: 'id', header: 'ID' },
                { field: 'nombre', header: 'Nombre' },
                { field: 'email', header: 'Email' },
                { field: 'tel', header: 'Teléfono' },
                { field: 'activo', header: 'Activo', render: v => v === 1 ? <span className={styles.activeTag}>Sí</span> : <span className={styles.inactiveTag}>No</span> }
            ])}
        </div>
    );

    const renderCausas = () => (
        <div className={styles.grid}>
            {renderCommonForm('causas', [
                { label: 'Nombre', field: 'nombre', placeholder: 'Ej: Variación de tensión' },
                { label: 'Tipo', field: 'tipo', placeholder: 'Ej: Eléctrica' },
                { label: 'Estado', field: 'activo', type: 'select', options: [{ val: '1', label: 'Activa' }, { val: '0', label: 'Inactiva' }] }
            ])}
            {renderTable('causas', [
                { field: 'id', header: 'ID' },
                { field: 'nombre', header: 'Nombre' },
                { field: 'tipo', header: 'Tipo' },
                { field: 'activo', header: 'Activo', render: v => v === 1 ? <span className={styles.activeTag}>Sí</span> : <span className={styles.inactiveTag}>No</span> }
            ])}
        </div>
    );

    const renderCoberturas = () => (
        <div className={styles.grid}>
            {renderCommonForm('coberturas', [
                { label: 'Nombre', field: 'nombre', placeholder: 'Ej: Daño por líquidos' },
                { label: 'Ramo', field: 'ramo', placeholder: 'Ej: Hogar' },
                { label: 'Estado', field: 'activo', type: 'select', options: [{ val: '1', label: 'Activa' }, { val: '0', label: 'Inactiva' }] }
            ])}
            {renderTable('coberturas', [
                { field: 'id', header: 'ID' },
                { field: 'nombre', header: 'Nombre' },
                { field: 'ramo', header: 'Ramo' },
                { field: 'activo', header: 'Activo', render: v => v === 1 ? <span className={styles.activeTag}>Sí</span> : <span className={styles.inactiveTag}>No</span> }
            ])}
        </div>
    );

    const renderEstados = () => (
        <div className={styles.grid}>
            {renderCommonForm('estados', [
                { label: 'Nombre', field: 'nombre', placeholder: 'Ej: CONTACTAR' },
                { label: 'Color', field: 'color', placeholder: 'Ej: #ff0000' },
                { label: 'Estado', field: 'activo', type: 'select', options: [{ val: '1', label: 'Activo' }, { val: '0', label: 'Inactivo' }] }
            ])}
            {renderTable('estados', [
                { field: 'id', header: 'ID' },
                { field: 'nombre', header: 'Nombre' },
                { field: 'color', header: 'Color', render: v => v ? <span className={styles.colorPill} style={{ background: v }}>{v}</span> : '-' },
                { field: 'activo', header: 'Activo', render: v => v === 1 ? <span className={styles.activeTag}>Sí</span> : <span className={styles.inactiveTag}>No</span> }
            ])}
        </div>
    );

    const renderUsuarios = () => (
        <div className={styles.grid}>
            {renderCommonForm('usuarios', [
                { label: 'Nombre y Apellido', field: 'nombre', placeholder: 'Ej: Ana Gomez' },
                { label: 'Email', field: 'email', placeholder: 'ana@estudio.com', type: 'email' },
                { label: 'Contraseña (solo para alta)', field: 'password', type: 'password', placeholder: 'Mínimo 6 caracteres' },
                { label: 'Rol', field: 'rol', type: 'select', options: [{ val: 'Administrador', label: 'Administrador' }, { val: 'Analista', label: 'Analista' }] },
                { label: 'Activo', field: 'activo', type: 'select', options: [{ val: '1', label: 'Sí' }, { val: '0', label: 'No' }] }
            ])}
            {renderTable('usuarios', [
                { field: 'id', header: 'ID', render: v => <span title={v}>{v.substring(0, 8)}...</span> },
                { field: 'nombre', header: 'Nombre' },
                { field: 'email', header: 'Email' },
                { field: 'rol', header: 'Rol' },
                { field: 'activo', header: 'Activo', render: v => v === 1 ? <span className={styles.activeTag}>Sí</span> : <span className={styles.inactiveTag}>No</span> }
            ])}
        </div>
    );


    return (
        <Layout>
            <div className={styles.container}>
                <div className={styles.titleSection}>
                    <h1>Administración del Sistema</h1>
                    <p>Gestión de catálogos maestros y usuarios</p>
                </div>

                {renderTabs()}

                {activeTab === 'companias' && renderCompanias()}
                {activeTab === 'analistas' && renderAnalistas()}
                {activeTab === 'causas' && renderCausas()}
                {activeTab === 'coberturas' && renderCoberturas()}
                {activeTab === 'estados' && renderEstados()}
                {activeTab === 'usuarios' && renderUsuarios()}
            </div>
        </Layout>
    );
};
