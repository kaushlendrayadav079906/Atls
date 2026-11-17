import sys, os
backend_dir = r"c:\Users\A\Documents\IB\Dashboard\atl2\Atls\pos-inventory\pos-backend"
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)

from app.services.stock_configuration_service import stock_configuration_service
from app.db.connection import get_db_connection, get_db_cursor
from app.services.sap.client import get_sap_client

print("--- Running refresh_live_stock_from_sap for CS1124 ---", flush=True)
res = stock_configuration_service.refresh_live_stock_from_sap(item_codes=["CS1124"])
print("Refresh result:", res, flush=True)

with get_db_connection() as conn:
    with get_db_cursor(conn, dict_cursor=True) as cur:
        cur.execute("SELECT item_code, nt_weight, qc, drw_yn, v_chk, lm, olng, lpk, lbl, mc_or_pt, remark, last_submitted_at, updated_at FROM stock_configuration WHERE item_code = 'CS1124'")
        row = cur.fetchone()
        print("CS1124 DB row after sync:", dict(row), flush=True)

print("--- Reading directly from SAP Service Layer for CS1124 ---", flush=True)
client = get_sap_client()
client.login()
s_item = client.get("Items('CS1124')?$select=ItemCode,InventoryWeight,User_Text,U_Drawing,U_QC,U_V_Chk,U_LM,U_OLNG,U_LPK,U_LBL,U_MC_OR_PT,UpdateDate,UpdateTime")
print("CS1124 in SAP:", s_item, flush=True)
