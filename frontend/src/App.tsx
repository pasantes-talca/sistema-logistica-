import {
  BrowserRouter,
  Route,
  Routes,
} from "react-router-dom";

import RutaProtegida from "./components/RutaProtegida";
import AppLayout from "./components/layout/AppLayout";

import LoginPage from "./pages/LoginPage";
import PanelPrincipalPage from "./pages/PanelPrincipalPage";


// =============================================
// REPARTOS / RECARGAS
// =============================================

import NuevoRepartoPage from "./pages/NuevoRepartoPage";
import HistorialRepartosPage from "./pages/HistorialRepartosPage";
import EditarRepartoPage from "./pages/EditarRepartoPage";
import ReporteRecargasPage from "./pages/ReporteRecargasPage";
import InicioRepartosPage from "./pages/InicioRepartosPage";

import ProcesarPlanillasRecargasPage
  from "./pages/ProcesarPlanillasRecargasPage";


// =============================================
// RECHAZOS
// =============================================

import NuevoRechazoPage from "./pages/NuevoRechazoPage";
import HistorialRechazosPage from "./pages/HistorialRechazosPage";
import EditarRechazoPage from "./pages/EditarRechazoPage";
import EstadisticasRechazosPage from "./pages/EstadisticasRechazosPage";
import InicioRechazosPage from "./pages/InicioRechazosPage";


// =============================================
// CAMBIOS
// =============================================

import NuevoReciboCambioPage from "./pages/NuevoReciboCambioPage";
import HistorialRecibosCambioPage from "./pages/HistorialRecibosCambioPage";
import DetalleReciboCambioPage from "./pages/DetalleReciboCambioPage";
import EditarReciboCambioPage from "./pages/EditarReciboCambioPage";
import EstadisticasCambiosPage from "./pages/EstadisticasCambiosPage";
import InicioCambiosPage from "./pages/InicioCambiosPage";


// =============================================
// VIÁTICOS
// =============================================


import NuevoViaticoPage from "./pages/NuevoViaticoPage";
import HistorialViaticosPage from "./pages/HistorialViaticosPage";
import ResumenAnualViaticosPage from "./pages/ResumenAnualViaticosPage";
import InicioViaticosPage from "./pages/InicioViaticosPage";

// =============================================
// ASISTENTE IA
// =============================================

import AsistenteIAPage from "./pages/AsistenteIAPage";

import NuevoControlKilometrajePage from "./pages/NuevoControlKilometrajePage";
import InicioKilometrajesPage from "./pages/InicioKilometrajesPage";
import HistorialKilometrajesPage from "./pages/HistorialKilometrajesPage";
import DetalleKilometrajePage from "./pages/DetalleKilometrajePage";
import EstadisticasKilometrajesPage from "./pages/EstadisticasKilometrajesPage";


function App() {
  return (
    <BrowserRouter>

      <Routes>

        {/* ===================================== */}
        {/* LOGIN */}
        {/* ===================================== */}

        <Route
          path="/login"
          element={
            <LoginPage />
          }
        />


        {/* ===================================== */}
        {/* SISTEMA PROTEGIDO */}
        {/* ===================================== */}

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
                    path="/repartos/inicio"
                    element={
                      <InicioRepartosPage />
                    }
                  />

                  <Route
                    path="/repartos/nuevo"
                    element={
                      <NuevoRepartoPage />
                    }
                  />

                  <Route
                    path="/repartos/planillas"
                    element={
                      <ProcesarPlanillasRecargasPage />
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
                    path="/rechazos/inicio"
                    element={
                      <InicioRechazosPage />
                    }
                  />

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
                    path="/cambios/inicio"
                    element={
                      <InicioCambiosPage />
                    }
                  />

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


                  {/* ============================= */}
                  {/* VIÁTICOS */}
                  {/* ============================= */}

                  <Route
                    path="/viaticos/inicio"
                    element={
                      <InicioViaticosPage />
                    }
                  />

                  <Route
                    path="/viaticos/nuevo"
                    element={
                      <NuevoViaticoPage />
                    }
                  />

                  <Route
                    path="/viaticos"
                    element={
                      <HistorialViaticosPage />
                    }
                  />

                  <Route
                    path="/viaticos/resumen"
                    element={
                      <ResumenAnualViaticosPage />
                    }
                  />


                  {/* ============================= */}
                  {/* ASISTENTE IA */}
                  {/* ============================= */}

                  <Route
                    path="/asistente"
                    element={
                      <AsistenteIAPage />
                    }
                  />

                  <Route
                    path="/kilometrajes/nuevo"
                    element={<NuevoControlKilometrajePage />}
                  />

                  <Route
                    path="/kilometrajes/inicio"
                    element={<InicioKilometrajesPage />}
                  />

                  <Route
                    path="/kilometrajes"
                    element={<HistorialKilometrajesPage />}
                  />

                  <Route
                    path="/kilometrajes/:id"
                    element={<DetalleKilometrajePage />}
                  />

                  <Route
                    path="/kilometrajes/estadisticas"
                    element={<EstadisticasKilometrajesPage />}
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