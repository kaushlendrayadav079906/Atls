import os

file_path = "app/services/sap/production_service.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add _fetch_all method if not exists
if "def _fetch_all(" not in content:
    fetch_all_code = """
    def _fetch_all(self, endpoint: str, max_records: int = 5000) -> list:
        \"\"\"Fetches all pages from SAP Service Layer up to max_records limit.\"\"\"
        results = []
        next_link = endpoint
        
        while next_link and len(results) < max_records:
            # Service layer nextLink might be relative or include /b1s/v1/
            if next_link.startswith('/b1s/v1/'):
                next_link = next_link[8:]
            
            response = self.client.get(next_link)
            chunk = response.get("value", [])
            if not chunk:
                break
                
            results.extend(chunk)
            
            # Check for next page
            next_link = response.get("odata.nextLink")
            
            # If we hit max_records, we stop
            if len(results) >= max_records:
                logger.warning(f"Hit max_records limit ({max_records}) fetching {endpoint}")
                break
                
        return results
"""
    
    # insert before get_production_summary
    content = content.replace("    def get_production_summary(", fetch_all_code + "\n    def get_production_summary(")

# Now replace response = self.client.get(f"/ProductionOrders?{query}")
# with orders = self._fetch_all(f"/ProductionOrders?{query}")
# for the aggregate endpoints

for method_query in [
    ("endpoint = f\"/ProductionOrders?{query}\"\n        response = self.client.get(endpoint)\n        \n        orders = response.get(\"value\", [])",
     "endpoint = f\"/ProductionOrders?{query}\"\n        orders = self._fetch_all(endpoint)"),
    ("response = self.client.get(f\"/ProductionOrders?{query}\")\n        orders = response.get(\"value\", [])",
     "orders = self._fetch_all(f\"/ProductionOrders?{query}\")")
]:
    content = content.replace(method_query[0], method_query[1])

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated SAPProductionService with _fetch_all")
