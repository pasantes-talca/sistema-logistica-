import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import NuevoRepartoPage from "./pages/NuevoRepartoPage";
import HistorialRepartosPage from "./pages/HistorialRepartosPage";
import EditarRepartoPage from "./pages/EditarRepartoPage";
import ReporteRecargasPage from "./pages/ReporteRecargasPage";

import NuevoRechazoPage from "./pages/NuevoRechazoPage";
import HistorialRechazosPage from "./pages/HistorialRechazosPage";
import EditarRechazoPage from "./pages/EditarRechazoPage";
import EstadisticasRechazosPage from "./pages/EstadisticasRechazosPage";


function App() {

  return (
    <BrowserRouter>

      <div className="app">

        <header className="barra-superior">

          <div className="marca">
            Logística Talca
          </div>


          <nav className="navegacion">

            <Link to="/repartos/nuevo">
              Nuevo reparto
            </Link>

            <Link to="/repartos">
              Historial repartos
            </Link>

            <Link to="/repartos/recargas">
              Reporte recargas
            </Link>

            <Link to="/rechazos/nuevo">
              Nuevo rechazo
            </Link>

            <Link to="/rechazos">
              Historial rechazos
            </Link>

            <Link to="/rechazos/estadisticas">
              Estadísticas rechazos
            </Link>

          </nav>

        </header>


        <main>

          <Routes>

            <Route
              path="/"
              element={
                <Navigate
                  to="/repartos/nuevo"
                  replace
                />
              }
            />


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

          </Routes>

        </main>

      </div>

    </BrowserRouter>
  );
}


export default App;