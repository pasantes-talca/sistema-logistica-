import { useQuery } from "@tanstack/react-query"


interface HealthResponse {
  status: string
  sistema: string
}


async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/health/`
  )

  if (!response.ok) {
    throw new Error("No se pudo conectar con el backend")
  }

  return response.json()
}


function App() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
  })

  if (isLoading) {
    return <p>Cargando...</p>
  }

  if (isError) {
    return <p>Error conectando con Django</p>
  }

  return (
    <main className="min-h-screen bg-gray-100 p-10">
      <div className="mx-auto max-w-xl rounded-xl bg-white p-8 shadow">
        <h1 className="text-3xl font-bold">
          Talca Logística
        </h1>

        <p className="mt-4">
          Backend: {data?.status}
        </p>
      </div>
    </main>
  )
}


export default App