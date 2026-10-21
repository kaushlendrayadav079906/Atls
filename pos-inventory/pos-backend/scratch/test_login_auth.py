import sys
sys.path.insert(0, '.')
from app.services.user_service import _get_connection, authenticate_user

with _get_connection() as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT username, email, role, is_active FROM users")
        users = cur.fetchall()
        print("Total users:", len(users))
        for u in users:
            print("User:", u)

print("\nTesting authenticate_user('admin', 'Admin@123'):")
try:
    auth = authenticate_user('admin', 'Admin@123')
    print("Result:", auth)
except Exception as e:
    print("Exception:", e)
