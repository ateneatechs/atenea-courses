# Deploy en Hostinger VPS

Guía paso a paso para dejar la academia online para **Naza Barber** en un VPS de Hostinger.
Todo corre con Docker, así que no hace falta instalar Node ni PostgreSQL a mano.

---

## 0. Requisitos

- Un **VPS de Hostinger** (Ubuntu 22.04 recomendado) con acceso SSH.
- Un **dominio** apuntando al VPS (un registro `A` de `tudominio.com` → IP del VPS).
- Docker + Docker Compose instalados en el VPS.

Instalar Docker (si el VPS no lo trae):

```bash
curl -fsSL https://get.docker.com | sh
```

---

## 1. Subir el proyecto al VPS

```bash
# En el VPS
git clone <URL-del-repo> atenea-courses
cd atenea-courses
```

(o subir la carpeta por SFTP con FileZilla / hPanel).

---

## 2. Configurar variables de entorno

```bash
cp .env.example .env
nano .env
```

Completar como mínimo:

| Variable            | Valor                                              |
|---------------------|----------------------------------------------------|
| `DOMAIN`            | `nazabarber.com` (tu dominio, sin `https://`)      |
| `DEFAULT_TENANT`    | `naza-barber` (dejar así)                          |
| `POSTGRES_PASSWORD` | una contraseña fuerte                              |
| `JWT_SECRET`        | una cadena larga aleatoria                         |
| `MP_ACCESS_TOKEN`   | dejar vacío (se carga desde el admin)              |

> Generar un `JWT_SECRET`: `openssl rand -hex 32`

---

## 3. Levantar la aplicación

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Esto:
1. Crea la base PostgreSQL y aplica el esquema + migraciones en orden.
2. Crea el tenant **Naza Barber** y las cuentas admin/user/superadmin (servicio `seed`).
3. Compila y sirve el frontend y el backend detrás de Nginx en el puerto 80.

Verificar que esté arriba:

```bash
docker compose -f docker-compose.prod.yml ps
curl http://127.0.0.1:8090/api/health     # → {"status":"OK",...}
```

> Nota: en un VPS compartido con otros sitios, el nginx del proyecto **no** escucha en el 80/443
> del host — sólo en `127.0.0.1:8090` (ver sección 4). Hasta configurar el vhost del nginx nativo,
> la app no es accesible por `http://TU_IP` directamente, sólo con el `curl` de arriba.

**Credenciales por defecto** (cambiarlas después):

| Rol   | Email              | Contraseña      |
|-------|--------------------|-----------------|
| Admin | admin@atenea.com   | Admin123!       |
| User  | user@atenea.com    | User123!        |

---

## 4. Exponer el dominio y activar HTTPS (VPS compartido)

Si el VPS ya aloja otros sitios, el puerto 80/443 pertenece al **nginx nativo del host**
(no al `docker-compose.prod.yml` de este proyecto, que sólo escucha en `127.0.0.1:8090`).
El patrón es: un vhost nuevo en el nginx del host que hace `proxy_pass` a `127.0.0.1:8090`,
igual que los demás sitios del servidor.

Crear `/etc/nginx/sites-available/tudominio.com`:

```nginx
server {
    server_name tudominio.com www.tudominio.com;

    client_max_body_size 2048M;

    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 80;
}
```

```bash
ln -s /etc/nginx/sites-available/tudominio.com /etc/nginx/sites-enabled/tudominio.com
nginx -t && systemctl reload nginx
```

Mercado Pago **exige HTTPS** en producción. Con el vhost ya activo en el 80 y el DNS apuntando
al VPS, generar el certificado con el plugin de nginx (agrega el bloque `443 ssl` y el redirect
301 automáticamente):

```bash
certbot --nginx -d tudominio.com -d www.tudominio.com
```

La renovación automática ya la gestiona el timer/cron de certbot que se instaló con el paquete
(no hace falta un cron aparte, a diferencia de un stack Docker-only).

---

## 5. Conectar Mercado Pago

1. Entrar al admin: `https://tudominio.com/admin` con la cuenta admin.
2. Ir a la pestaña **Pagos**.
3. Pegar el **Access Token de producción** de la cuenta de Naza
   (Mercado Pago → Desarrolladores → Tus integraciones → Credenciales de producción).
4. Activar el switch **Pagos activados** y guardar.

> Para **probar sin cobrar de verdad**, usar un Access Token de **prueba** (empieza con `TEST-`).
> El sistema detecta automáticamente el modo sandbox.

Configurar el webhook en el panel de Mercado Pago (opcional pero recomendado):
`https://tudominio.com/api/payments/webhook?tenant=naza-barber`
(El sistema igual confirma el pago cuando el usuario vuelve del checkout, así que funciona aunque el webhook no esté configurado.)

---

## 6. Operación diaria

```bash
# Ver logs
docker compose -f docker-compose.prod.yml logs -f backend

# Actualizar tras cambios de código
git pull
docker compose -f docker-compose.prod.yml up -d --build

# Backup de la base de datos
docker exec atenea-db pg_dump -U atenea atenea_courses > backup_$(date +%F).sql
```

---

## Notas

- Los archivos subidos (logos) y la base de datos viven en volúmenes de Docker, así que
  **sobreviven** a `up -d --build`. Para borrar todo desde cero: `docker compose -f docker-compose.prod.yml down -v`.
- El servicio `seed` sólo crea las cuentas admin/user/superadmin si no existen (usa
  `ON CONFLICT DO NOTHING`), no pisa nada. No carga cursos de ejemplo — se agregan
  desde el admin.
- Para cambiar el nombre/colores/logo de la academia: admin → **Personalización**.
