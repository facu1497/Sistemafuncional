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

import React from 'react';

const PrivateRoute = ({ children }: { children: React.ReactElement }) => {
  const { session, loading } = useAuth();
  if (loading) return <div>Cargando...</div>;
  return session ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
            <PrivateRoute>
              <Facturacion />
            </PrivateRoute>
          } />
          <Route path="/reportes" element={
            <PrivateRoute>
              <Reportes />
            </PrivateRoute>
          } />
          <Route path="/administracion" element={
            <PrivateRoute>
              <Administracion />
            </PrivateRoute>
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
          <Route path="/" element={<Navigate to="/lista" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
