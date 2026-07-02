import sqlite3, os 
path=r\" "c:\\Users\\aj\\Desktop\\interview\\automated-interview\\data\\interview.db\ ; echo print('EXISTS', os.path.exists(path)) ; echo conn=sqlite3.connect(path) ; echo cur=conn.cursor() ; echo cur.execute('SELECT id,email,role,password FROM candidates;') ; echo print(cur.fetchall()) ; echo conn.close() ; python dbcheck.py ; del dbcheck.py
