import sys
import os
sys.path.insert(0, os.path.abspath("."))
from app.services.stock_configuration_service import StockConfigurationService

svc = StockConfigurationService()
item = svc.get_item("CS1124")
print("CS1124 in DB/Fallback:")
for k, v in (item or {}).items():
    print(f"  {k}: {v}")
