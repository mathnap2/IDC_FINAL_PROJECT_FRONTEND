FROM nginx:1.29-alpine

# Configuración de nginx y script que genera config.js al arrancar
COPY docker/default.conf /etc/nginx/conf.d/default.conf
COPY docker/40-config.sh /docker-entrypoint.d/40-config.sh
RUN chmod +x /docker-entrypoint.d/40-config.sh

# Archivos estáticos de la página
COPY index.html config.js /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/

EXPOSE 80
