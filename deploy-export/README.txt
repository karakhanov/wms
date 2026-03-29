Содержимое для переноса на сервер
--------------------------------
database.dump  — PostgreSQL, формат custom (pg_restore)
media.zip      — файлы из backend/media

На сервере (пример):
  export POSTGRES_HOST=... POSTGRES_USER=... POSTGRES_DB=... POSTGRES_PASSWORD=...
  pg_restore -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB --no-owner -v deploy-export/database.dump
  unzip -o deploy-export/media.zip -d backend/media

В репозитории лежат реальные данные. Не используйте в публичном GitHub. После переноса можно удалить файлы из ветки и закоммитить — но они останутся в истории коммитов.
