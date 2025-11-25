# 🚀 GUÍA DE CONFIGURACIÓN LOCAL

Esta guía te ayudará a correr el proyecto localmente y conectarte a las bases de datos.

---

## 📋 ÍNDICE

1. [Requisitos previos](#requisitos-previos)
2. [Configurar base de datos local](#configurar-base-de-datos-local)
3. [Conectar DBeaver](#conectar-dbeaver)
4. [Hacer backup de BD remota](#hacer-backup-de-bd-remota)
5. [Restaurar backup en BD local](#restaurar-backup-en-bd-local)
6. [Correr la aplicación localmente](#correr-la-aplicación-localmente)
7. [Configurar correos para desarrollo](#configurar-correos-para-desarrollo)

---

## 1. REQUISITOS PREVIOS

Instala lo siguiente:

- ✅ **Docker Desktop** - https://www.docker.com/products/docker-desktop
- ✅ **Node.js** (v18 o superior) - https://nodejs.org
- ✅ **DBeaver** - https://dbeaver.io/download/
- ✅ **PostgreSQL Client** (pg_dump/psql) - https://www.postgresql.org/download/

---

## 2. CONFIGURAR BASE DE DATOS LOCAL

### Opción A: Usando Docker Compose (RECOMENDADO)

```bash
# 1. Levantar PostgreSQL en Docker
docker-compose up -d postgres

# 2. Verificar que está corriendo
docker ps

# Deberías ver: orden-servicio-db
```

### Opción B: PostgreSQL instalado localmente

Si ya tienes PostgreSQL instalado:

```sql
-- Crear base de datos
CREATE DATABASE vega_db;

-- Crear usuario
CREATE USER dev_user WITH PASSWORD 'dev_password_local';

-- Dar permisos
GRANT ALL PRIVILEGES ON DATABASE vega_db TO dev_user;
```

---

## 3. CONECTAR DBEAVER

### 📌 Conexión a BASE DE DATOS REMOTA (Producción)

1. Abre **DBeaver**
2. Click en **"Nueva Conexión"** (ícono de enchufe)
3. Selecciona **PostgreSQL**
4. Completa los datos:

```
Host: 10.2.10.26
Puerto: 5432
Base de datos: vega_db
Usuario: dev_user
Contraseña: $14v4d0r4$
```

5. Click en **"Test Connection"** → Debería decir "Connected"
6. Click en **"Finish"**

### 📌 Conexión a BASE DE DATOS LOCAL (Desarrollo)

1. Abre **DBeaver**
2. Click en **"Nueva Conexión"**
3. Selecciona **PostgreSQL**
4. Completa los datos:

```
Host: localhost
Puerto: 5432
Base de datos: vega_db
Usuario: dev_user
Contraseña: dev_password_local
```

5. Click en **"Test Connection"**
6. Click en **"Finish"**

### 📸 Captura de pantalla de DBeaver

Tu DBeaver debería tener 2 conexiones:
- `vega_db (10.2.10.26)` ← PRODUCCIÓN (remota)
- `vega_db (localhost)` ← DESARROLLO (local)

---

## 4. HACER BACKUP DE BD REMOTA

### Opción 1: Usando el script (Windows)

```bash
# Ejecuta el archivo
backup-remoto.bat

# Te pedirá la contraseña: $14v4d0r4$
```

### Opción 2: Usando DBeaver

1. Click derecho en la conexión remota
2. **Tools** → **Backup Database**
3. Selecciona:
   - Format: **SQL**
   - Output: `backups/backup_manual.sql`
4. Click **Start**

### Opción 3: Comando manual

```bash
# Crear carpeta backups
mkdir backups

# Hacer backup
pg_dump -h 10.2.10.26 -U dev_user -d vega_db -F p -f backups/backup.sql

# Contraseña: $14v4d0r4$
```

---

## 5. RESTAURAR BACKUP EN BD LOCAL

### Usando el script (Windows)

```bash
# 1. Primero haz el backup (sección anterior)
# 2. Luego ejecuta:
restore-local.bat

# Ingresa el nombre del archivo cuando te lo pida
```

### Comando manual

```bash
# Restaurar en Docker
docker exec -i orden-servicio-db psql -U dev_user -d vega_db < backups/backup.sql

# O si tienes PostgreSQL local:
psql -h localhost -U dev_user -d vega_db -f backups/backup.sql
```

---

## 6. CORRER LA APLICACIÓN LOCALMENTE

### Paso 1: Instalar dependencias

```bash
npm install
```

### Paso 2: Configurar archivo de entorno

**Renombra `config.env.local` a `config.env`** para usar la configuración local:

```bash
# En Windows
copy config.env.local config.env

# Edita config.env y ajusta si es necesario
```

### Paso 3: Levantar la aplicación

**Opción A: Solo la app (usar BD remota)**

```bash
npm start
```

**Opción B: Todo con Docker Compose (BD local + app)**

```bash
docker-compose up
```

**Opción C: BD local + app en terminal (para desarrollo)**

```bash
# Terminal 1: Levantar PostgreSQL
docker-compose up postgres

# Terminal 2: Correr la app
npm start
```

### Paso 4: Abrir en el navegador

Abre: **http://localhost:3000**

---

## 7. CONFIGURAR CORREOS PARA DESARROLLO

### ⚠️ IMPORTANTE: No uses correos reales en desarrollo

### Opción 1: Mailtrap.io (RECOMENDADO)

1. Registrate gratis en: https://mailtrap.io
2. Crea un inbox de prueba
3. Copia las credenciales SMTP
4. Edita `config.env`:

```env
emailHost="sandbox.smtp.mailtrap.io"
emailPort="2525"
emailSecure="false"
emailAuthUser="tu_usuario_mailtrap"
emailAuthPass="tu_password_mailtrap"
```

**Ventaja:** Todos los correos se capturan en Mailtrap, NO se envían realmente.

### Opción 2: Ethereal Email (alternativa gratis)

1. Ve a: https://ethereal.email/create
2. Te dará credenciales temporales
3. Úsalas en `config.env`

### Opción 3: Comentar envío de correos

Edita `index.js` línea 701:

```javascript
// Comentar temporalmente el envío
// transportador.sendMail(mailOpciones, (error, info) => {
//   if (error) {
//     return console.log(error);
//   }
//   console.log('Correo enviado: ' + info.response);
// });

console.log('CORREO NO ENVIADO (modo desarrollo)');
console.log('Destinatarios:', email, mailOpciones.to);
```

---

## 📊 ESTRUCTURA DE LA BASE DE DATOS

```
vega_db
├── usuarios              ← Usuarios del sistema
├── usuarios_roles        ← Roles asignados
├── clientes              ← Información de clientes
├── cliente_direccion     ← Direcciones de servicio
├── ordenes_servicio      ← Órdenes de trabajo
├── ordenes_servicio_tipos_servicio  ← Tipos de servicio por orden
├── piezas_danadas        ← Partes utilizadas
├── tipos_servicio        ← Catálogo de servicios
├── tipo_equipo           ← Catálogo de equipos
└── marcas                ← Catálogo de marcas
```

---

## 🔍 VERIFICAR QUE TODO FUNCIONA

### 1. Base de datos

```bash
# Verificar que PostgreSQL está corriendo
docker ps

# Deberías ver: orden-servicio-db
```

### 2. Conexión en DBeaver

- Abre DBeaver
- Click en la conexión local
- Navega a `vega_db` → `Schemas` → `public` → `Tables`
- Deberías ver las tablas: usuarios, clientes, ordenes_servicio, etc.

### 3. Aplicación

```bash
npm start

# Deberías ver:
# "Conectado a servidor 3000"
# "conexion a base de datos exitosa"
```

### 4. Login

- Abre: http://localhost:3000
- Usa un usuario de la base de datos
- Si puedes hacer login, ¡todo funciona!

---

## 🚨 PROBLEMAS COMUNES

### Error: "no fue posible connectarse a la base de datos"

**Solución:**
1. Verifica que Docker está corriendo: `docker ps`
2. Verifica el archivo `config.env` tenga `DB_Host="localhost"`
3. Prueba la conexión en DBeaver primero

### Error: "Puerto 5432 ya está en uso"

**Solución:**
1. Ya tienes PostgreSQL corriendo localmente
2. Opción A: Detén tu PostgreSQL local
3. Opción B: Cambia el puerto en `docker-compose.yml`:
   ```yaml
   ports:
     - "5433:5432"  # Usar puerto 5433 en tu máquina
   ```
   Y actualiza `config.env`:
   ```
   DB_Puerto="5433"
   ```

### No puedo conectarme a la BD remota (10.2.10.26)

**Solución:**
1. Verifica que estés en la red correcta (VPN si es necesario)
2. Ping al servidor: `ping 10.2.10.26`
3. Verifica credenciales en DBeaver

### Los correos no se envían

**Solución:**
- En desarrollo, usa Mailtrap.io (ver sección 7)
- NO uses credenciales de producción en desarrollo

---

## 📞 INFORMACIÓN DE CONTACTO

**Base de datos remota (Producción):**
- Host: 10.2.10.26:5432
- Usuario: dev_user
- Base de datos: vega_db

**Correos (Producción):**
- Envía a: ventas1@grupoestrella.com, ventas@grupoestrella.com
- SMTP: smtp.ionos.com

---

## ✅ CHECKLIST DE CONFIGURACIÓN

Marca lo que ya completaste:

- [ ] Docker Desktop instalado y corriendo
- [ ] PostgreSQL levantado con `docker-compose up -d postgres`
- [ ] DBeaver instalado
- [ ] Conexión a BD remota configurada en DBeaver
- [ ] Conexión a BD local configurada en DBeaver
- [ ] Backup de BD remota descargado
- [ ] Backup restaurado en BD local
- [ ] `npm install` ejecutado
- [ ] Archivo `config.env` configurado para local
- [ ] Mailtrap.io configurado (o correos comentados)
- [ ] Aplicación corriendo con `npm start`
- [ ] Login funciona en http://localhost:3000

---

**¡Listo!** Si completaste todo esto, ya puedes desarrollar localmente sin afectar producción.
