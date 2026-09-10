import { useState } from "react";

import "./ProcesarPlanillasRecargasPage.css";


type Advertencia = {
  tipo: string;
  mensaje: string;
};


type ErrorPlanilla = {
  tipo: string;
  mensaje: string;
};


type RegistroProcesado = {
  carga_distribucion: string;
  carga_personal: string;

  chofer_distribucion: string;
  chofer: string;

  patente: string;
  combustible: string;

  ayudantes: string[];

  clientes: number;
  bultos: number;

  cantidad_ayudantes: number;
  cantidad_personas: number;

  recargas: number;
  recargas_totales: number;

  observaciones: string;

  estado: "ok" | "advertencia";
  advertencia: string | null;
};


type ResultadoProcesamiento = {
  fecha: string | null;
  cantidad: number;

  registros: RegistroProcesado[];

  errores: ErrorPlanilla[];
  advertencias: Advertencia[];
};


const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000/api";


function obtenerCookie(
  nombre: string
) {
  const cookies =
    document.cookie.split(";");

  for (
    const cookie
    of cookies
  ) {
    const [
      clave,
      ...resto
    ] =
      cookie
        .trim()
        .split("=");

    if (
      clave === nombre
    ) {
      return decodeURIComponent(
        resto.join("=")
      );
    }
  }

  return "";
}


function formatearFecha(
  fecha: string | null
) {
  if (!fecha) {
    return "Sin detectar";
  }

  const [
    anio,
    mes,
    dia
  ] =
    fecha.split("-");

  return `${dia}/${mes}/${anio}`;
}


