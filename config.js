// Configuración para desarrollo local. En el contenedor este archivo se reemplaza
// al arrancar (docker/40-config.sh) con las variables de entorno de la Web App.
window.APP_CONFIG = {
  API_URL: "http://localhost:8000",
  AMBIENTE: "local",
  SENTRY_DSN: "",
};
