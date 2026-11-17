import sys, os
backend_dir = r"c:\Users\A\Documents\IB\Dashboard\atl2\Atls\pos-inventory\pos-backend"
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)
from app.services.stock_configuration_service import stock_configuration_service
from app.db.connection import get_db_connection, get_db_cursor

print("Refreshing live stock from SAP for CS0227, CS1124, FG2145...", flush=True)
res = stock_configuration_service.refresh_live_stock_from_sap(item_codes=["CS0227", "CS1124", "FG2145"])
print("Refresh result:", res, flush=True)

with get_db_connection() as conn:
    with get_db_cursor(conn, dict_cursor=True) as cur:
        cur.execute("SELECT item_code, description, qty, stock_qty, vendor_name, grpo_no, rcvd_qty, nt_weight, qc, drw_yn, remark, updated_at FROM stock_configuration WHERE item_code IN ('CS0227', 'CS1124', 'FG2145')")
        for r in cur.fetchall():
            print(r, flush=True)
