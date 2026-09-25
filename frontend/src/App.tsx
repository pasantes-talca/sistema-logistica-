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


import InicioExpedicionPage
  from "./pages/InicioExpedicionPage";

import StockExpedicionPage
  from "./pages/StockExpedicionPage";

import OrdenesExpedicionPage
  from "./pages/OrdenesExpedicionPage";

import MovimientosExpedicionPage
  from "./pages/MovimientosExpedicionPage";


import FleterosExpedicionPage
  from "./pages/FleterosExpedicionPage";

import MaterialesExpedicionPage
  from "./pages/MaterialesExpedicionPage";

import NuevaOrdenExpedicionPage
  from "./pages/NuevaOrdenExpedicionPage";


import DetalleOrdenExpedicionPage
  from "./pages/DetalleOrdenExpedicionPage";

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

                  <Route
                    path="/expedicion/inicio"
                    element={<InicioExpedicionPage />}
                  />

                  <Route
                    path="/expedicion/stock"
                    element={<StockExpedicionPage />}
                  />

                  <Route
                    path="/expedicion/ordenes"
                    element={<OrdenesExpedicionPage />}
                  />

                  <Route
                    path="/expedicion/movimientos"
                    element={<MovimientosExpedicionPage />}
                  />

                  <Route
                    path="/expedicion/fleteros"
                    element={<FleterosExpedicionPage />}
                  />

                  <Route
                    path="/expedicion/materiales"
                    element={<MaterialesExpedicionPage />}
                  />

                  <Route
                    path="/expedicion/ordenes/nueva"
                    element={<NuevaOrdenExpedicionPage />}
                  />

                  <Route
                    path="/expedicion/ordenes/:id"
                    element={<DetalleOrdenExpedicionPage />}
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