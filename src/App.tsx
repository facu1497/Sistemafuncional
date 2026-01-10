import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { Lista } from './pages/Lista';
import { Detalle } from './pages/Detalle';
import { Tareas } from './pages/Tareas';
import { Facturacion } from './pages/Facturacion';
import { Reportes } from './pages/Reportes';
import { Administracion } from './pages/Administracion';
import { Informe } from './pages/Informe';
import { InformeDesiste } from './pages/InformeDesiste';
import { NotaEfectivo } from './pages/NotaEfectivo';

import React from 'react';

const PrivateRoute = ({ children }: { children: React.ReactElement }) => {
  const { session, loading } = useAuth();
  if (loading) return <div>Cargando...</div>;
  return session ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }: { children: React.ReactElement }) => {
  const { profile, user, loading } = useAuth();
  if (loading) return <div>Cargando...</div>;

  const isAdmin = profile?.rol === 'Administrador' || user?.user_metadata?.rol === 'Administrador';
  return isAdmin ? children : <Navigate to="/lista" />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/Sistemafuncional">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/detalle/:id" element={
            <PrivateRoute>
              <Detalle />
            </PrivateRoute>
          } />
          <Route path="/lista" element={
            <PrivateRoute>
              <Lista />
            </PrivateRoute>
          } />
          <Route path="/tareas" element={
            <PrivateRoute>
              <Tareas />
            </PrivateRoute>
          } />
          <Route path="/facturacion" element={
            <AdminRoute>
              <Facturacion />
            </AdminRoute>
          } />
          <Route path="/reportes" element={
            <AdminRoute>
              <Reportes />
            </AdminRoute>
          } />
          <Route path="/administracion" element={
            <AdminRoute>
              <Administracion />
            </AdminRoute>
          } />
          <Route path="/informe/:id" element={
            <PrivateRoute>
              <Informe />
            </PrivateRoute>
          } />
          <Route path="/informe-desiste/:id" element={
            <PrivateRoute>
              <InformeDesiste />
            </PrivateRoute>
          } />
          <Route path="/nota-efectivo/:id" element={
            <PrivateRoute>
              <NotaEfectivo />
            </PrivateRoute>
          } />
          <Route path="/" element={<Navigate to="/lista" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
