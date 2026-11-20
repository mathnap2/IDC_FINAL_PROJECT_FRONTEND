# Cuentas Claras — Frontend

Interfaz web sencilla (HTML, CSS y JavaScript sin frameworks) que consume la API de Cuentas Claras.
Se sirve con **nginx** dentro de un contenedor Docker.

> 📋 **Tablero del proyecto:** [Cuentas Claras](https://github.com/users/angelcortes1705/projects/3)
> · Repos: [backend](https://github.com/mathnap2/IDC_FINAL_PROJECT)
> · [frontend](https://github.com/mathnap2/IDC_FINAL_PROJECT_FRONTEND)
> · [infraestructura](https://github.com/mathnap2/IDC_FINAL_PROJECT_TERRAFORM)

## Estructura

| Archivo | Qué hace |
|---|---|
| `index.html` | Esqueleto de la página: encabezado, contenedor de vistas y avisos |
| `config.js` | URL de la API y ambiente. En el contenedor se **regenera al arrancar** con las variables de entorno |
| `js/monitoreo.js` | Carga Sentry desde su CDN (con hash de integridad) si hay `SENTRY_DSN` |
| `js/api.js` | `fetch` hacia la API; convierte `{"error": "..."}` en una excepción con ese mensaje |
| `js/app.js` | Vistas (inicio de sesión, grupos, detalle de grupo, mi cuenta) y navegación por `#/ruta` |
| `css/styles.css` | Estilos |
| `docker/40-config.sh` | Script que nginx ejecuta al iniciar y que escribe `config.js` |
| `docker/default.conf` | Configuración de nginx (sin caché para `config.js`) |
| `Dockerfile` | Imagen `nginx:alpine` con los archivos estáticos |

## Configuración por ambiente

La misma imagen sirve para dev y prod: lo que cambia son las variables de entorno de la Web App
(las pone Terraform).

| Variable | Ejemplo |
|---|---|
| `API_URL` | `https://app-cc-api-dev-4yzr.azurewebsites.net` |
| `APP_ENV` (o `SENTRY_ENVIRONMENT`) | `dev` / `prod` — se muestra como etiqueta en el encabezado |
| `SENTRY_DSN` | DSN del proyecto `cuentas-claras-frontend` en Sentry (opcional) |

## Correr en local

```bash
docker build -t cuentas-claras-front .
docker run --rm -p 8080:80 -e API_URL=http://localhost:8000 -e APP_ENV=local cuentas-claras-front
```

Y abrir http://localhost:8080. Sin Docker basta con cualquier servidor estático
(`python -m http.server 8080`); en ese caso se usa el `config.js` del repo.

## Pipeline (GitHub Actions)

`.github/workflows/pipeline.yml`:

| Evento | Jobs |
|---|---|
| PR a `develop` o `main` | `ci`: revisa la sintaxis, construye la imagen y prueba el contenedor (config.js generado, página y scripts servidos) |
| Push a `develop` | `ci` → `build` (`:dev` y `:sha-<commit>`) → `deploy-dev` |
| Push a `main` | `ci` → `build` (`:latest` y `:sha-<commit>`) → `deploy-prod` (espera aprobación del environment `production`) |

La imagen se publica como `mathnap2/cuentas-claras-front` y se despliega la etiqueta `:sha-<commit>`. El login a
Azure es por OIDC. Si cambian los nombres de las Web Apps, se actualizan en `env:` al inicio del workflow.

## Contrato de API que usa el frontend

Las rutas son las del backend. El dinero viaja como texto (`"33.34"`) y las fechas como `YYYY-MM-DD`.
Los cuerpos marcados con ⚠️ son **propuesta** y hay que confirmarlos con quien implementa ese componente.

| Operación | Petición | Cuerpo |
|---|---|---|
| Crear usuario | `POST /api/usuarios` | `{nombre, email, password}` |
| Login | `POST /api/auth/login` | `{email, password}` → usuario |
| Actualizar / eliminar usuario | `PUT` / `DELETE /api/usuarios/<id>` | `{nombre?, email?, password?}` |
| Crear grupo | `POST /api/grupos` | `{nombre, descripcion, creado_por}` |
| Actualizar / eliminar grupo | `PUT` / `DELETE /api/grupos/<id>` | `{nombre?, descripcion?}` |
| Agregar / quitar miembro | `POST` / `DELETE /api/grupos/<id>/miembros/<usuario_id>` | — |
| Crear gasto ⚠️ | `POST /api/grupos/<id>/gastos` | `{descripcion, monto, pagado_por, tipo_division, participantes: [{usuario_id, valor}]}` — `valor` es el porcentaje o el monto; con `iguales` se ignora |
| Eliminar gasto | `DELETE /api/gastos/<id>` | — |
| Registrar pago ⚠️ | `POST /api/grupos/<id>/pagos` | `{de_usuario, a_usuario, monto}` |
| Eliminar pago | `DELETE /api/pagos/<id>` | — |
| Saldos ⚠️ | `GET /api/grupos/<id>/saldos` | → `[{usuario_id, nombre, saldo}]` |
| Deudas simplificadas ⚠️ | `GET /api/grupos/<id>/deudas-simplificadas` | → `[{de_usuario, a_usuario, monto}]` |

Si un endpoint todavía no existe en el backend, la sección correspondiente muestra "Aún no disponible"
en lugar de romper la página.

## Monitoreo (Sentry)

- **Issues:** errores de JavaScript no controlados, la API caída o respuestas 500.
- **Trazas:** carga de la página y llamadas a la API; el id de la traza viaja al backend, así que en Sentry
  se ve el recorrido completo navegador → API.
- **Logs:** cuando la API rechaza una operación (400, 409...) se registra el mensaje como advertencia.
- **Session Replay:** solo de las sesiones en las que ocurre un error.
