#!/usr/bin/env python
"""
Secure Administrator Bootstrap CLI for ATLAS.
Allows initializing or promoting an administrator account safely without exposing passwords in source control.
"""

import argparse
import getpass
import os
import sys

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.services import user_service


def main():
    parser = argparse.ArgumentParser(description="ATLAS Administrator Bootstrap CLI")
    parser.add_argument("--username", help="Administrator username")
    parser.add_argument("--email", help="Administrator email address")
    parser.add_argument("--password", help="Administrator password (optional, prompted securely if omitted)")
    parser.add_argument("--name", default="System Administrator", help="Full name of the administrator")
    parser.add_argument("--branch", default=None, help="Assigned SAP warehouse/branch code")
    parser.add_argument("--interactive", action="store_true", help="Prompt for all credentials interactively")

    args = parser.parse_args()

    print("========================================")
    print("ATLAS Administrator Bootstrap")
    print("========================================")

    # Initialize user storage schema if needed
    try:
        user_service.init_user_storage()
    except Exception as exc:
        print(f"Error initializing user storage: {exc}")
        sys.exit(1)

    username = args.username or getattr(settings, "ADMIN_USERNAME", "")
    email = args.email or getattr(settings, "ADMIN_EMAIL", "")
    name = args.name or getattr(settings, "ADMIN_NAME", "System Administrator")
    branch = args.branch
    password = args.password or getattr(settings, "ADMIN_PASSWORD", "")

    if args.interactive or not username or not email:
        username = input("Enter admin username: ").strip()
        email = input("Enter admin email: ").strip()
        name = input("Enter admin full name [System Administrator]: ").strip() or "System Administrator"

    if not password:
        password = getpass.getpass("Enter secure admin password: ")
        password_confirm = getpass.getpass("Confirm secure admin password: ")
        if password != password_confirm:
            print("Error: Passwords do not match.")
            sys.exit(1)

    if len(password) < 8:
        print("Error: Password must be at least 8 characters.")
        sys.exit(1)

    # Check if user already exists (by username or by email)
    existing_user = user_service.get_user_by_username(username)
    if not existing_user and email:
        existing_user = user_service.get_user_by_email(email)

    if existing_user:
        target_name = existing_user.get("username", username)
        print(f"User '{target_name}' already exists. Updating role to 'admin' and active status...")
        updated = user_service.update_user(
            existing_user["id"],
            {
                "role": "admin",
                "is_active": True,
                "password": password,
                "name": name,
                "email": email,
                "branch_id": branch,
            },
        )
        if updated:
            print(f"Success: User '{username}' promoted to administrator and password reset.")
            user_service.log_security_event(
                action="ADMIN_BOOTSTRAP_PROMOTED",
                user_id=updated["id"],
                username=username,
            )
        else:
            print(f"Failed to update user '{username}'.")
            sys.exit(1)
    else:
        new_admin = user_service.create_user(
            username=username,
            email=email,
            password=password,
            name=name,
            role="admin",
            branch_id=branch,
            store_name="Headquarters",
        )
        if new_admin:
            print(f"Success: Administrator account '{username}' created successfully.")
            user_service.log_security_event(
                action="ADMIN_BOOTSTRAP_CREATED",
                user_id=new_admin["id"],
                username=username,
            )
        else:
            print(f"Failed to create user '{username}'.")
            sys.exit(1)

    print("========================================")
    print("Administrator setup completed successfully.")
    print("========================================")


if __name__ == "__main__":
    main()