export default function ProcesarPlanillasRecargasPage() {
  const [
    archivoDistribucion,
    setArchivoDistribucion,
  ] =
    useState<File | null>(
      null
    );

  const [
    archivoPersonal,
    setArchivoPersonal,
  ] =
    useState<File | null>(
      null
    );

  const [
    resultado,
    setResultado,
  ] =
    useState<
      ResultadoProcesamiento | null
    >(
      null
    );

  const [
    procesando,
    setProcesando,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");


  async function procesarPlanillas() {
    setError("");
    setResultado(null);

    if (
      !archivoDistribucion
    ) {
      setError(
        "Seleccioná la planilla de distribución."
      );
      return;
    }

    if (
      !archivoPersonal
    ) {
      setError(
        "Seleccioná la planilla de salida de personal."
      );
      return;
    }

    const formData =
      new FormData();

    formData.append(
      "archivo_rutas",
      archivoDistribucion
    );

    formData.append(
      "archivo_salidas",
      archivoPersonal
    );

    try {
      setProcesando(true);

      const csrfToken =
        obtenerCookie(
          "csrftoken"
        );

      const respuesta =
        await fetch(
          `${API_URL}/planillas-recargas/procesar/`,
          {
            method: "POST",
            credentials: "include",

            headers:
              csrfToken
                ? {
                    "X-CSRFToken":
                      csrfToken,
                  }
                : undefined,

            body:
              formData,
          }
        );

      const datos =
        await respuesta.json();

      if (
        !respuesta.ok
      ) {
        throw new Error(
          datos.error
          ||
          datos.detalle
          ||
          "No se pudieron procesar las planillas."
        );
      }

      setResultado(
        datos
      );

    } catch (err) {
      if (
        err instanceof Error
      ) {
        setError(
          err.message
        );
      } else {
        setError(
          "Ocurrió un error inesperado."
        );
      }

    } finally {
      setProcesando(
        false
      );
    }
  }


  function limpiar() {
    setArchivoDistribucion(
      null
    );

    setArchivoPersonal(
      null
    );

    setResultado(
      null
    );

    setError(
      ""
    );

    const inputDistribucion =
      document.getElementById(
        "archivo-distribucion"
      );

    const inputPersonal =
      document.getElementById(
        "archivo-personal"
      );

    if (
      inputDistribucion instanceof
      HTMLInputElement
    ) {
      inputDistribucion.value =
        "";
    }

    if (
      inputPersonal instanceof
      HTMLInputElement
    ) {
      inputPersonal.value =
        "";
    }
  }


  return (
    <div className="planillas-page">

      {/* ENCABEZADO */}

      <div className="planillas-header">
        <h1>
          Carga desde planillas
        </h1>

        <p>
          Procesá automáticamente la planilla de distribución
          y la salida de choferes y ayudantes.
        </p>
      </div>


      {/* ARCHIVOS */}

      <section className="planillas-card">
        <h2>
          Planillas del día
        </h2>

        <div className="planillas-files">

          {/* DISTRIBUCIÓN */}

          <div className="planillas-field">
            <label
              htmlFor="archivo-distribucion"
            >
              Planilla de distribución
            </label>

            <input
              id="archivo-distribucion"
              type="file"
              accept=".xlsx,.xlsm"
              onChange={
                (
                  evento
                ) => {
                  setArchivoDistribucion(
                    evento.target.files?.[0]
                    ||
                    null
                  );

                  setResultado(
                    null
                  );

                  setError(
                    ""
                  );
                }
              }
            />

            {
              archivoDistribucion
              &&
              (
                <p className="planillas-file-name">
                  Archivo seleccionado:{" "}
                  <strong>
                    {
                      archivoDistribucion.name
                    }
                  </strong>
                </p>
              )
            }
          </div>


          {/* PERSONAL */}

          <div className="planillas-field">
            <label
              htmlFor="archivo-personal"
            >
              Salida de choferes y ayudantes
            </label>

            <input
              id="archivo-personal"
              type="file"
              accept=".xlsx,.xlsm"
              onChange={
                (
                  evento
                ) => {
                  setArchivoPersonal(
                    evento.target.files?.[0]
                    ||
                    null
                  );

                  setResultado(
                    null
                  );

                  setError(
                    ""
                  );
                }
              }
            />

            {
              archivoPersonal
              &&
              (
                <p className="planillas-file-name">
                  Archivo seleccionado:{" "}
                  <strong>
                    {
                      archivoPersonal.name
                    }
                  </strong>
                </p>
              )
            }
          </div>

        </div>


        {/* ERROR GENERAL */}

        {
          error
          &&
          (
            <div className="planillas-error">
              {error}
            </div>
          )
        }


        {/* BOTONES */}

        <div className="planillas-actions">
          <button
            type="button"
            className="planillas-button-primary"
            onClick={
              procesarPlanillas
            }
            disabled={
              procesando
            }
          >
            {
              procesando
                ? "Procesando..."
                : "Procesar planillas"
            }
          </button>

          <button
            type="button"
            className="planillas-button-secondary"
            onClick={
              limpiar
            }
            disabled={
              procesando
            }
          >
            Limpiar
          </button>
        </div>
      </section>


      {/* RESULTADO */}

      {
        resultado
        &&
        (
          <>

            {/* RESUMEN */}

            <div className="planillas-summary">
              <div className="planillas-summary-card">
                <span>
                  Fecha detectada
                </span>

                <strong>
                  {
                    formatearFecha(
                      resultado.fecha
                    )
                  }
                </strong>
              </div>

              <div className="planillas-summary-card">
                <span>
                  Cargas procesadas
                </span>

                <strong>
                  {
                    resultado.cantidad
                  }
                </strong>
              </div>

              <div className="planillas-summary-card">
                <span>
                  Advertencias
                </span>

                <strong>
                  {
                    resultado
                      .advertencias
                      .length
                  }
                </strong>
              </div>
            </div>


            {/* ERRORES */}

            {
              resultado.errores.length
              >
              0
              &&
              (
                <div className="planillas-errors">
                  <h3>
                    Errores encontrados
                  </h3>

                  <ul>
                    {
                      resultado.errores.map(
                        (
                          item,
                          indice
                        ) => (
                          <li
                            key={
                              indice
                            }
                          >
                            {
                              item.mensaje
                            }
                          </li>
                        )
                      )
                    }
                  </ul>
                </div>
              )
            }


            {/* ADVERTENCIAS */}

            {
              resultado
                .advertencias
                .length
              >
              0
              &&
              (
                <div className="planillas-warning">
                  <h3>
                    Advertencias
                  </h3>

                  <ul>
                    {
                      resultado
                        .advertencias
                        .map(
                          (
                            item,
                            indice
                          ) => (
                            <li
                              key={
                                indice
                              }
                            >
                              {
                                item.mensaje
                              }
                            </li>
                          )
                        )
                    }
                  </ul>
                </div>
              )
            }


            {/* TABLA */}

            <section className="planillas-table-card">
              <div className="planillas-table-header">
                <h2>
                  Vista previa de recargas
                </h2>

                <p>
                  Revisá los datos antes de confirmar la carga.
                </p>
              </div>

              <div className="planillas-table-wrapper">
                <table className="planillas-table">

                  <thead>
                    <tr>
                      <th>
                        Carga
                      </th>

                      <th>
                        Chofer
                      </th>

                      <th>
                        Ayudantes
                      </th>

                      <th className="planillas-number">
                        Bultos
                      </th>

                      <th className="planillas-number">
                        Recargas
                      </th>

                      <th className="planillas-number">
                        Total
                      </th>

                      <th>
                        Estado
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {
                      resultado
                        .registros
                        .map(
                          (
                            registro,
                            indice
                          ) => {
                            const cargasDiferentes =
                              registro.carga_distribucion
                              !==
                              registro.carga_personal;

                            return (
                              <tr
                                key={
                                  indice
                                }
                              >

                                {/* CARGA */}

                                <td>
                                  {
                                    cargasDiferentes
                                      ? (
                                          <div>
                                            <div>
                                              Distribución:{" "}
                                              <strong>
                                                {
                                                  registro
                                                    .carga_distribucion
                                                }
                                              </strong>
                                            </div>

                                            <div className="planillas-load-warning">
                                              Personal:{" "}
                                              <strong>
                                                {
                                                  registro
                                                    .carga_personal
                                                }
                                              </strong>
                                            </div>
                                          </div>
                                        )
                                      : (
                                          <strong>
                                            {
                                              registro
                                                .carga_distribucion
                                            }
                                          </strong>
                                        )
                                  }
                                </td>


                                {/* CHOFER */}

                                <td>
                                  {
                                    registro.chofer
                                  }
                                </td>


                                {/* AYUDANTES */}

                                <td>
                                  {
                                    registro
                                      .ayudantes
                                      .length
                                      ? registro
                                          .ayudantes
                                          .join(", ")
                                      : "Sin ayudantes"
                                  }
                                </td>


                                {/* BULTOS */}

                                <td className="planillas-number">
                                  {
                                    registro.bultos
                                  }
                                </td>


                                {/* RECARGAS */}

                                <td className="planillas-number">
                                  <strong>
                                    {
                                      registro.recargas
                                    }
                                  </strong>
                                </td>


                                {/* TOTAL */}

                                <td className="planillas-number">
                                  <strong>
                                    {
                                      registro
                                        .recargas_totales
                                    }
                                  </strong>
                                </td>


                                {/* ESTADO */}

                                <td>
                                  {
                                    registro.estado
                                    ===
                                    "ok"
                                      ? (
                                          <span className="planillas-status-ok">
                                            Correcto
                                          </span>
                                        )
                                      : (
                                          <span className="planillas-status-warning">
                                            Revisar
                                          </span>
                                        )
                                  }
                                </td>

                              </tr>
                            );
                          }
                        )
                    }
                  </tbody>

                </table>
              </div>
            </section>


            {/* AVISO */}

            <div className="planillas-info">
              Esta es solamente una vista previa.
              Todavía no se guardó ningún reparto
              ni ninguna recarga en el sistema.
            </div>

          </>
        )
      }

    </div>
  );
}