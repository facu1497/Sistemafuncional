import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import styles from './Documentacion.module.css';
import { Dropzone } from './Dropzone';
import { FileText, Download, Trash2, Image as ImageIcon } from 'lucide-react';

interface DocumentacionProps {
    nSiniestro: string;
}

interface FileObject {
    name: string;
    id: string;
    updated_at: string;
    metadata: {
        mimetype: string;
        size: number;
    };
}

const BUCKET = 'documentos';

export const Documentacion = ({ nSiniestro }: DocumentacionProps) => {
    const [files, setFiles] = useState<FileObject[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (nSiniestro) fetchFiles();
    }, [nSiniestro]);

    const fetchFiles = async () => {
        setLoading(true);
        // List files in folder 'casos/{nSiniestro}/'
        const { data, error } = await supabase
            .storage
            .from(BUCKET)
            .list(`casos/${nSiniestro}`, {
                limit: 100,
                offset: 0,
                sortBy: { column: 'name', order: 'asc' },
            });

        if (error) {
            console.error("Error fetching files:", error);
            // Ignore error if folder just doesn't exist yet
        } else {
            setFiles(data as any[] || []);
        }
        setLoading(false);
    };

    const handleUpload = async (files: File[]) => {
        setUploading(true);
        try {
            // Loop through all selected files
            for (const file of files) {
                // Sanitize filename to avoid weird character issues
                const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                const filePath = `casos/${nSiniestro}/${Date.now()}_${sanitizedName}`;

                const { error } = await supabase.storage
                    .from(BUCKET)
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (error) {
                    console.error("Error uploading file:", file.name, error);
                    // continue with other files
                    alert(`Error al subir ${file.name}: ${error.message}`);
                }
            }

            // Refresh list
            fetchFiles();

        } catch (error: any) {
            // General error catch
            console.error("General upload error", error);
        } finally {
            setUploading(false);
        }
    };

    const handleDownload = async (fileName: string) => {
        try {
            const { data, error } = await supabase.storage
                .from(BUCKET)
                .download(`casos/${nSiniestro}/${fileName}`);

            if (error) throw error;

            // Trigger download via blob URL
            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName.split('_').slice(1).join('_'); // Remove timestamp prefix for user friendly name
            if (fileName.indexOf('_') === -1) a.download = fileName; // Fallback

            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (error: any) {
            alert(`Error al descargar: ${error.message}`);
        }
    };

    const handleDelete = async (fileName: string) => {
        if (!confirm('¿Estás seguro de eliminar este archivo?')) return;

        try {
            const { error } = await supabase.storage
                .from(BUCKET)
                .remove([`casos/${nSiniestro}/${fileName}`]);

            if (error) throw error;
            fetchFiles();

        } catch (error: any) {
            alert(`Error al eliminar: ${error.message}`);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const isImage = (mime: string) => mime && mime.startsWith('image/');

    return (
        <div className={styles.wrapper}>
            <div className={styles.uploadSection}>
                {uploading ? (
                    <div style={{ textAlign: 'center', padding: '30px', border: '2px dashed var(--line-color)', borderRadius: '8px', color: 'var(--primary-color)' }}>
                        Subiendo archivo...
                    </div>
                ) : (
                    <Dropzone onFileSelect={handleUpload} label="Arrastrá documentos aquí" subLabel="PDF, JPG, PNG, Word..." multiple={true} />
                )}
            </div>

            {loading && <div style={{ textAlign: 'center', color: 'var(--muted-color)' }}>Cargando documentos...</div>}

            {!loading && files.length === 0 && (
                <div className={styles.emptyState}>
                    No hay documentos cargados para este caso.
                </div>
            )}

            <div className={styles.filesGrid}>
                {files.map(file => (
                    <div key={file.id} className={styles.fileCard}>
                        <div className={styles.fileIconZone}>
                            {isImage(file.metadata?.mimetype) ? (
                                <ImageIcon size={32} />
                            ) : (
                                <FileText size={32} />
                            )}
                        </div>
                        <div className={styles.fileName} title={file.name}>
                            {file.name.split('_').slice(1).join('_') || file.name}
                        </div>
                        <div className={styles.fileMeta}>
                            <span>{formatSize(file.metadata?.size)}</span>
                            <span>{new Date(file.updated_at).toLocaleDateString()}</span>
                        </div>
                        <div className={styles.actions}>
                            <button className={`${styles.btnAction} ${styles.btnDownload}`} onClick={() => handleDownload(file.name)}>
                                <Download size={14} /> Descargar
                            </button>
                            <button className={`${styles.btnAction} ${styles.btnDelete}`} onClick={() => handleDelete(file.name)}>
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
