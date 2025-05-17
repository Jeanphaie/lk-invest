#!/bin/bash
 
PGPASSWORD="new_secure_password_2025" psql -h 163.172.32.45 -U postgres -d lki_db -c "\copy (SELECT * FROM \"Project\" WHERE id = 1) TO '/data/lki/backend/project_sample.csv' WITH CSV HEADER;" 