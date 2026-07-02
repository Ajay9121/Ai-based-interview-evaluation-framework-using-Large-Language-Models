import sqlite3

conn = sqlite3.connect('../data/interview.db')
cursor = conn.cursor()
cursor.execute("UPDATE candidates SET password = '$2a$10$v7nEMDMgVm9/02L2SGPYdeh9yXEkX1uUZQqZ8L5./nLt1M.zxDa3i' WHERE email='admin@interview.com'")
conn.commit()
conn.close()
