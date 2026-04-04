@echo off
ssh root@62.171.153.204 "sqlite3 /home/cloud-server/data/cloud.db \"SELECT id, name, stream_url FROM channels WHERE id = '2a3e5650-c46f-4afd-88bb-8b33715916f5';\" && echo --- && sqlite3 /home/cloud-server/data/cloud.db \"SELECT stream_url FROM channels LIMIT 3;\""
