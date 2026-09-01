import { BrowserRouter, Route, Routes } from "react-router-dom";

import RutaProtegida from "./components/RutaProtegida";

import LoginPage from "./pages/LoginPage";
import PanelPrincipalPage from "./pages/PanelPrincipalPage";

import NuevoRepartoPage from "./pages/NuevoRepartoPage";
import HistorialRepartosPage from "./pages/HistorialRepartosPage";
import EditarRepartoPage from "./pages/EditarRepartoPage";
import ReporteRecargasPage from "./pages/ReporteRecargasPage";

import NuevoRechazoPage from "./pages/NuevoRechazoPage";
import HistorialRechazosPage from "./pages/HistorialRechazosPage";
import EditarRechazoPage from "./pages/EditarRechazoPage";
import EstadisticasRechazosPage from "./pages/EstadisticasRechazosPage";

import NuevoReciboCambioPage from "./pages/NuevoReciboCambioPage";
import HistorialRecibosCambioPage from "./pages/HistorialRecibosCambioPage";
import DetalleReciboCambioPage from "./pages/DetalleReciboCambioPage";
import EditarReciboCambioPage from "./pages/EditarReciboCambioPage";
import EstadisticasCambiosPage from "./pages/EstadisticasCambiosPage";

import InicioRepartosPage from "./pages/InicioRepartosPage";
import InicioRechazosPage from "./pages/InicioRechazosPage";
import InicioCambiosPage from "./pages/InicioCambiosPage";
import AppLayout from "./components/layout/AppLayout";


function App() {

  return (
    <BrowserRouter>

      <Routes>

        {/* ========================================= */}
        {/* LOGIN */}
        {/* ========================================= */}

        <Route
          path="/login"
          element={
            <LoginPage />
          }
        />


        {/* ========================================= */}
        {/* SISTEMA PROTEGIDO */}
        {/* ========================================= */}

        <Route
          path="/*"
          element={
            <RutaProtegida>

              <AppLayout>

                  <Routes>

                    {/* ============================= */}
                    {/* PANEL PRINCIPAL */}
                    {/* ============================= */}

                    <Route
                      path="/"
                      element={
                        <PanelPrincipalPage />
                      }
                    />


                    {/* ============================= */}
                    {/* REPARTOS / RECARGAS */}
                    {/* ============================= */}

                    <Route
                      path="/repartos/nuevo"
                      element={
                        <NuevoRepartoPage />
                      }
                    />

                    <Route
                      path="/repartos"
                      element={
                        <HistorialRepartosPage />
                      }
                    />

                    <Route
                      path="/repartos/:id/editar"
                      element={
                        <EditarRepartoPage />
                      }
                    />

                    <Route
                      path="/repartos/recargas"
                      element={
                        <ReporteRecargasPage />
                      }
                    />


                    {/* ============================= */}
                    {/* RECHAZOS */}
                    {/* ============================= */}

                    <Route
                      path="/rechazos/nuevo"
                      element={
                        <NuevoRechazoPage />
                      }
                    />

                    <Route
                      path="/rechazos"
                      element={
                        <HistorialRechazosPage />
                      }
                    />

                    <Route
                      path="/rechazos/:id/editar"
                      element={
                        <EditarRechazoPage />
                      }
                    />

                    <Route
                      path="/rechazos/estadisticas"
                      element={
                        <EstadisticasRechazosPage />
                      }
                    />


                    {/* ============================= */}
                    {/* CAMBIOS */}
                    {/* ============================= */}

                    <Route
                      path="/cambios/nuevo"
                      element={
                        <NuevoReciboCambioPage />
                      }
                    />

                    <Route
                      path="/cambios"
                      element={
                        <HistorialRecibosCambioPage />
                      }
                    />

                    <Route
                      path="/cambios/recibos/:id"
                      element={
                        <DetalleReciboCambioPage />
                      }
                    />

                    <Route
                      path="/cambios/recibos/:id/editar"
                      element={
                        <EditarReciboCambioPage />
                      }
                    />

                    <Route
                      path="/cambios/estadisticas"
                      element={
                        <EstadisticasCambiosPage />
                      }
                    />

                    <Route
                      path="/repartos/inicio"
                      element={<InicioRepartosPage />}
                    />

                    <Route
                      path="/rechazos/inicio"
                      element={<InicioRechazosPage />}
                    />

                    <Route
                      path="/cambios/inicio"
                      element={<InicioCambiosPage />}
                    />

                  </Routes>

              </AppLayout>

            </RutaProtegida>
          }
        />

      </Routes>

    </BrowserRouter>
  );
}


export default App;
