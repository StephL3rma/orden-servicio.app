# 🔌 GUÍA RÁPIDA: Conectar DBeaver

Esta es una guía paso a paso con imágenes para conectar DBeaver a las bases de datos.

---

## 📥 INSTALAR DBEAVER

1. Descarga DBeaver Community: https://dbeaver.io/download/
2. Instala normalmente
3. Abre DBeaver

---

## 🔵 CONECTAR A BASE DE DATOS REMOTA (Producción)

### Paso 1: Nueva Conexión
1. Click en el ícono de **enchufe** (arriba a la izquierda)
2. O click en **Database → New Database Connection**

### Paso 2: Seleccionar PostgreSQL
1. Busca y selecciona **PostgreSQL**
2. Click **Next**

### Paso 3: Configurar Conexión
Completa los siguientes datos:

```
┌─────────────────────────────────────┐
│ Connection Settings                 │
├─────────────────────────────────────┤
│ Host:     10.2.10.26                │
│ Port:     5432                      │
│ Database: vega_db                   │
│ Username: dev_user                  │
│ Password: $14v4d0r4$                │
│                                     │
│ [✓] Show all databases              │
│ [✓] Save password                   │
└─────────────────────────────────────┘
```

### Paso 4: Test Connection
1. Click en **"Test Connection..."**
2. Si es la primera vez, descargará drivers (espera)
3. Deberías ver: **"Connected"**

### Paso 5: Finalizar
1. Click **Finish**
2. Dale un nombre descriptivo: `vega_db (PRODUCCIÓN)`

---

## 🟢 CONECTAR A BASE DE DATOS LOCAL (Desarrollo)

### Paso 1: Nueva Conexión
1. Click en el ícono de **enchufe** nuevamente

### Paso 2: Seleccionar PostgreSQL
1. Selecciona **PostgreSQL**
2. Click **Next**

### Paso 3: Configurar Conexión

```
┌─────────────────────────────────────┐
│ Connection Settings                 │
├─────────────────────────────────────┤
│ Host:     localhost                 │
│ Port:     5432                      │
│ Database: vega_db                   │
│ Username: dev_user                  │
│ Password: dev_password_local        │
│                                     │
│ [✓] Show all databases              │
│ [✓] Save password                   │
└─────────────────────────────────────┘
```

### Paso 4: Test Connection
1. Click en **"Test Connection..."**
2. Si Docker está corriendo, deberías ver: **"Connected"**

### Paso 5: Finalizar
1. Click **Finish**
2. Dale un nombre descriptivo: `vega_db (LOCAL)`

---

## 📊 EXPLORAR LA BASE DE DATOS

Una vez conectado, en el panel izquierdo:

```
📁 vega_db (PRODUCCIÓN)
  └─ 📁 Databases
      └─ 📁 vega_db
          └─ 📁 Schemas
              └─ 📁 public
                  └─ 📁 Tables ← AQUÍ ESTÁN LAS TABLAS
                      ├─ usuarios
                      ├─ clientes
                      ├─ ordenes_servicio
                      ├─ cliente_direccion
                      ├─ piezas_danadas
                      └─ ...
```

### Ver datos de una tabla:
1. Navega hasta `Tables`
2. Click derecho en una tabla (ej: `clientes`)
3. **View Data → All Rows**

---

## 🔄 HACER BACKUP DESDE DBEAVER

### Opción 1: Backup completo de la base de datos

1. Click derecho en **vega_db (PRODUCCIÓN)**
2. **Tools → Backup Database...**
3. Configurar:
   ```
   Format: SQL (plain text)
   Output: backups/backup_manual_YYYYMMDD.sql
   ```
4. Click **Start**

### Opción 2: Exportar una tabla específica

1. Click derecho en la tabla
2. **Export Data...**
3. Selecciona formato: SQL, CSV, etc.
4. Click **Next** y **Start**

---

## 📥 RESTAURAR BACKUP DESDE DBEAVER

1. Click derecho en **vega_db (LOCAL)**
2. **Tools → Restore Database...**
3. Selecciona el archivo `.sql` de backup
4. Click **Start**

---

## 🔍 EJECUTAR QUERIES SQL

### Ver todas las órdenes:
1. Click derecho en la conexión
2. **SQL Editor → New SQL Script**
3. Escribe:
   ```sql
   SELECT * FROM ordenes_servicio;
   ```
4. Click en **▶ Execute** (o `Ctrl+Enter`)

### Ver órdenes con clientes:
```sql
SELECT
    s.id AS folio,
    c.nombre AS cliente,
    s.estado,
    s.create_at AS fecha_creacion,
    s.fecha_servicio AS fecha_cierre
FROM ordenes_servicio s
INNER JOIN clientes c ON c.id = s.id_cliente
ORDER BY s.id DESC;
```

### Ver usuarios del sistema:
```sql
SELECT
    username,
    firstname,
    lastname,
    email,
    role,
    createat
FROM usuarios;
```

---

## ⚠️ PROBLEMAS COMUNES

### ❌ "Cannot connect to localhost:5432"

**Causa:** Docker no está corriendo

**Solución:**
```bash
docker-compose up -d postgres
```

---

### ❌ "Authentication failed for user dev_user"

**Causa:** Contraseña incorrecta

**Solución BD Remota:**
- Usa contraseña: `$14v4d0r4$`

**Solución BD Local:**
- Usa contraseña: `dev_password_local`

---

### ❌ "Connection refused"

**Causa:** El servidor PostgreSQL no está corriendo o firewall bloquea

**Solución BD Remota:**
- Verifica que estés en la red correcta
- Intenta: `ping 10.2.10.26`

**Solución BD Local:**
- Verifica Docker: `docker ps`
- Deberías ver: `orden-servicio-db`

---

### ❌ "Driver download failed"

**Causa:** Primera conexión necesita descargar drivers

**Solución:**
1. Espera a que termine
2. Si falla, descarga manualmente:
   - **Tools → Driver Manager**
   - Busca PostgreSQL
   - Click **Download**

---

## 🎯 CHECKLIST

Marca lo completado:

- [ ] DBeaver instalado
- [ ] Conexión a BD remota configurada
- [ ] Conexión a BD remota probada (Test Connection exitoso)
- [ ] Conexión a BD local configurada
- [ ] Conexión a BD local probada
- [ ] Puedo ver las tablas en ambas conexiones
- [ ] Puedo hacer queries en SQL Editor
- [ ] Hice backup de la BD remota
- [ ] Restauré backup en BD local

---

## 💡 TIPS ÚTILES

### Renombrar conexión
- Click derecho en la conexión → **Edit Connection**
- Cambia el nombre en el campo superior

### Color para diferenciar producción/desarrollo
- Click derecho en la conexión → **Edit Connection**
- Tab **General**
- En **Connection color**, elige:
  - 🔴 Rojo para PRODUCCIÓN
  - 🟢 Verde para LOCAL

### Atajos de teclado
- `Ctrl + Enter`: Ejecutar query
- `Ctrl + Shift + C`: Comentar línea SQL
- `F5`: Refrescar tablas

---

**¡Listo!** Ya puedes trabajar con ambas bases de datos desde DBeaver.
