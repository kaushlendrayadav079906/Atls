from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy.sql import func, case

from app.models.factory import Factory
from app.models.financial_transaction import FinancialTransaction
from app.models.risk import Risk, AiRecommendedAction, ExecutiveBriefing
from app.models.upload import FileUpload


class RealtimeRepository:
    def get_operational_pulse(self, db: Session, company_id: UUID, factory_id: Optional[UUID] = None) -> Dict[str, Any]:
        """Aggregate factory health metrics for the company."""
        query = db.query(
            func.count(Factory.id).label("total"),
            func.sum(case((Factory.status == "active", 1), else_=0)).label("active"),
            func.sum(case((Factory.status != "active", 1), else_=0)).label("inactive"),
        ).filter(Factory.company_id == company_id)

        if factory_id:
            query = query.filter(Factory.id == factory_id)

        res = query.first()
        total = int(res.total or 0) if res else 0
        active = int(res.active or 0) if res and res.active is not None else 0
        inactive = int(res.inactive or 0) if res and res.inactive is not None else (total - active)
        health_pct = round((active / total * 100.0), 2) if total > 0 else 100.0

        return {
            "total_factories": total,
            "active_factories": active,
            "inactive_factories": inactive,
            "operational_health_pct": health_pct,
        }

    def get_financial_pulse(self, db: Session, company_id: UUID, factory_id: Optional[UUID] = None) -> Dict[str, Any]:
        """Aggregate total revenue, expenditure, and operating margin."""
        query = db.query(
            func.sum(case((FinancialTransaction.transaction_type == "revenue", FinancialTransaction.amount), else_=0)).label("revenue"),
            func.sum(case((FinancialTransaction.transaction_type == "expenditure", FinancialTransaction.amount), else_=0)).label("expenditure"),
        ).filter(FinancialTransaction.company_id == company_id)

        if factory_id:
            query = query.filter(FinancialTransaction.factory_id == factory_id)

        res = query.first()
        rev = float(res.revenue or 0.0) if res else 0.0
        exp = float(res.expenditure or 0.0) if res else 0.0
        profit = rev - exp
        margin = round((profit / rev * 100.0), 2) if rev > 0 else 0.0

        return {
            "total_revenue": round(rev, 2),
            "total_expenditure": round(exp, 2),
            "net_profit": round(profit, 2),
            "operating_margin_pct": margin,
        }

    def get_risk_summary(self, db: Session, company_id: UUID) -> Dict[str, Any]:
        """Aggregate active risk counts, severity breakdown, and composite risk severity."""
        query = db.query(
            func.count(Risk.id).label("total_active"),
            func.sum(case((Risk.severity == "CRITICAL", 1), else_=0)).label("critical_cnt"),
            func.sum(case((Risk.severity == "HIGH", 1), else_=0)).label("high_cnt"),
            func.sum(case((Risk.severity == "MEDIUM", 1), else_=0)).label("medium_cnt"),
            func.sum(case((Risk.severity == "LOW", 1), else_=0)).label("low_cnt"),
        ).filter(
            Risk.company_id == company_id,
            Risk.status == "active"
        )

        res = query.first()
        total_active = int(res.total_active or 0) if res else 0
        critical_cnt = int(res.critical_cnt or 0) if res and res.critical_cnt is not None else 0
        high_cnt = int(res.high_cnt or 0) if res and res.high_cnt is not None else 0
        medium_cnt = int(res.medium_cnt or 0) if res and res.medium_cnt is not None else 0
        low_cnt = int(res.low_cnt or 0) if res and res.low_cnt is not None else 0

        # Heuristic composite severity calculation based on active risk distribution
        if critical_cnt > 0:
            overall_severity = "CRITICAL"
            composite_score = min(100.0, 75.0 + (critical_cnt * 5.0))
        elif high_cnt > 0:
            overall_severity = "HIGH"
            composite_score = min(74.9, 50.0 + (high_cnt * 5.0))
        elif medium_cnt > 0:
            overall_severity = "MEDIUM"
            composite_score = min(49.9, 25.0 + (medium_cnt * 5.0))
        else:
            overall_severity = "LOW"
            composite_score = max(0.0, low_cnt * 2.5)

        return {
            "active_risk_count": total_active,
            "critical_count": critical_cnt,
            "high_count": high_cnt,
            "medium_count": medium_cnt,
            "low_count": low_cnt,
            "overall_composite_score": round(composite_score, 2),
            "overall_severity": overall_severity,
        }

    def get_pending_actions_count(self, db: Session, company_id: UUID) -> int:
        """Count pending AI recommended actions."""
        cnt = db.query(func.count(AiRecommendedAction.id)).filter(
            AiRecommendedAction.company_id == company_id,
            AiRecommendedAction.status == "pending"
        ).scalar()
        return int(cnt or 0)

    def get_latest_briefing_timestamp(self, db: Session, company_id: UUID) -> Optional[datetime]:
        """Fetch timestamp of the most recent executive briefing without loading JSON fields."""
        res = db.query(ExecutiveBriefing.generated_at).filter(
            ExecutiveBriefing.company_id == company_id
        ).order_by(ExecutiveBriefing.generated_at.desc()).first()
        return res[0] if res else None

    def get_last_data_sync_timestamp(self, db: Session, company_id: UUID) -> Optional[datetime]:
        """Fetch timestamp of the most recent data sync or file upload."""
        upload_time = db.query(FileUpload.created_at).filter(
            FileUpload.company_id == company_id
        ).order_by(FileUpload.created_at.desc()).first()
        return upload_time[0] if upload_time else None

    def get_active_alerts(
        self,
        db: Session,
        company_id: UUID,
        severity: Optional[str] = None,
        limit: int = 10
    ) -> List[Risk]:
        """Retrieve top active critical/high alerts for notification drawer."""
        query = db.query(Risk).filter(
            Risk.company_id == company_id,
            Risk.status == "active"
        )
        if severity:
            query = query.filter(Risk.severity == severity.upper())

        # Sort CRITICAL first, then HIGH, then newest
        return query.order_by(
            case(
                (Risk.severity == "CRITICAL", 1),
                (Risk.severity == "HIGH", 2),
                (Risk.severity == "MEDIUM", 3),
                else_=4
            ),
            Risk.created_at.desc()
        ).limit(limit).all()


realtime_repository = RealtimeRepository()
