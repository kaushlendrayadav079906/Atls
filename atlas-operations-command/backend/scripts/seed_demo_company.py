import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.company import Company

def seed():
    db = SessionLocal()
    try:
        existing = db.query(Company).filter(Company.name == "AtlasOps Demo Company").first()
        if existing:
            print("Demo company already exists.")
            return

        demo_company = Company(
            name="AtlasOps Demo Company",
            currency_code="USD",
            region="North America",
            fiscal_year_start_month=4,
            status="active"
        )
        db.add(demo_company)
        db.commit()
        print("Demo company seeded successfully.")
    except Exception as e:
        print(f"Error seeding demo company: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
