// Cliente mínimo de la API. Todas las vistas pasan por aquí.
const BASE = (window.APP_CONFIG?.API_URL || "").replace(/\/$/, "");

async function pedir(metodo, ruta, cuerpo) {
  let respuesta;
  try {
    respuesta = await fetch(BASE + ruta, {
      method: metodo,
      headers: cuerpo ? { "Content-Type": "application/json" } : {},
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new Error("No se pudo conectar con la API");
  }

  if (respuesta.status === 204) return null;
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const error = new Error(datos?.error || `Error ${respuesta.status}`);
    error.status = respuesta.status;
    throw error;
  }
  return datos;
}

export const api = {
  get: (ruta) => pedir("GET", ruta),
  post: (ruta, cuerpo) => pedir("POST", ruta, cuerpo),
  put: (ruta, cuerpo) => pedir("PUT", ruta, cuerpo),
  del: (ruta) => pedir("DELETE", ruta),
};
