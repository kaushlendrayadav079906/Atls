import sys
import json
import xml.etree.ElementTree as ET

from app.services.sap.client import get_sap_client

def fetch_metadata():
    client = get_sap_client()
    try:
        # get metadata (binary returns xml)
        content, ctype = client.get_binary("$metadata")
        with open("metadata.xml", "wb") as f:
            f.write(content)
        
        # Test connection by getting Warehouses
        warehouses = client.get("Warehouses", {"$top": 5})
        with open("warehouses.json", "w") as f:
            json.dump(warehouses, f, indent=2)
            
        print("Successfully fetched metadata and warehouses")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fetch_metadata()
