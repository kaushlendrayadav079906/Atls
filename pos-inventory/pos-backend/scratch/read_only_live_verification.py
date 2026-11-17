import json
import urllib.parse
from app.services.sap.client import get_sap_client
from app.db.connection import get_db_connection, get_db_cursor
from app.services.stock_configuration_service import stock_configuration_service

def verify_live():
    item_code = "CS1124"
    
    # 1. Direct SAP B1 Service Layer GET
    sap_client = get_sap_client()
    sap_client.login()
    
    select_fields = [
        "ItemCode", "ItemName", "InventoryWeight", "PurchaseUnitWeight",
        "SalesUnitWeight", "U_PerPices", "U_Drawing", "User_Text",
        "U_QC", "U_V_Chk", "U_LM", "U_OLNG", "U_LPK", "U_LBL",
        "U_MC_OR_PT", "UpdateDate", "UpdateTime"
    ]
    endpoint = f"Items('{item_code}')?$select={','.join(select_fields)}"
    sap_item = sap_client.get(endpoint)
    
    # 2. Local MySQL stock_configuration SELECT
    with get_db_connection() as conn:
        with get_db_cursor(conn, dict_cursor=True) as cur:
            cur.execute("SELECT * FROM stock_configuration WHERE item_code = %s;", (item_code,))
            mysql_row = cur.fetchone()
            
    # 3. Backend GET API response (what frontend receives)
    api_res = stock_configuration_service.get_items(search=item_code, page=1, page_size=10)
    matching_frontend_item = None
    if api_res and "items" in api_res:
        for it in api_res["items"]:
            if it.get("item_code") == item_code:
                matching_frontend_item = it
                break

    report = {
        "sap_service_layer_url": f"{sap_client.base_url}/{endpoint}",
        "sap_raw_item": {k: sap_item.get(k) for k in select_fields},
        "mysql_raw_row": {
            "item_code": mysql_row.get("item_code"),
            "description": mysql_row.get("description"),
            "nt_weight": float(mysql_row.get("nt_weight")) if mysql_row.get("nt_weight") is not None else None,
            "qc": mysql_row.get("qc"),
            "drw_yn": mysql_row.get("drw_yn"),
            "v_chk": mysql_row.get("v_chk"),
            "lm": mysql_row.get("lm"),
            "olng": mysql_row.get("olng"),
            "lpk": mysql_row.get("lpk"),
            "lbl": mysql_row.get("lbl"),
            "mc_or_pt": mysql_row.get("mc_or_pt"),
            "remark": mysql_row.get("remark"),
            "entry_date": str(mysql_row.get("entry_date")),
            "last_submitted_at": str(mysql_row.get("last_submitted_at")),
            "updated_at": str(mysql_row.get("updated_at")),
        },
        "frontend_api_item": matching_frontend_item
    }
    
    print("=== LIVE VERIFICATION REPORT DATA ===")
    print(json.dumps(report, indent=2, default=str))

if __name__ == "__main__":
    verify_live()
