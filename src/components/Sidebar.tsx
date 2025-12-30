import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, CheckSquare, Settings, LogOut, FileBarChart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import styles from './Sidebar.module.css';

export const Sidebar = () => {
    const { signOut, user, profile } = useAuth();

    const userName = profile?.nombre || user?.user_metadata?.nombre || user?.email || 'Usuario';
    const userRole = profile?.rol || user?.user_metadata?.rol || 'Gestor';

    return (
        <aside className={styles.sidebar}>
            {/* El logo visualmente ahora está en el Header global, pero dejamos el nav aquí */}
            <nav className={styles.nav}>
                <NavLink to="/lista" className={({ isActive }) => isActive ? `${styles.item} ${styles.active}` : styles.item}>
                    <LayoutDashboard size={18} />
                    <span>Casos</span>
                </NavLink>
                <NavLink to="/tareas" className={({ isActive }) => isActive ? `${styles.item} ${styles.active}` : styles.item}>
                    <CheckSquare size={18} />
                    <span>Tareas</span>
                </NavLink>
                <NavLink to="/facturacion" className={({ isActive }) => isActive ? `${styles.item} ${styles.active}` : styles.item}>
                    <FileText size={18} />
                    <span>Facturación</span>
                </NavLink>
                <NavLink to="/reportes" className={({ isActive }) => isActive ? `${styles.item} ${styles.active}` : styles.item}>
                    <FileBarChart size={18} />
                    <span>Reportes</span>
                </NavLink>
                <NavLink to="/administracion" className={({ isActive }) => isActive ? `${styles.item} ${styles.active}` : styles.item}>
                    <Settings size={18} />
                    <span>Administración</span>
                </NavLink>
            </nav>

            <div className={styles.footer}>
                <div className={styles.user}>
                    <div className={styles.avatar}>
                        {userName.charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.userInfo}>
                        <span className={styles.name}>{userName}</span>
                        <span className={styles.role}>{userRole}</span>
                    </div>
                </div>
                <button onClick={signOut} className={styles.logoutBtn} title="Cerrar sesión">
                    <LogOut size={16} />
                </button>
            </div>
        </aside>
    );
};
