import {
  useState,
} from "react";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  useNavigate,
} from "react-router-dom";

import {
  iniciarSesion,
} from "../api/logistica";


export default function LoginPage() {

  const navigate =
    useNavigate();

  const queryClient =
    useQueryClient();


  const [
    username,
    setUsername,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");


  const mutation =
    useMutation({

      mutationFn:
        iniciarSesion,

      onSuccess: async () => {

        setError("");

        await queryClient.invalidateQueries({
          queryKey: [
            "usuario-actual"
          ],
        });

        navigate(
          "/"
        );
      },

      onError: (
        error: Error
      ) => {

        setError(
          error.message
        );
      },

    });


  function enviar(
    event: React.FormEvent
  ) {

    event.preventDefault();

    setError("");


    if (
      !username.trim()
      ||
      !password
    ) {

      setError(
        "Ingresá usuario y contraseña."
      );

      return;
    }


    mutation.mutate({
      username:
        username.trim(),

      password,
    });
  }


  return (

    <div className="pagina-login">

      <div className="login-card">

        <div className="login-marca">

          <h1>
            Logística Talca
          </h1>

          <p>
            Sistema de gestión logística
          </p>

        </div>


        <form
          className="login-formulario"
          onSubmit={enviar}
        >

          <div className="campo">

            <label>
              Usuario
            </label>

            <input
              type="text"
              value={username}
              onChange={(event) =>
                setUsername(
                  event.target.value
                )
              }
              autoComplete="username"
              autoFocus
            />

          </div>


          <div className="campo">

            <label>
              Contraseña
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              autoComplete="current-password"
            />

          </div>


          {
            error &&
            (
              <div className="login-error">
                {error}
              </div>
            )
          }


          <button
            className="boton-guardar login-boton"
            type="submit"
            disabled={
              mutation.isPending
            }
          >

            {
              mutation.isPending
                ? "Ingresando..."
                : "Ingresar"
            }

          </button>

        </form>

      </div>

    </div>

  );
}