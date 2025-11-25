@echo off
REM ====================================================================
REM Script para hacer BACKUP de la base de datos REMOTA (10.2.10.26)
REM Requiere tener PostgreSQL instalado localmente o usar Docker
REM ====================================================================

echo ============================================
echo BACKUP DE BASE DE DATOS REMOTA
echo ============================================
echo.

REM Crear carpeta backups si no existe
if not exist "backups" mkdir backups

REM Nombre del archivo con fecha y hora
set FECHA=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set FECHA=%FECHA: =0%
set BACKUP_FILE=backups\vega_db_backup_%FECHA%.sql

echo Conectando a servidor remoto 10.2.10.26...
echo Guardando backup en: %BACKUP_FILE%
echo.
echo IMPORTANTE: Te pedirá la contraseña: $14v4d0r4$
echo.

REM Hacer backup de la base de datos remota
pg_dump -h 10.2.10.26 -U dev_user -d vega_db -F p -f %BACKUP_FILE%

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo BACKUP COMPLETADO EXITOSAMENTE
    echo Archivo: %BACKUP_FILE%
    echo ============================================
) else (
    echo.
    echo ============================================
    echo ERROR AL CREAR BACKUP
    echo Verifica que pg_dump esté instalado
    echo ============================================
)

pause
