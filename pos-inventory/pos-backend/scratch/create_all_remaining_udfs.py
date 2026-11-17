import sys, os, time
backend_dir = r"c:\Users\A\Documents\IB\Dashboard\atl2\Atls\pos-inventory\pos-backend"
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)
from app.services.sap.client import get_sap_client

client = get_sap_client()
client.login()

udfs_to_create = [
    {
        "TableName": "OITM",
        "Name": "V_Chk",
        "Description": "Visual Check",
        "Type": "db_Alpha",
        "Size": 1,
        "ValidValuesMD": [
            {"Value": "Y", "Description": "Yes"},
            {"Value": "N", "Description": "No"}
        ],
        "DefaultValue": "N"
    },
    {
        "TableName": "OITM",
        "Name": "LM",
        "Description": "LM Inspection",
        "Type": "db_Alpha",
        "Size": 1,
        "ValidValuesMD": [
            {"Value": "Y", "Description": "Yes"},
            {"Value": "N", "Description": "No"}
        ],
        "DefaultValue": "N"
    },
    {
        "TableName": "OITM",
        "Name": "OLNG",
        "Description": "OLNG Inspection",
        "Type": "db_Alpha",
        "Size": 1,
        "ValidValuesMD": [
            {"Value": "Y", "Description": "Yes"},
            {"Value": "N", "Description": "No"}
        ],
        "DefaultValue": "N"
    },
    {
        "TableName": "OITM",
        "Name": "LPK",
        "Description": "Inner Packing Check",
        "Type": "db_Alpha",
        "Size": 1,
        "ValidValuesMD": [
            {"Value": "Y", "Description": "Yes"},
            {"Value": "N", "Description": "No"}
        ],
        "DefaultValue": "N"
    },
    {
        "TableName": "OITM",
        "Name": "LBL",
        "Description": "Label Verification",
        "Type": "db_Alpha",
        "Size": 1,
        "ValidValuesMD": [
            {"Value": "Y", "Description": "Yes"},
            {"Value": "N", "Description": "No"}
        ],
        "DefaultValue": "N"
    },
    {
        "TableName": "OITM",
        "Name": "MC_OR_PT",
        "Description": "Machine or Part Type",
        "Type": "db_Alpha",
        "Size": 1,
        "ValidValuesMD": [
            {"Value": "Y", "Description": "Yes"},
            {"Value": "N", "Description": "No"}
        ],
        "DefaultValue": "N"
    }
]

for udf in udfs_to_create:
    name = udf["Name"]
    print(f"Creating {name}...", flush=True)
    try:
        res = client.post("UserFieldsMD", data=udf)
        print(f"Created {name} successfully! FieldID: {res.get('FieldID')}", flush=True)
    except Exception as e:
        print(f"Error creating {name}: {e}", flush=True)
    time.sleep(3)

print("All UDF creation attempts completed.", flush=True)
