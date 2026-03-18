# Bashkent WMS — система учёта склада

Стек: **Python Django**, **PostgreSQL**, **React**.

Рекомендуется **Python 3.10–3.14**. Для Python 3.14 нужен Django 5.2+ (в `requirements.txt` уже указан).

Функциональные модули по спецификации:

| Модуль | Функции | Роли |
|--------|--------|------|
| Управление товарами | Карточка товара (название, SKU, штрихкод, категория, ед. изм., описание, сумма) | Администратор, Менеджер |
| Управление складом | Склад → Зона → Стеллаж → Ячейка | Администратор, Менеджер |
| Приём товара | Документ приёмки, поставщик, сканирование, размещение по ячейкам | Кладовщик, Менеджер |
| Отгрузка | Заказ, список сборки, статусы: Создан / Собирается / Отправлен | Менеджер, Кладовщик |
| Остатки | Текущие остатки, поиск по складу, мин. остаток, уведомления | Менеджер, Кладовщик |
| Перемещение | Между ячейками, автообновление остатков | Кладовщик |
| Инвентаризация | Пересчёт, сравнение с системой, акты расхождений | Кладовщик, Администратор |
| Отчёты и история | Движение, приход, отгрузка, популярные товары, недостачи | Менеджер, Администратор |
| Пользователи | Учётные записи, роли, журнал действий | Администратор, Менеджер, Кладовщик |

---

## Документация

- **[Архитектура и BPMN](docs/ARCHITECTURE_AND_BPMN.md)** — схема системы, связи модулей, BPMN-процессы (приём, отгрузка, перемещение, инвентаризация), идеи развития.
- **[BPMN-процессы (сводка)](docs/BPMN_PROCESSES.md)** — табличное описание процессов по ролям.

---

## Запуск

### 1. PostgreSQL

Создайте БД и пользователя (от суперпользователя `postgres`):

```sql
CREATE USER wms WITH PASSWORD 'wms';
CREATE DATABASE wms OWNER wms;
```

**Важно для PostgreSQL 15+:** если при миграции появляется ошибка «нет доступа к схеме public», выдайте права:

```sql
\c wms
GRANT ALL ON SCHEMA public TO wms;
GRANT CREATE ON SCHEMA public TO wms;
```

Либо выполните скрипт `backend/docs/postgres-setup.sql` от пользователя `postgres`.

Опционально задайте переменные (или оставьте значения по умолчанию):

- `POSTGRES_DB=wms`
- `POSTGRES_USER=wms`
- `POSTGRES_PASSWORD=wms`
- `POSTGRES_HOST=localhost`
- `POSTGRES_PORT=5432`

### 2. Backend (Django)

```bash
cd backend
pip install -r ../requirements.txt
# или: py -m pip install -r ../requirements.txt

# Миграции
python manage.py migrate

# Роли по умолчанию
python manage.py create_roles

# Суперпользователь (для первого входа и админки)
python manage.py createsuperuser

# Тестовые данные (опционально): товары, склад, приёмки, заказы, пользователи admin/manager/storekeeper
python manage.py load_sample_data

# Запуск сервера
python manage.py runserver
```

API: http://localhost:8000  
Админка: http://localhost:8000/admin/

### 3. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Фронтенд: http://localhost:3000 (прокси к API на :8000).

---

## Структура проекта

```
wms/
├── backend/
│   ├── config/          # Настройки Django
│   ├── users/           # Пользователи, роли, журнал
│   ├── products/        # Товары, категории
│   ├── warehouse/       # Склад, зоны, стеллажи, ячейки
│   ├── receipts/        # Приёмка, поставщики
│   ├── orders/          # Заказы (отгрузка)
│   ├── stock/           # Остатки, минимальные уровни
│   ├── transfers/       # Перемещения
│   ├── inventory/       # Инвентаризация
│   └── reports/         # Отчёты (движение, нехватка, популярные)
├── frontend/            # React SPA
└── requirements.txt
```

---

## API (кратко)

- `POST /api/auth/token/` — получение JWT (username, password)
- `GET/POST /api/products/` — товары
- `GET/POST /api/warehouse/warehouses/`, `zones/`, `racks/`, `cells/`
- `GET/POST /api/receipts/` — приёмки
- `GET/POST/PATCH /api/orders/` — заказы; при смене статуса на «Отправлен» списание со склада
- `GET /api/stock/balances/`, `min-levels/`
- `GET/POST /api/transfers/`
- `GET/POST /api/inventory/`, `POST /api/inventory/{id}/apply/` — применить корректировку
- `GET /api/reports/movement/`, `shortage/`, `popular/`
- `GET/POST /api/auth/users/`, `roles/`, `action-log/`

Все эндпоинты (кроме токена) требуют заголовок: `Authorization: Bearer <access_token>`.
