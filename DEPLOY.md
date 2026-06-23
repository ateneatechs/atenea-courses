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
2. Crea el tenant **Naza Barber** y los datos de ejemplo (servicio `seed`, corre una sola vez).
3. Compila y sirve el frontend y el backend detrás de Nginx en el puerto 80.

Verificar que esté arriba:

```bash
docker compose -f docker-compose.prod.yml ps
curl http://localhost/api/health     # → {"status":"OK",...}
```

Entrar desde el navegador: `http://TU_IP` o `http://tudominio.com`.

**Credenciales por defecto** (cambiarlas después):

| Rol   | Email              | Contraseña      |
|-------|--------------------|-----------------|
| Admin | admin@atenea.com   | Admin123!       |
| User  | user@atenea.com    | User123!        |

---

## 4. Activar HTTPS (necesario para cobrar con Mercado Pago)

Mercado Pago **exige HTTPS** en producción. Pasos:

```bash
# Instalar certbot en el host
sudo apt install -y certbot

# Generar el certificado (con el stack ya corriendo en el puerto 80)
sudo certbot certonly --webroot -w /var/www/certbot -d tudominio.com
```

> Si `--webroot` falla, parar Nginx (`docker compose -f docker-compose.prod.yml stop nginx`)
> y usar `sudo certbot certonly --standalone -d tudominio.com`.

Luego editar `nginx/nginx.prod.conf`:
1. En el server `:80`, reemplazar todo lo que está debajo del comentario por `return 301 https://$host$request_uri;` (dejando el bloque `/.well-known/`).
2. Descomentar el bloque `server { listen 443 ssl; ... }` y reemplazar `YOUR_DOMAIN.com` por tu dominio.

Reiniciar Nginx:

```bash
docker compose -f docker-compose.prod.yml restart nginx
```

Renovación automática del certificado (cron):

```bash
echo "0 3 * * * certbot renew --quiet && docker compose -f /root/atenea-courses/docker-compose.prod.yml restart nginx" | sudo crontab -
```

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
- El servicio `seed` sólo crea datos si no existen (usa `ON CONFLICT DO NOTHING`), no pisa nada.
- Para cambiar el nombre/colores/logo de la academia: admin → **Personalización**.
