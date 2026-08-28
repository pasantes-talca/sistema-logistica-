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
              Historial
            </Link>

            <Link to="/repartos/recargas">
              Reporte recargas
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

          </Routes>

        </main>

      </div>

    </BrowserRouter>
  );
}


export default App;