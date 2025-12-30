import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import styles from './Comentarios.module.css';
import { Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Comment {
    id: number;
    texto: string;
    nombre_autor: string;
    creado_por: string;
    creado_en: string;
}

interface ComentariosProps {
    nSiniestro: string;
}

export const Comentarios = ({ nSiniestro }: ComentariosProps) => {
    const { user } = useAuth();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newText, setNewText] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (nSiniestro) fetchComments();
    }, [nSiniestro]);

    const fetchComments = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('comentarios')
            .select('*')
            .eq('n_siniestro', nSiniestro)
            .order('creado_en', { ascending: false });

        if (error) {
            console.error("Error fetching comments:", error);
        } else {
            setComments(data || []);
        }
        setLoading(false);
    };

    const handleSend = async () => {
        if (!newText.trim()) return;
        setSending(true);

        const userName = user?.user_metadata?.nombre || user?.email || 'Usuario';

        const { error } = await supabase
            .from('comentarios')
            .insert({
                n_siniestro: nSiniestro,
                texto: newText,
                nombre_autor: userName,
                creado_por: user?.id
            });

        setSending(false);

        if (error) {
            alert(`Error al enviar comentario: ${error.message}`);
        } else {
            setNewText('');
            fetchComments();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={styles.wrapper}>
            <div className={styles.inputSection}>
                <textarea
                    className={styles.input}
                    placeholder="Escribí un comentario..."
                    value={newText}
                    onChange={e => setNewText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={sending}
                />
                <button className={styles.btnSend} onClick={handleSend} disabled={sending || !newText.trim()}>
                    <Send size={16} />
                    {sending ? 'Enviando...' : 'Comentar'}
                </button>
            </div>

            <div className={styles.list}>
                {loading && <div style={{ textAlign: 'center', color: 'var(--muted-color)' }}>Cargando comentarios...</div>}

                {!loading && comments.length === 0 && (
                    <div className={styles.empty}>
                        No hay comentarios aún. Sé el primero.
                    </div>
                )}

                {comments.map(c => (
                    <div key={c.id} className={`${styles.comment} ${c.creado_por === user?.id ? styles.me : ''}`}>
                        <div className={styles.header}>
                            <span className={styles.author}>{c.nombre_autor}</span>
                            <span className={styles.date}>
                                {new Date(c.creado_en).toLocaleString('es-AR')}
                            </span>
                        </div>
                        <div className={styles.text}>{c.texto}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};
