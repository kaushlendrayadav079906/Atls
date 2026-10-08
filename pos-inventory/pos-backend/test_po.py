from app.services.sap.client import get_sap_client
import json

client = get_sap_client()
try:
    client.login()
    # Try fetching a single ProductionOrder to see metadata
    res = client.client.get(
        client.base_url + '/ProductionOrders?$top=1',
        cookies={'B1SESSION': client.session_id, 'ROUTEID': getattr(client, 'route_id', '')}
    )
    data = res.json()
    print("STATUS CODE:", res.status_code)
    if "value" in data and len(data["value"]) > 0:
        po = data["value"][0]
        print("ProductionOrder fields:")
        for k, v in po.items():
            print(f"  {k}: {type(v).__name__}")
        
        if "ProductionOrderLines" in po and len(po["ProductionOrderLines"]) > 0:
            print("\nProductionOrderLines fields:")
            for k, v in po["ProductionOrderLines"][0].items():
                print(f"  {k}: {type(v).__name__}")
        
        if "ProductionOrderStages" in po and len(po["ProductionOrderStages"]) > 0:
            print("\nProductionOrderStages fields:")
            for k, v in po["ProductionOrderStages"][0].items():
                print(f"  {k}: {type(v).__name__}")
    else:
        print("Empty response or error:")
        print(json.dumps(data, indent=2)[:1000])
except Exception as e:
    print('Failed:', e)
