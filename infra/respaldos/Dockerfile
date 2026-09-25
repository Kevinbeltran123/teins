# Copia diaria fuera del proyecto (ADR-0016, nivel 2; ADR-0021). La misma versión mayor de PostgreSQL
# del servidor, para que pg_dump la entienda, y rclone (MIT) para hablar con dos almacenamientos S3.
FROM postgres:18-alpine
RUN apk add --no-cache rclone && touch /etc/rclone.conf
# Sin archivo de configuración: rclone toma todo de las variables RCLONE_CONFIG_*.
ENV RCLONE_CONFIG=/etc/rclone.conf
COPY respaldar.sh /usr/local/bin/respaldar
RUN chmod 0755 /usr/local/bin/respaldar
USER postgres
CMD ["respaldar"]
