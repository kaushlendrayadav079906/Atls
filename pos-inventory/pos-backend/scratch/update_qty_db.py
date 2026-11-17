import os, sys
from dotenv import load_dotenv
load_dotenv(os.path.abspath("pos-inventory/pos-backend/.env"))
sys.path.insert(0, os.path.abspath("pos-inventory/pos-backend"))
from app.db.connection import get_db_connection, get_db_cursor
with get_db_connection() as conn:
    with get_db_cursor(conn) as cur:
        cur.execute("UPDATE stock_configuration SET qty = COALESCE(so_qty, 0.0) WHERE so_no IS NOT NULL AND so_no != '';")
        conn.commit()
print("Updated QTY in DB successfully")
