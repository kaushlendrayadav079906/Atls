import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.stock_configuration_service import StockConfigurationService

def main():
    service = StockConfigurationService()
    with service._get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT item_code, description, created_at, updated_at FROM stock_configuration WHERE item_code ILIKE '%AMIT%';")
            rows = cur.fetchall()
            print("Items with 'AMIT' in code:", rows)

            cur.execute("SELECT item_code, description, created_at, updated_at FROM stock_configuration WHERE description ILIKE '%AMIT%';")
            rows2 = cur.fetchall()
            print("Items with 'AMIT' in description:", rows2)

            cur.execute("SELECT item_code, created_at, updated_at FROM stock_configuration ORDER BY created_at DESC LIMIT 5;")
            print("Latest created rows in stock_configuration:", cur.fetchall())

            cur.execute("SELECT item_code, created_at, updated_at FROM stock_configuration ORDER BY updated_at DESC LIMIT 5;")
            print("Latest updated rows in stock_configuration:", cur.fetchall())

if __name__ == "__main__":
    main()

