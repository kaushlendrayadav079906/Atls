import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.stock_configuration_service import StockConfigurationService
s = StockConfigurationService()
with s._get_connection() as conn:
    with conn.cursor() as cur:
        cur.execute("UPDATE stock_configuration SET description = 'Finished Good 1', stock_qty = 95.0 WHERE item_code = 'FG001'")
print("Reset FG001 successfully")

