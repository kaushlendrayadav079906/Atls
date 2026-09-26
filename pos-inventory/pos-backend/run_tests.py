import os
import sys
import pytest

os.environ["SECRET_KEY"] = "test-secret-key-12345"
os.environ["REGISTER_MASTER_PASSWORD"] = "test-master-password"
os.environ["SAP_SERVICE_LAYER_URL"] = "https://localhost:50000/b1s/v1/"
os.environ["SAP_COMPANY_DB"] = "TEST_DB"
os.environ["SAP_USERNAME"] = "test_user"
os.environ["SAP_PASSWORD"] = "test_password"
os.environ["POSTGRES_USER"] = "test"
os.environ["POSTGRES_PASSWORD"] = "test"
os.environ["POSTGRES_DB"] = "test"
os.environ["POSTGRES_HOST"] = "localhost"

if __name__ == "__main__":
    sys.exit(pytest.main(["tests"]))
