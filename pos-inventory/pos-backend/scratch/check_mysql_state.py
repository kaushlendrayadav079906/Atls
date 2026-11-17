import sys, os
backend_dir = r"c:\Users\A\Documents\IB\Dashboard\atl2\Atls\pos-inventory\pos-backend"
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)
from app.db.connection import get_db_connection, get_db_cursor

with get_db_connection() as conn:
    with get_db_cursor(conn, dict_cursor=True) as cur:
        cur.execute("SELECT item_code, description, qty, stock_qty, vendor_name, grpo_no, rcvd_qty, nt_weight, qc, drw_yn, v_chk, ok_qty, rej_qty, lm, olng, lpk, lbl, mc_or_pt, remark, updated_at FROM stock_configuration WHERE item_code IN ('CS0227', 'CS1124', 'FG2145')")
        rows = cur.fetchall()
        for r in rows:
            print(r)
