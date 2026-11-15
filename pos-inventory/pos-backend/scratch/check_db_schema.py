import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.stock_configuration_service import StockConfigurationService

def main():
    service = StockConfigurationService()
    with service._get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = 'stock_configuration'
                ORDER BY ordinal_position;
            """)
            print("Columns in stock_configuration:")
            for col in cur.fetchall():
                print(f"  {col[0]}: {col[1]} (nullable: {col[2]}, default: {col[3]})")

            cur.execute("SELECT COUNT(*) FROM stock_configuration;")
            cnt = cur.fetchone()[0]
            print(f"\nTotal rows in table: {cnt}")

            # Check min and max sr_no
            cur.execute("SELECT MIN(sr_no), MAX(sr_no) FROM stock_configuration;")
            min_sr, max_sr = cur.fetchone()
            print(f"sr_no range: {min_sr} to {max_sr}")

            # Check if any user remarks or custom fields exist
            cur.execute("SELECT COUNT(*) FROM stock_configuration WHERE remark <> '' AND remark IS NOT NULL;")
            remarks_cnt = cur.fetchone()[0]
            print(f"Rows with remarks: {remarks_cnt}")

            # Sample row with remark
            if remarks_cnt > 0:
                cur.execute("SELECT item_code, remark, last_submitted_at, last_submitted_by FROM stock_configuration WHERE remark <> '' AND remark IS NOT NULL LIMIT 3;")
                for r in cur.fetchall():
                    print(f"  Item with remark: {r}")

if __name__ == "__main__":
    main()

