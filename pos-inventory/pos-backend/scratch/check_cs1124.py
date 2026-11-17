import sys, os
from dotenv import load_dotenv
load_dotenv(os.path.abspath('pos-inventory/pos-backend/.env'))
sys.path.insert(0, os.path.abspath('pos-inventory/pos-backend'))
from app.services.stock_configuration_service import StockConfigurationService
from app.db.connection import get_db_cursor

service = StockConfigurationService()
with service._get_connection() as conn:
    with get_db_cursor(conn, dict_cursor=True) as cur:
        cur.execute("SELECT item_code, description, qty, stock_qty, vendor_name, grpo_no, rcvd_qty, nt_weight, so_no, so_qty, po_no, po_qty FROM stock_configuration WHERE item_code = 'CS1124';")
        row = cur.fetchone()
        print("DB Row for CS1124:", row)

fb_items = service._read_from_fallback()
for it in fb_items:
    if it.get("item_code") == "CS1124":
        print("Fallback for CS1124:")
        for k in ["item_code", "description", "qty", "stock_qty", "vendor_name", "grpo_no", "rcvd_qty", "nt_weight", "so_no", "so_qty", "po_no", "po_qty"]:
            print(f"  {k}: {it.get(k)}")
