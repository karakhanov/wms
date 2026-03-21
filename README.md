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

Оформление UI (сейчас: **glass**, вариант D): см. `docs/FRONTEND_UI_OPTIONS.md`.

---

## Структура проекта

```
wms/
├── backend/
│   ├── config/          # Настройки Django, пагинация API
│   ├── users/           # Пользователи, роли, журнал действий
│   ├── products/        # Товары, категории, единицы измерения
│   ├── warehouse/       # Склад, зоны, стеллажи, ячейки
│   ├── construction/  # Объекты строительства
│   ├── receipts/        # Приёмка, поставщики
│   ├── orders/          # Заказы, заявки, накладные на отпуск (issue notes)
│   ├── stock/           # Остатки, минимальные уровни
│   ├── transfers/       # Перемещения
│   ├── inventory/       # Инвентаризация
│   ├── reports/         # Отчёты (движение, нехватка, популярные)
│   └── notifications/   # Уведомления
├── frontend/            # React SPA (Vite)
├── docs/                # Доп. документация (архитектура, BPMN, UI)
├── requirements.txt
└── requirements-dev.txt # pytest + pytest-django (опционально)
```

---

## Пагинация списков (API и UI)

Для сущностей с постраничным выводом в API используются параметры **`page`** и **`page_size`**.

- По умолчанию **`page_size = 10`** (см. `backend/config/pagination.py` и `REST_FRAMEWORK` в `backend/config/settings.py`).
- Максимум **`page_size = 500`** (большие выборки и экспорт в Excel/CSV на фронте).

В интерфейсе таблиц по умолчанию также показывается **10 строк**; размер страницы задаётся константой `DEFAULT_PAGE_SIZE` в `frontend/src/constants/pagination.js`.

---

## API (кратко)

- `POST /api/auth/token/` — получение JWT (username, password)
- `GET/POST /api/products/` — товары; `GET/POST/.../categories/`, `.../units/`
- `GET/POST /api/warehouse/warehouses/`, `zones/`, `racks/`, `cells/`
- `GET/POST /api/construction/objects/` — объекты строительства
- `GET/POST /api/receipts/` — приёмки
- `GET/POST/PATCH /api/orders/` — заказы; при смене статуса на «Отправлен» списание со склада
- `GET/POST/.../api/orders/issue-notes/` — накладные на отпуск материала (согласование и т.д.)
- `GET /api/stock/balances/`, `min-levels/`
- `GET/POST /api/transfers/`
- `GET/POST /api/inventory/`, `POST /api/inventory/{id}/apply/` — применить корректировку
- `GET /api/reports/movement/`, `shortage/`, `popular/`
- `GET/POST /api/auth/users/`, `roles/`, `action-log/`
- `GET/PATCH /api/notifications/` — уведомления

Все эндпоинты (кроме токена) требуют заголовок: `Authorization: Bearer <access_token>`.

---

## Тесты

### Backend (pytest)

Установка зависимостей для тестов:

```bash
pip install -r requirements-dev.txt
# или: py -m pip install -r requirements-dev.txt
```

Запуск (из каталога `backend`, используется SQLite in-memory — `config/settings_test.py`):

```bash
cd backend
py -m pytest
# или: pytest
```

Smoke-тесты: неавторизованный доступ к API, список товаров с авторизацией, отказ при неверном пароле JWT.

### Frontend (Vitest)

```bash
cd frontend
npm install
npm run test
npm run test:watch   # интерактивно
```

Пример: unit-тесты для `frontend/src/utils/listResponse.js`.

### Быстрая проверка без pytest

```bash
cd backend
python manage.py check
python manage.py makemigrations --check
python manage.py test
```

```bash
cd frontend
npm run build
```
