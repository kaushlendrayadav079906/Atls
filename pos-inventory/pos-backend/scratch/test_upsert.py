import sys
import os
import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.stock_configuration_service import StockConfigurationService

def main():
    service = StockConfigurationService()
    with service._get_connection() as conn:
        with conn.cursor() as cur:
            # Check FG001 before
            cur.execute("SELECT item_code, description, stock_qty, remark FROM stock_configuration WHERE item_code = 'FG001'")
            print("Before:", cur.fetchone())

            # Test upsert on FG001 with new description and stock_qty
            data = [
                (1, 'FG001', 'Finished Good 1 (Verified)', 100.0, 99.0, 'Bajaj', 'V001', '', 100.0, 12.5, True, 'Y', 'Y', 95.0, 5.0, 'Y', 'Y', 'Y', 'Y', 'Y', 'Finished Goods', '01', True, '2024-08-12', '2026-11-14 13:00:00', '2026-11-14 13:00:00')
            ]
            query = """
            INSERT INTO stock_configuration (
                sr_no, item_code, description, qty, stock_qty, vendor_name, vendor_code,
                grpo_no, rcvd_qty, nt_weight, qc, drw_yn, v_chk, ok_qty, rej_qty,
                lm, olng, lpk, lbl, mc_or_pt, items_group_code, warehouse_code,
                is_active, entry_date, created_at, updated_at
            ) VALUES %s
            ON CONFLICT (item_code) DO UPDATE
            SET stock_qty = EXCLUDED.stock_qty,
                is_active = EXCLUDED.is_active,
                description = EXCLUDED.description,
                entry_date = COALESCE(EXCLUDED.entry_date, stock_configuration.entry_date),
                updated_at = EXCLUDED.updated_at;
            """
            psycopg2.extras.execute_values(cur, query, data)
            conn.commit()

            # Check FG001 after
            cur.execute("SELECT item_code, description, stock_qty, remark FROM stock_configuration WHERE item_code = 'FG001'")
            print("After:", cur.fetchone())

if __name__ == "__main__":
    main()

