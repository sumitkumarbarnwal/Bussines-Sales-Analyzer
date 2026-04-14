@echo off
REM Docker management script for Sales & Business Analyzer (Windows)

if "%1"=="up" (
    echo Starting application...
    docker-compose up -d
    echo Application started at http://localhost:5000
    goto :eof
)

if "%1"=="down" (
    echo Stopping application...
    docker-compose down
    echo Application stopped
    goto :eof
)

if "%1"=="logs" (
    docker-compose logs -f sales-analyzer
    goto :eof
)

if "%1"=="restart" (
    echo Restarting application...
    docker-compose restart
    echo Application restarted
    goto :eof
)

if "%1"=="build" (
    echo Building image...
    docker-compose build
    echo Build complete
    goto :eof
)

if "%1"=="prod-up" (
    echo Starting production application...
    docker-compose -f docker-compose.prod.yml up -d
    echo Production application started
    goto :eof
)

if "%1"=="prod-down" (
    echo Stopping production application...
    docker-compose -f docker-compose.prod.yml down
    echo Production application stopped
    goto :eof
)

if "%1"=="clean" (
    echo Cleaning up...
    docker-compose down -v
    docker system prune -f
    echo Cleanup complete
    goto :eof
)

echo Sales ^& Business Analyzer - Docker Management
echo.
echo Usage: docker.bat {up^|down^|logs^|restart^|build^|prod-up^|prod-down^|clean}
echo.
echo Commands:
echo   up        - Start development environment
echo   down      - Stop development environment
echo   logs      - View application logs
echo   restart   - Restart application
echo   build     - Build Docker image
echo   prod-up   - Start production environment
echo   prod-down - Stop production environment
echo   clean     - Remove containers and volumes
