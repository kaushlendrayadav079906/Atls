import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from app.services.user_service import get_all_users

print(get_all_users())
