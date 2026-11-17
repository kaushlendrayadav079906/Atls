import sys, os
from dotenv import load_dotenv
load_dotenv(os.path.abspath("pos-inventory/pos-backend/.env"))
sys.path.insert(0, os.path.abspath("pos-inventory/pos-backend"))

from app.db.connection import get_db_connection, get_db_cursor

with get_db_connection() as conn:
    with get_db_cursor(conn, dict_cursor=True) as cur:
        cur.execute("SELECT item_code, qty, so_qty, so_no, po_no, grpo_no, nt_weight, qc, drw_yn, v_chk, lm, olng, lpk, lbl, mc_or_pt, remark, updated_at, last_submitted_at FROM stock_configuration WHERE item_code = 'CS1124';")
        row = cur.fetchone()
        print("PG ROW:")
        for k, v in (row or {}).items():
            print(f"  {k}: {repr(v)}")
