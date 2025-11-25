@echo off
REM ====================================================================
REM Script para RESTAURAR un backup en la base de datos LOCAL (Docker)
REM Ejecuta esto DESPUÉS de hacer el backup con backup-remoto.bat
REM ====================================================================

echo ============================================
echo RESTAURAR BACKUP EN BASE DE DATOS LOCAL
echo ============================================
echo.

REM Listar archivos de backup disponibles
echo Archivos de backup disponibles:
echo.
dir /B backups\*.sql
echo.

REM Solicitar nombre del archivo
set /p BACKUP_FILE="Ingresa el nombre del archivo (ej: vega_db_backup_20250124_143022.sql): "

if not exist "backups\%BACKUP_FILE%" (
    echo ERROR: El archivo no existe
    pause
    exit /b
)

echo.
echo Restaurando backup en base de datos local...
echo Container: orden-servicio-db
echo Database: vega_db
echo.

REM Restaurar en el contenedor Docker
docker exec -i orden-servicio-db psql -U dev_user -d vega_db < backups\%BACKUP_FILE%

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo RESTAURACIÓN COMPLETADA EXITOSAMENTE
    echo ============================================
) else (
    echo.
    echo ============================================
    echo ERROR AL RESTAURAR
    echo Verifica que Docker esté corriendo
    echo ============================================
)

pause
