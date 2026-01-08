import React from 'react';
import { Sidebar } from '../components/Sidebar';
import styles from './Layout.module.css';
import logo from '../assets/logo_white.png';

export const Layout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className={styles.container}>
            {/* Header fijo superior imitando layout-common.css */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.logo}>
                        <img src={logo} alt="H.M. Gibert" style={{ height: '45px', width: 'auto', borderRadius: '0', boxShadow: 'none' }} />
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
