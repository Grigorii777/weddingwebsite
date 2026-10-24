compose := "docker compose --env-file docker/.env -f docker/docker-compose.dev.yml"

# Показать доступные команды.
default:
    @just --list

# Собрать и запустить сайт и PostgreSQL в фоне.
up:
    {{ compose }} up -d --build

# Остановить и удалить контейнеры, сохранив тома с данными.
down:
    {{ compose }} down
