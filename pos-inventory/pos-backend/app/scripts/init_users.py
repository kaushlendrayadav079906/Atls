"""Registration guidance for scratch PostgreSQL setups."""


def init_default_user():
    """Guide setup toward the protected /register endpoint."""
    print("User bootstrap is handled through POST /api/v1/auth/register.")
    print("Set REGISTER_MASTER_PASSWORD in your .env and use that value as master_password.")
    print()
    print("Example payload:")
    print("{")
    print('  "username": "admin",')
    print('  "email": "admin@pos.local",')
    print('  "password": "admin123",')
    print('  "name": "Administrator",')
    print('  "master_password": "your-master-password",')
    print('  "role": "admin"')
    print("}")


if __name__ == "__main__":
    init_default_user()
