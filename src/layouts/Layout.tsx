import React from 'react';
import { Sidebar } from '../components/Sidebar';
import styles from './Layout.module.css';
import logo from '../assets/logo_gibert.png';

export const Layout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className={styles.container}>
            {/* Header fijo superior imitando layout-common.css */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.logo}>
                        <img src={logo} alt="Logo" />
                        <div className={styles.titulo}>H.M. Gibert<br /><span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--muted-color)' }}>Sistema de Gestión</span></div>
                    </div>
                </div>
                {/* Aquí podrían ir notificaciones o info extra */}
            </header>

            <Sidebar />

            <main className={styles.mainContent}>
                {children}
            </main>
        </div>
    );
};
