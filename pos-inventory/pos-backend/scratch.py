from dotenv import load_dotenv; load_dotenv(); import sys; from app.services.sap.items_service import SAPItemsService; s = SAPItemsService(); print(s.get_items(top=10))
