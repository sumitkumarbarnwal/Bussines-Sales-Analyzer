#!/bin/bash
# Docker management script for Sales & Business Analyzer

set -e

case "$1" in
  up)
    echo "🚀 Starting application..."
    docker-compose up -d
    echo "✅ Application started at http://localhost:5000"
    ;;
  
  down)
    echo "🛑 Stopping application..."
    docker-compose down
    echo "✅ Application stopped"
    ;;
  
  logs)
    docker-compose logs -f sales-analyzer
    ;;
  
  restart)
    echo "🔄 Restarting application..."
    docker-compose restart
    echo "✅ Application restarted"
    ;;
  
  build)
    echo "🔨 Building image..."
    docker-compose build
    echo "✅ Build complete"
    ;;
  
  prod-up)
    echo "🚀 Starting production application..."
    docker-compose -f docker-compose.prod.yml up -d
    echo "✅ Production application started"
    ;;
  
  prod-down)
    echo "🛑 Stopping production application..."
    docker-compose -f docker-compose.prod.yml down
    echo "✅ Production application stopped"
    ;;
  
  clean)
    echo "🧹 Cleaning up..."
    docker-compose down -v
    docker system prune -f
    echo "✅ Cleanup complete"
    ;;
  
  *)
    echo "Sales & Business Analyzer - Docker Management"
    echo ""
    echo "Usage: $0 {up|down|logs|restart|build|prod-up|prod-down|clean}"
    echo ""
    echo "Commands:"
    echo "  up        - Start development environment"
    echo "  down      - Stop development environment"
    echo "  logs      - View application logs"
    echo "  restart   - Restart application"
    echo "  build     - Build Docker image"
    echo "  prod-up   - Start production environment"
    echo "  prod-down - Stop production environment"
    echo "  clean     - Remove containers and volumes"
    exit 1
    ;;
esac
