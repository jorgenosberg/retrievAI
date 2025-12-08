#!/bin/bash

# RetrievAI Test Environment Management Script
# Manages the isolated test environment for end-to-end testing

set -e

COMPOSE_FILE="docker-compose.test.yml"
PROJECT_NAME="retrievai-test"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if .env file exists
check_env_file() {
    if [ ! -f .env.test ]; then
        print_warning ".env.test not found. Using default test configuration."
        print_warning "Make sure to set your OPENAI_API_KEY if needed."
    fi
}

# Start the test environment
start_env() {
    print_header "Starting Test Environment"
    check_env_file

    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d

    print_success "Test environment started"
    echo ""
    echo "Services available at:"
    echo "  Frontend:  http://localhost:3001"
    echo "  Backend:   http://localhost:8080"
    echo "  Postgres:  localhost:5433"
    echo "  Redis:     localhost:6380"
    echo "  ChromaDB:  http://localhost:8002"
}

# Stop the test environment
stop_env() {
    print_header "Stopping Test Environment"

    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down

    print_success "Test environment stopped"
}

# Restart the test environment
restart_env() {
    print_header "Restarting Test Environment"

    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" restart

    print_success "Test environment restarted"
}

# Reset the test environment (clean slate)
reset_env() {
    print_header "Resetting Test Environment"

    read -p "This will delete all test data. Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down -v
        print_success "Test environment reset (all data deleted)"
    else
        print_warning "Reset cancelled"
    fi
}

# Show logs
show_logs() {
    SERVICE=${1:-}

    if [ -z "$SERVICE" ]; then
        docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs -f
    else
        docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs -f "$SERVICE"
    fi
}

# Show status
show_status() {
    print_header "Test Environment Status"

    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps
}

# Run database migrations
run_migrations() {
    print_header "Running Database Migrations"

    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec backend-test \
        uv run alembic upgrade head

    print_success "Migrations completed"
}

# Open a shell in the backend container
shell_backend() {
    print_header "Opening Backend Shell"

    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec backend-test bash
}

# Connect to the test database
db_shell() {
    print_header "Opening Database Shell"

    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec postgres-test \
        psql -U retrievai_test -d retrievai_test
}

# Build and start fresh
build_env() {
    print_header "Building Test Environment"

    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" build --no-cache

    print_success "Build completed"
}

# Seed test data
seed_data() {
    print_header "Seeding Test Data"

    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec backend-test \
        uv run --no-dev python -B scripts/seed_test_data.py

    print_success "Test data seeded"
}

# Clear test data
clear_data() {
    print_header "Clearing Test Data"

    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec backend-test \
        uv run --no-dev python scripts/seed_test_data.py --clear

    print_success "Test data cleared"
}

# Show help
show_help() {
    cat << EOF
RetrievAI Test Environment Management

Usage: $0 [COMMAND]

Commands:
    start           Start the test environment
    stop            Stop the test environment
    restart         Restart the test environment
    reset           Reset the test environment (deletes all data)
    logs [service]  Show logs (optionally for specific service)
    status          Show status of all services
    migrate         Run database migrations
    seed            Seed test database with test users
    clear           Clear test users from database
    shell           Open a shell in the backend container
    db              Open a PostgreSQL shell in the test database
    build           Rebuild all containers
    help            Show this help message

Services:
    backend-test    Backend API server
    worker-test     Background worker
    frontend-test   Frontend application
    postgres-test   PostgreSQL database
    redis-test      Redis cache
    chromadb-test   ChromaDB vector database

Examples:
    $0 start                 # Start all services
    $0 logs backend-test     # View backend logs
    $0 reset                 # Clean slate - delete all test data
    $0 migrate               # Run database migrations
    $0 seed                  # Create test users (test@example.com / admin@example.com)

EOF
}

# Main command dispatcher
case "${1:-}" in
    start)
        start_env
        ;;
    stop)
        stop_env
        ;;
    restart)
        restart_env
        ;;
    reset)
        reset_env
        ;;
    logs)
        show_logs "${2:-}"
        ;;
    status)
        show_status
        ;;
    migrate)
        run_migrations
        ;;
    seed)
        seed_data
        ;;
    clear)
        clear_data
        ;;
    shell)
        shell_backend
        ;;
    db)
        db_shell
        ;;
    build)
        build_env
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: ${1:-}"
        echo ""
        show_help
        exit 1
        ;;
esac
