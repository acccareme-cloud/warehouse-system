#!/bin/bash
cd "$(dirname "$0")"
mkdir -p "backup_1784107023377"
cp -r backend "backup_1784107023377/"
cp -r frontend "backup_1784107023377/"
pg_dump -d warehouse_db > "backup_1784107023377/database.sql"
tar -czf "backup_1784107023377.tar.gz" "backup_1784107023377"
rm -rf "backup_1784107023377"
echo "backup_1784107023377.tar.gz"
