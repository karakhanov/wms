-- Запустить от суперпользователя (postgres) в любой БД, например: psql -U postgres -f postgres-setup.sql
-- Или выполнить по шагам вручную.

-- 1. Создать пользователя и БД
CREATE USER wms WITH PASSWORD 'wms';
CREATE DATABASE wms OWNER wms;

-- 2. Подключиться к БД wms и выдать права на схему public (обязательно для PostgreSQL 15+)
\c wms

GRANT ALL ON SCHEMA public TO wms;
GRANT CREATE ON SCHEMA public TO wms;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO wms;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO wms;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO wms;

-- Для объектов, которые будут созданы позже (Django создаёт таблицы от имени wms):
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO wms;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO wms;
