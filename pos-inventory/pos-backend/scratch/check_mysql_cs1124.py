import json
from app.db.connection import get_db_connection, get_db_cursor

with get_db_connection() as conn:
    with get_db_cursor(conn, dict_cursor=True) as cur:
        cur.execute("SELECT * FROM stock_configuration WHERE item_code = 'CS1124';")
        row = cur.fetchone()
        print("=== MYSQL STATE FOR CS1124 ===")
        print(json.dumps(row, indent=2, default=str))
