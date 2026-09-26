from decimal import Decimal
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy.sql import func, desc

from app.models.financial_transaction import FinancialTransaction
from app.models.factory import Factory
from app.models.kpi_snapshot import KpiSnapshot
from app.models.inventory_item import InventoryItem
from app.models.customer import Customer
from app.models.vendor import Vendor
from app.models.product import Product


class RiskDataRepository:
    """Repository for querying and aggregating Phase 3 business data for risk calculations."""

    def get_financial_summary(
        self, db: Session, company_id: UUID, factory_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Calculates total revenue, expenditure, and customer/vendor aggregations."""
        rev_q = db.query(func.sum(FinancialTransaction.amount)).filter(
            FinancialTransaction.company_id == company_id,
            FinancialTransaction.transaction_type == "revenue"
        )
        exp_q = db.query(func.sum(FinancialTransaction.amount)).filter(
            FinancialTransaction.company_id == company_id,
            FinancialTransaction.transaction_type == "expenditure"
        )
        if factory_id:
            rev_q = rev_q.filter(FinancialTransaction.factory_id == factory_id)
            exp_q = exp_q.filter(FinancialTransaction.factory_id == factory_id)

        total_revenue = float(rev_q.scalar() or Decimal("0.0"))
        total_expenditure = float(exp_q.scalar() or Decimal("0.0"))

        # Top customer revenue
        top_cust_q = db.query(
            Customer.name.label("customer_name"),
            func.sum(FinancialTransaction.amount).label("customer_revenue")
        ).join(
            Customer, FinancialTransaction.customer_id == Customer.id
        ).filter(
            FinancialTransaction.company_id == company_id,
            FinancialTransaction.transaction_type == "revenue"
        )
        if factory_id:
            top_cust_q = top_cust_q.filter(FinancialTransaction.factory_id == factory_id)

        top_customer = top_cust_q.group_by(Customer.id).order_by(
            desc(func.sum(FinancialTransaction.amount))
        ).first()

        top_customer_revenue = float(top_customer.customer_revenue) if top_customer else 0.0
        top_customer_name = top_customer.customer_name if top_customer else "N/A"

        # Monthly revenue momentum (current vs prior month)
        monthly_q = db.query(
            func.year(FinancialTransaction.transaction_date).label("yr"),
            func.month(FinancialTransaction.transaction_date).label("mo"),
            func.sum(FinancialTransaction.amount).label("rev")
        ).filter(
            FinancialTransaction.company_id == company_id,
            FinancialTransaction.transaction_type == "revenue"
        )
        if factory_id:
            monthly_q = monthly_q.filter(FinancialTransaction.factory_id == factory_id)

        monthly_revs = monthly_q.group_by(
            func.year(FinancialTransaction.transaction_date),
            func.month(FinancialTransaction.transaction_date)
        ).order_by(
            desc(func.year(FinancialTransaction.transaction_date)),
            desc(func.month(FinancialTransaction.transaction_date))
        ).limit(2).all()

        current_month_rev = float(monthly_revs[0].rev) if len(monthly_revs) > 0 else total_revenue
        prior_month_rev = float(monthly_revs[1].rev) if len(monthly_revs) > 1 else None

        return {
            "total_revenue": total_revenue,
            "total_expenditure": total_expenditure,
            "top_customer_revenue": top_customer_revenue,
            "top_customer_name": top_customer_name,
            "current_month_rev": current_month_rev,
            "prior_month_rev": prior_month_rev,
        }

    def get_operational_summary(
        self, db: Session, company_id: UUID, factory_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Calculates factory activity counts and latest KPI snapshot metrics."""
        fac_q = db.query(Factory).filter(Factory.company_id == company_id)
        if factory_id:
            fac_q = fac_q.filter(Factory.id == factory_id)

        factories = fac_q.all()
        total_factories = len(factories)
        active_factories = sum(1 for f in factories if (f.status or "").lower() == "active")
        inactive_factories = total_factories - active_factories

        # Query KPI snapshots
        kpi_q = db.query(KpiSnapshot).filter(KpiSnapshot.company_id == company_id)
        if factory_id:
            kpi_q = kpi_q.filter(KpiSnapshot.factory_id == factory_id)

        snapshots = kpi_q.order_by(desc(KpiSnapshot.snapshot_date)).all()

        # Group by metric_name to detect degradation and downtime
        metric_latest: Dict[str, float] = {}
        metric_prior: Dict[str, float] = {}
        downtime_val: float = 0.0

        for s in snapshots:
            m_name = (s.metric_name or "").lower().strip()
            val = float(s.metric_value)
            if m_name not in metric_latest:
                metric_latest[m_name] = val
                if "downtime" in m_name:
                    downtime_val = val
            elif m_name not in metric_prior:
                metric_prior[m_name] = val

        return {
            "total_factories": total_factories,
            "active_factories": active_factories,
            "inactive_factories": inactive_factories,
            "metric_latest": metric_latest,
            "metric_prior": metric_prior,
            "downtime_val": downtime_val,
        }

    def get_supply_summary(
        self, db: Session, company_id: UUID, factory_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Calculates inventory stockout rates, inactive inventory, and vendor concentration."""
        inv_q = db.query(InventoryItem).filter(InventoryItem.company_id == company_id)
        if factory_id:
            inv_q = inv_q.filter(InventoryItem.factory_id == factory_id)

        items = inv_q.all()
        total_items = len(items)
        stockout_items = sum(1 for i in items if float(i.quantity) <= 0.0)
        inactive_items = sum(1 for i in items if (i.status or "").lower() != "active")
        total_inventory_value = sum(float(i.value) for i in items)

        # Top vendor spend
        top_vnd_q = db.query(
            Vendor.name.label("vendor_name"),
            func.sum(FinancialTransaction.amount).label("vendor_spend")
        ).join(
            Vendor, FinancialTransaction.vendor_id == Vendor.id
        ).filter(
            FinancialTransaction.company_id == company_id,
            FinancialTransaction.transaction_type == "expenditure"
        )
        if factory_id:
            top_vnd_q = top_vnd_q.filter(FinancialTransaction.factory_id == factory_id)

        top_vendor = top_vnd_q.group_by(Vendor.id).order_by(
            desc(func.sum(FinancialTransaction.amount))
        ).first()

        top_vendor_spend = float(top_vendor.vendor_spend) if top_vendor else 0.0
        top_vendor_name = top_vendor.vendor_name if top_vendor else "N/A"

        return {
            "total_items": total_items,
            "stockout_items": stockout_items,
            "inactive_items": inactive_items,
            "total_inventory_value": total_inventory_value,
            "top_vendor_spend": top_vendor_spend,
            "top_vendor_name": top_vendor_name,
        }


risk_data_repository = RiskDataRepository()


class RiskPersistenceRepository:
    """Repository for persisting and querying Risk, AiRecommendedAction, and ExecutiveBriefing records."""

    # Risk methods
    def create_risk(self, db: Session, risk: "Risk") -> "Risk":
        db.add(risk)
        db.flush()
        return risk

    def get_risks(
        self,
        db: Session,
        company_id: UUID,
        severity: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List["Risk"]:
        from app.models.risk import Risk
        q = db.query(Risk).filter(Risk.company_id == company_id)
        if severity:
            q = q.filter(Risk.severity == severity.upper())
        if status:
            q = q.filter(Risk.status == status.lower())
        return q.order_by(desc(Risk.created_at)).offset(offset).limit(limit).all()

    def get_risk_by_id(self, db: Session, risk_id: UUID, company_id: UUID) -> Optional["Risk"]:
        from app.models.risk import Risk
        return db.query(Risk).filter(Risk.id == risk_id, Risk.company_id == company_id).first()

    # AI Action methods
    def create_action(self, db: Session, action: "AiRecommendedAction") -> "AiRecommendedAction":
        db.add(action)
        db.flush()
        return action

    def get_actions(
        self,
        db: Session,
        company_id: UUID,
        status: Optional[str] = None,
        severity: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List["AiRecommendedAction"]:
        from app.models.risk import AiRecommendedAction
        q = db.query(AiRecommendedAction).filter(AiRecommendedAction.company_id == company_id)
        if status:
            q = q.filter(AiRecommendedAction.status == status.lower())
        if severity:
            q = q.filter(AiRecommendedAction.severity == severity.upper())
        return q.order_by(desc(AiRecommendedAction.created_at)).offset(offset).limit(limit).all()

    def get_action_by_id(self, db: Session, action_id: UUID, company_id: UUID) -> Optional["AiRecommendedAction"]:
        from app.models.risk import AiRecommendedAction
        return db.query(AiRecommendedAction).filter(
            AiRecommendedAction.id == action_id,
            AiRecommendedAction.company_id == company_id
        ).first()

    # Executive Briefing methods
    def create_briefing(self, db: Session, briefing: "ExecutiveBriefing") -> "ExecutiveBriefing":
        db.add(briefing)
        db.flush()
        return briefing

    def get_latest_briefing(self, db: Session, company_id: UUID) -> Optional["ExecutiveBriefing"]:
        from app.models.risk import ExecutiveBriefing
        return db.query(ExecutiveBriefing).filter(
            ExecutiveBriefing.company_id == company_id
        ).order_by(desc(ExecutiveBriefing.generated_at)).first()

    def get_briefings(
        self,
        db: Session,
        company_id: UUID,
        limit: int = 20,
        offset: int = 0
    ) -> List["ExecutiveBriefing"]:
        from app.models.risk import ExecutiveBriefing
        return db.query(ExecutiveBriefing).filter(
            ExecutiveBriefing.company_id == company_id
        ).order_by(desc(ExecutiveBriefing.generated_at)).offset(offset).limit(limit).all()


risk_persistence_repository = RiskPersistenceRepository()
