# Sistema de Órdenes de Servicio - Grupo Estrella

Sistema web para gestión de órdenes de servicio técnico, clientes, reportes PDF y notificaciones por email.

## 🚀 Inicio Rápido

### Para desarrollo local:

1. Lee la **[GUÍA DE CONFIGURACIÓN LOCAL](CONFIGURACION-LOCAL.md)**
2. Sigue los pasos de la guía
3. Ejecuta `docker-compose up -d postgres`
4. Ejecuta `npm install && npm start`
5. Abre http://localhost:3000

## 📚 Documentación

- **[CONFIGURACION-LOCAL.md](CONFIGURACION-LOCAL.md)** - Guía completa para configurar el proyecto localmente

## 🛠️ Stack Tecnológico

- **Backend:** Node.js + Express 5
- **Base de datos:** PostgreSQL
- **Templates:** EJS
- **PDFs:** PDFKit
- **Email:** Nodemailer
- **Docker:** Contenedorización

## 📦 Estructura del Proyecto

```
ordenDeServicio-docker/
├── index.js              # Servidor principal
├── reportePDF.js         # Generación de PDFs
├── envioEmail.js         # Envío de correos
├── views/                # Templates EJS
├── public/               # Archivos estáticos (CSS, JS, imágenes)
├── backups/              # Backups de base de datos
├── docker-compose.yml    # Configuración Docker
└── config.env            # Variables de entorno (no en Git)
```

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm start                 # Iniciar aplicación

# Docker
docker-compose up -d      # Levantar todos los servicios
docker-compose up postgres # Solo base de datos
docker-compose down       # Detener servicios

# Base de datos
backup-remoto.bat        # Hacer backup de BD remota (Windows)
restore-local.bat        # Restaurar backup en BD local (Windows)
```

## 👥 Roles de Usuario

- **Admin (role=1):** Puede crear usuarios, ver historial completo, gestionar órdenes
- **Técnico (role=2):** Puede ver órdenes pendientes y completar servicios

## 🔐 Seguridad

- Contraseñas encriptadas con bcrypt
- Sesiones con express-session
- Queries parametrizadas (prevención SQL injection)
- Credenciales en archivo .env (no en repositorio)

## 📧 Configuración de Correos

En desarrollo, usa **Mailtrap.io** para capturar correos sin enviarlos realmente.

Ver detalles en [CONFIGURACION-LOCAL.md](CONFIGURACION-LOCAL.md#7-configurar-correos-para-desarrollo)

## 🗄️ Base de Datos

**Remota (Producción):**
- Host: 10.2.10.26:5432
- Base de datos: vega_db

**Local (Desarrollo):**
- Host: localhost:5432
- Base de datos: vega_db

## 📝 Flujo de la Aplicación

1. **Login** → Autenticación de usuario
2. **Menu Admin** → Panel de opciones (admin) o lista de órdenes (técnico)
3. **Crear Orden** → Cliente nuevo o habitual
4. **Captura de Datos** → Equipo, fallas, trabajo realizado
5. **Firmas** → Captura digital de firmas
6. **PDF + Email** → Genera reporte y envía por correo
7. **Cierre** → Orden marcada como completada

## 🐛 Problemas Conocidos

Ver sección "Problemas Comunes" en [CONFIGURACION-LOCAL.md](CONFIGURACION-LOCAL.md#-problemas-comunes)

## 📄 Licencia

ISC

## 👤 Autor

Jonathan Garcia

## 🔗 Repositorio

https://github.com/StephL3rma/orden-servicio.app.git
