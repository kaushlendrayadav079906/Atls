import sys, os
from dotenv import load_dotenv
load_dotenv(os.path.abspath('pos-inventory/pos-backend/.env'))
sys.path.insert(0, os.path.abspath('pos-inventory/pos-backend'))

from app.services.stock_configuration_service import StockConfigurationService

service = StockConfigurationService()
print("Starting refresh_live_stock_from_sap...")
result = service.refresh_live_stock_from_sap()
print("Sync Result:", result)

# Inspect target items
targets = ["CS0227", "CS1124", "FG2145", "BAC0005"]
for code in targets:
    item = service.get_item(code)
    print(f"\n--- Item {code} ---")
    if item:
        for k in ["item_code", "description", "qty", "stock_qty", "vendor_name", "grpo_no", "rcvd_qty", "nt_weight", "qc", "drw_yn", "v_chk", "ok_qty", "rej_qty", "lm", "olng", "lpk", "lbl", "mc_or_pt", "updated_at", "remark", "so_no", "so_qty", "po_no", "po_qty", "record_category"]:
            print(f"  {k}: {item.get(k)}")
    else:
        print("  Not found in database or fallback.")
