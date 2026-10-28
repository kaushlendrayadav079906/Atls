"""
Quick utility to inspect existing users and reset/sync the admin password from .env
"""
import sys
import os

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.core.config import settings
from app.core.security import get_password_hash
from app.services.user_service import _get_connection, init_user_storage

def main():
    print("=" * 60)
    print("POS Database User Inspector & Admin Password Reset")
    print("=" * 60)
    print(f"DATABASE_URL: {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else settings.DATABASE_URL}")
    print(f"Configured in .env -> ADMIN_EMAIL: '{settings.ADMIN_EMAIL}', ADMIN_USERNAME: '{settings.ADMIN_USERNAME}'")
    
    init_user_storage()

    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, username, email, role, is_active FROM users ORDER BY created_at ASC")
            users = cur.fetchall()
            
            print(f"\nCurrent users in database ({len(users)} found):")
            for u in users:
                print(f"  - Username: {u[1]:<15} | Email: {u[2]:<25} | Role: {u[3]:<10} | Active: {u[4]}")
                
            admin_user = settings.ADMIN_USERNAME or "admin"
            admin_email = settings.ADMIN_EMAIL or "admin123@gmail.com"
            admin_pass = settings.ADMIN_PASSWORD or "Admin@123"
            
            # Check if admin user exists
            cur.execute("SELECT id, username, email FROM users WHERE LOWER(username) = LOWER(%s) OR LOWER(email) = LOWER(%s)", (admin_user, admin_email))
            found = cur.fetchone()
            
            new_hash = get_password_hash(admin_pass)
            
            if found:
                user_id, username, email = found
                print(f"\nUpdating existing account '{username}' (id: {user_id})...")
                cur.execute(
                    """
                    UPDATE users 
                    SET password_hash = %s, role = 'admin', is_active = TRUE, email = %s, username = %s, token_version = token_version + 1
                    WHERE id = %s
                    """,
                    (new_hash, admin_email, admin_user, user_id)
                )
                print(f"--> [SUCCESS] Updated user '{admin_user}' with password from .env ('{admin_pass}') and email '{admin_email}'.")
            else:
                import uuid
                from datetime import datetime
                new_id = str(uuid.uuid4())
                print(f"\nCreating new admin account '{admin_user}'...")
                cur.execute(
                    """
                    INSERT INTO users (
                        id, username, email, name, password_hash, role,
                        sap_user_code, branch_id, store_name, created_at, is_active, token_version,
                        job_role
                    ) VALUES (%s, %s, %s, %s, %s, 'admin', NULL, NULL, 'Headquarters', %s, TRUE, 1, 'System Administrator')
                    """,
                    (new_id, admin_user, admin_email, "System Administrator", new_hash, datetime.utcnow())
                )
                print(f"--> [SUCCESS] Created admin user '{admin_user}' with password from .env ('{admin_pass}') and email '{admin_email}'.")

    print("\nYou can now log in with:")
    print(f"  Identifier: {admin_user}  (or {admin_email})")
    print(f"  Password:   {admin_pass}")
    print("=" * 60)

if __name__ == "__main__":
    main()
