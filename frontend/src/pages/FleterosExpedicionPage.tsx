import {
  useState,
} from "react";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  crearFletero,
  obtenerFleteros,
} from "../api/expedicion";

import Icon from "../components/ui/Icon";

import "./Expedicion.css";


export default function FleterosExpedicionPage() {

  const queryClient =
    useQueryClient();


  const [
    nombre,
    setNombre,
  ] = useState("");


  const [
    apellido,
    setApellido,
  ] = useState("");


  const [
    empresa,
    setEmpresa,
  ] = useState("");


  // =========================================================
  // CONSULTAR FLETEROS
  // =========================================================

  const {
    data: fleteros = [],
    isLoading,
    isError,
  } = useQuery({

    queryKey: [
      "expedicion-fleteros",
    ],

    queryFn:
      obtenerFleteros,

  });


  // =========================================================
  // CREAR FLETERO
  // =========================================================

  const crearMutation =
    useMutation({

      mutationFn:
        crearFletero,

      onSuccess: async () => {

        await queryClient.invalidateQueries({
          queryKey: [
            "expedicion-fleteros",
          ],
        });


        setNombre("");
        setApellido("");
        setEmpresa("");


        alert(
          "Fletero creado correctamente."
        );
      },


      onError: error => {

        alert(
          error instanceof Error
            ? error.message
            : "No se pudo crear el fletero."
        );
      },

    });


  // =========================================================
  // GUARDAR
  // =========================================================

  function guardarFletero(
    event:
      React.FormEvent<HTMLFormElement>
  ) {

    event.preventDefault();


    if (!nombre.trim()) {

      alert(
        "Ingresá el nombre del fletero."
      );

      return;
    }


    crearMutation.mutate({

      nombre:
        nombre.trim(),

      apellido:
        apellido.trim(),

      empresa:
        empresa.trim(),

      activo:
        true,

    });
  }


  // =========================================================
  // DATOS RESUMEN
  // =========================================================

  const activos =
    fleteros.filter(
      fletero =>
        fletero.activo
    );


  // =========================================================
  // RENDER
  // =========================================================

  return (

    <div className="pagina expedicion-page">

      <div className="dashboard-container">


        {/* ===================================== */}
        {/* ENCABEZADO */}
        {/* ===================================== */}

        <div className="dashboard-bienvenida">

          <div>

            <div className="badge-panel">

              <Icon
                name="truck"
                size={16}
              />

              Expedición

            </div>


            <h1>
              Fleteros
            </h1>


            <p>
              Administrá los fleteros utilizados
              en las órdenes de carga de Expedición.
            </p>

          </div>


          <div className="dashboard-status">

            <span />

            <div>

              <strong>
                Maestros de Expedición
              </strong>

              <small>
                Fleteros disponibles
                para órdenes de carga
              </small>

            </div>

          </div>

        </div>


        {/* ===================================== */}
        {/* RESUMEN */}
        {/* ===================================== */}

        <section>

          <div className="section-heading">

            <div>

              <span>
                RESUMEN
              </span>

              <h2>
                Fleteros registrados
              </h2>

            </div>


            <small>
              Información actual
              de Expedición
            </small>

          </div>


          <div className="dashboard-kpis">


            {/* TOTAL */}

            <div className="kpi-card">

              <div className="kpi-icon blue">

                <Icon
                  name="truck"
                />

              </div>


              <div>

                <span>
                  Fleteros totales
                </span>

                <strong>
                  {
                    isLoading
                      ? "—"
                      : fleteros.length
                  }
                </strong>

                <small>
                  Registros
                </small>

              </div>

            </div>


            {/* ACTIVOS */}

            <div className="kpi-card">

              <div className="kpi-icon green">

                <Icon
                  name="activity"
                />

              </div>


              <div>

                <span>
                  Fleteros activos
                </span>

                <strong>
                  {
                    isLoading
                      ? "—"
                      : activos.length
                  }
                </strong>

                <small>
                  Disponibles
                </small>

              </div>

            </div>

          </div>

        </section>


        {/* ===================================== */}
        {/* NUEVO FLETERO */}
        {/* ===================================== */}

        <section>

          <div className="section-heading">

            <div>

              <span>
                NUEVO
              </span>

              <h2>
                Registrar fletero
              </h2>

            </div>


            <small>
              Completá los datos
              del nuevo fletero
            </small>

          </div>


          <form
            onSubmit={
              guardarFletero
            }
          >

            <div className="form-grid">


              {/* NOMBRE */}

              <div className="form-group">

                <label>
                  Nombre
                </label>


                <input
                  type="text"

                  value={
                    nombre
                  }

                  onChange={
                    event =>
                      setNombre(
                        event.target.value
                      )
                  }

                  placeholder="Ej: Juan"
                />

              </div>


              {/* APELLIDO */}

              <div className="form-group">

                <label>
                  Apellido
                </label>


                <input
                  type="text"

                  value={
                    apellido
                  }

                  onChange={
                    event =>
                      setApellido(
                        event.target.value
                      )
                  }

                  placeholder="Ej: Pérez"
                />

              </div>


              {/* EMPRESA */}

              <div className="form-group">

                <label>
                  Empresa
                </label>


                <input
                  type="text"

                  value={
                    empresa
                  }

                  onChange={
                    event =>
                      setEmpresa(
                        event.target.value
                      )
                  }

                  placeholder="Ej: Transporte Pérez"
                />

              </div>

            </div>


            <div
              style={{
                marginTop: "20px",
              }}
            >

              <button
                type="submit"

                className="btn-primary"

                disabled={
                  crearMutation.isPending
                }
              >

                <Icon
                  name="plus"
                  size={16}
                />

                {
                  crearMutation.isPending
                    ? "Guardando..."
                    : "Registrar fletero"
                }

              </button>

            </div>

          </form>

        </section>


        {/* ===================================== */}
        {/* LISTADO */}
        {/* ===================================== */}

        <section>

          <div className="section-heading">

            <div>

              <span>
                FLETEROS
              </span>

              <h2>
                Listado general
              </h2>

            </div>


            <small>
              {
                isLoading
                  ? "Cargando..."
                  : `${fleteros.length} registros`
              }
            </small>

          </div>


          {
            isLoading
              ? (

                  <p>
                    Cargando fleteros...
                  </p>

                )

              : isError
                ? (

                    <div className="expedicion-empty">

                      <Icon
                        name="alert"
                        size={36}
                      />

                      <h3>
                        No se pudo cargar
                      </h3>

                      <p>
                        Ocurrió un error al obtener
                        los fleteros.
                      </p>

                    </div>

                  )

                : fleteros.length === 0
                  ? (

                      <div className="expedicion-empty">

                        <Icon
                          name="truck"
                          size={36}
                        />

                        <h3>
                          No hay fleteros
                        </h3>

                        <p>
                          Registrá el primer
                          fletero de Expedición.
                        </p>

                      </div>

                    )

                  : (

                      <div
                        style={{
                          overflowX:
                            "auto",
                        }}
                      >

                        <table>

                          <thead>

                            <tr>

                              <th>
                                Nombre
                              </th>

                              <th>
                                Apellido
                              </th>

                              <th>
                                Empresa
                              </th>

                              <th>
                                Estado
                              </th>

                            </tr>

                          </thead>


                          <tbody>

                            {
                              fleteros.map(
                                fletero => (

                                  <tr
                                    key={
                                      fletero.id
                                    }
                                  >

                                    <td>

                                      <strong>
                                        {
                                          fletero.nombre
                                        }
                                      </strong>

                                    </td>


                                    <td>
                                      {
                                        fletero.apellido
                                        ||
                                        "—"
                                      }
                                    </td>


                                    <td>
                                      {
                                        fletero.empresa
                                        ||
                                        "—"
                                      }
                                    </td>


                                    <td>

                                      <span
                                        style={{
                                          display:
                                            "inline-flex",

                                          alignItems:
                                            "center",

                                          gap:
                                            "6px",

                                          padding:
                                            "5px 9px",

                                          borderRadius:
                                            "20px",

                                          background:
                                            fletero.activo
                                              ? "#edf9f3"
                                              : "#f2f4f7",

                                          color:
                                            fletero.activo
                                              ? "#16865a"
                                              : "#667085",

                                          fontSize:
                                            "11px",

                                          fontWeight:
                                            700,
                                        }}
                                      >

                                        <span
                                          style={{
                                            width:
                                              "6px",

                                            height:
                                              "6px",

                                            borderRadius:
                                              "50%",

                                            background:
                                              fletero.activo
                                                ? "#18a566"
                                                : "#98a2b3",
                                          }}
                                        />

                                        {
                                          fletero.activo
                                            ? "Activo"
                                            : "Inactivo"
                                        }

                                      </span>

                                    </td>

                                  </tr>

                                )
                              )
                            }

                          </tbody>

                        </table>

                      </div>

                    )
          }

        </section>

      </div>

    </div>

  );
}