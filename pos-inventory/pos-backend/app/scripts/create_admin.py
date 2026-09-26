"""Create-admin guidance for PostgreSQL-backed auth."""


def main():
    print("Create admin users through POST /api/v1/auth/register.")
    print("The request must include the REGISTER_MASTER_PASSWORD value as master_password.")
    print()
    print("Example:")
    print("{")
    print('  "username": "admin",')
    print('  "email": "admin@pos.local",')
    print('  "password": "admin123",')
    print('  "name": "Administrator",')
    print('  "master_password": "your-master-password",')
    print('  "role": "admin"')
    print("}")


if __name__ == "__main__":
    main()
