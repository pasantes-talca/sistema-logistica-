import {
  BrowserRouter,
  Route,
  Routes,
} from "react-router-dom";

import RutaProtegida from "./components/RutaProtegida";
import AppLayout from "./components/layout/AppLayout";

import LoginPage from "./pages/LoginPage";
import AdministracionPage from "./pages/AdministracionPage";
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


// =============================================
// KILOMETRAJES
// =============================================

import NuevoControlKilometrajePage
  from "./pages/NuevoControlKilometrajePage";

import InicioKilometrajesPage
  from "./pages/InicioKilometrajesPage";

import HistorialKilometrajesPage
  from "./pages/HistorialKilometrajesPage";

import DetalleKilometrajePage
  from "./pages/DetalleKilometrajePage";

import EstadisticasKilometrajesPage
  from "./pages/EstadisticasKilometrajesPage";


// =============================================
// CONTROL DIARIO
// =============================================

import InicioControlDiarioPage
  from "./pages/InicioControlDiarioPage";

import NuevoControlDiarioPage
  from "./pages/NuevoControlDiarioPage";

import HistorialControlDiarioPage
  from "./pages/HistorialControlDiarioPage";

import DetalleControlDiarioPage
  from "./pages/DetalleControlDiarioPage";

import EstadisticasControlDiarioPage
  from "./pages/EstadisticasControlDiarioPage";


// =============================================
// EXPEDICIÓN
// Rutas históricas y nuevas secciones comparten el mismo módulo operativo.
import ExpedicionOperativaPage from "./pages/ExpedicionOperativaPage";
// =============================================

function App() {

  return (

    <BrowserRouter>

      <Routes>


        {/* ===================================== */}
        {/* ENTRADA AL SISTEMA */}
        {/* ===================================== */}

        <Route
          path="/"
          element={
            <LoginPage />
          }
        />

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
                  <Route path="/administracion/*" element={<AdministracionPage />} />


                  {/* ============================= */}
                  {/* PANEL PRINCIPAL */}
                  {/* ============================= */}

                  <Route
                    path="/panel"
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
                    path="/repartos/recargas"
                    element={
                      <ReporteRecargasPage />
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
                    path="/rechazos/estadisticas"
                    element={
                      <EstadisticasRechazosPage />
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
                    path="/cambios/estadisticas"
                    element={
                      <EstadisticasCambiosPage />
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
                    path="/viaticos/resumen"
                    element={
                      <ResumenAnualViaticosPage />
                    }
                  />

                  <Route
                    path="/viaticos"
                    element={
                      <HistorialViaticosPage />
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


                  {/* ============================= */}
                  {/* KILOMETRAJES */}
                  {/* ============================= */}

                  <Route
                    path="/kilometrajes/inicio"
                    element={
                      <InicioKilometrajesPage />
                    }
                  />

                  <Route
                    path="/kilometrajes/nuevo"
                    element={
                      <NuevoControlKilometrajePage />
                    }
                  />

                  <Route
                    path="/kilometrajes/estadisticas"
                    element={
                      <EstadisticasKilometrajesPage />
                    }
                  />

                  <Route
                    path="/kilometrajes"
                    element={
                      <HistorialKilometrajesPage />
                    }
                  />

                  <Route
                    path="/kilometrajes/:id"
                    element={
                      <DetalleKilometrajePage />
                    }
                  />


                  {/* ============================= */}
                  {/* CONTROL DIARIO */}
                  {/* ============================= */}

                  <Route
                    path="/control-diario/inicio"
                    element={
                      <InicioControlDiarioPage />
                    }
                  />

                  <Route
                    path="/control-diario/nuevo"
                    element={
                      <NuevoControlDiarioPage />
                    }
                  />

                  <Route
                    path="/control-diario/estadisticas"
                    element={
                      <EstadisticasControlDiarioPage />
                    }
                  />

                  <Route
                    path="/control-diario"
                    element={
                      <HistorialControlDiarioPage />
                    }
                  />

                  <Route
                    path="/control-diario/:id"
                    element={
                      <DetalleControlDiarioPage />
                    }
                  />


                  {/* ============================= */}
                  {/* EXPEDICIÓN */}
                  {/* ============================= */}

                  <Route path="/expedicion/pendientes" element={<ExpedicionOperativaPage />} />
                  <Route path="/expedicion/empleados" element={<ExpedicionOperativaPage />} />
                  <Route path="/expedicion/conteos" element={<ExpedicionOperativaPage />} />
                  <Route path="/expedicion/auditoria" element={<ExpedicionOperativaPage />} />
                  <Route path="/expedicion/configuracion" element={<ExpedicionOperativaPage />} />
                  <Route path="/expedicion" element={<ExpedicionOperativaPage />} />

                  <Route
                    path="/expedicion/inicio"
                    element={
                      <ExpedicionOperativaPage />
                    }
                  />

                  <Route
                    path="/expedicion/stock"
                    element={
                      <ExpedicionOperativaPage />
                    }
                  />

                  <Route
                    path="/expedicion/ordenes"
                    element={
                      <ExpedicionOperativaPage />
                    }
                  />

                  <Route
                    path="/expedicion/movimientos"
                    element={
                      <ExpedicionOperativaPage />
                    }
                  />

                  <Route
                    path="/expedicion/fleteros"
                    element={
                      <ExpedicionOperativaPage />
                    }
                  />

                  <Route
                    path="/expedicion/materiales"
                    element={
                      <ExpedicionOperativaPage />
                    }
                  />

                  <Route
                    path="/expedicion/ordenes/nueva"
                    element={
                      <ExpedicionOperativaPage />
                    }
                  />

                  <Route
                    path="/expedicion/ordenes/:id"
                    element={
                      <ExpedicionOperativaPage />
                    }
                  />

                  <Route
                    path="/expedicion/ordenes/:id/editar"
                    element={
                      <ExpedicionOperativaPage />
                    }
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
