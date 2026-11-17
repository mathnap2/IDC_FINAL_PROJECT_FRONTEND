// APM del navegador con Sentry: errores de JavaScript, trazas de carga y de llamadas a la API,
// replays de las sesiones con error y logs. Solo se activa si config.js trae SENTRY_DSN.
(function () {
  const cfg = window.APP_CONFIG || {};

  // Mientras el SDK carga (o si no hay DSN), estas funciones no hacen nada.
  window.monitoreo = {
    advertencia() {},
    error() {},
  };

  if (!cfg.SENTRY_DSN) return;

  const script = document.createElement("script");
  script.src = "https://browser.sentry-cdn.com/11.13.0/bundle.tracing.replay.logs.metrics.min.js";
  // Hash del archivo: el navegador lo rechaza si el CDN entrega algo distinto.
  script.integrity = "sha384-I6mF86ruXLH9G4cyBmmoNCJVV3Me1zLdqbQko3cCEaHm2FMZQeAXx5C/r+Lj/e2U";
  script.crossOrigin = "anonymous";
  script.onload = function () {
    const api = (cfg.API_URL || "").replace(/\/$/, "");
    window.Sentry.init({
      dsn: cfg.SENTRY_DSN,
      environment: cfg.AMBIENTE,
      integrations: [window.Sentry.browserTracingIntegration(), window.Sentry.replayIntegration()],
      // Tráfico muy bajo: se trazan todas las cargas y llamadas.
      tracesSampleRate: 1.0,
      // Propaga el id de la traza al backend para ver front y back en la misma traza.
      tracePropagationTargets: api ? [api] : [],
      // Replays solo de las sesiones donde ocurre un error.
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
    });

    window.monitoreo = {
      // Reglas de negocio rechazadas por la API (400, 404, 409...) → Sentry Logs.
      advertencia(mensaje, datos) {
        window.Sentry.logger.warn(mensaje, datos);
      },
      // Fallas reales (API caída, error 500) → Issue en Sentry.
      error(err, datos) {
        window.Sentry.captureException(err, { extra: datos });
      },
    };
  };
  document.head.appendChild(script);
})();
