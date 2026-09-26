from datetime import datetime, timezone
from typing import Optional, List, Dict
from uuid import UUID
from pydantic import BaseModel, Field


class RiskFactor(BaseModel):
    metric_name: str
    domain: str
    value: float
    threshold: float
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    explanation: str


class DomainRiskScore(BaseModel):
    domain: str  # financial, operational, supply
    score: float
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    metrics: Dict[str, float]
    risk_factors: List[RiskFactor] = []


class AIQualitativeAnalysis(BaseModel):
    executive_summary: str = Field(..., max_length=1500)
    primary_vulnerability: str = Field(..., max_length=500)
    key_observations: List[str] = Field(default_factory=list, max_length=10)
    strategic_outlook: str = Field(..., max_length=1000)


class RiskAnalysisResponse(BaseModel):
    overall_score: float
    overall_severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    financial: DomainRiskScore
    operational: DomainRiskScore
    supply: DomainRiskScore
    risk_factors: List[RiskFactor] = []
    ai_enriched: bool = False
    ai_qualitative_analysis: Optional[AIQualitativeAnalysis] = None
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RecommendationResponse(BaseModel):
    id: str
    domain: str  # FINANCIAL, OPERATIONAL, SUPPLY, STRATEGIC
    priority: str  # CRITICAL, HIGH, MEDIUM, LOW
    title: str
    description: str
    action_items: List[str] = []
    is_ai_generated: bool = False


class FinancialHighlights(BaseModel):
    score: float
    total_revenue: float
    total_expenditure: float
    operating_margin_pct: float
    burn_ratio: float
    key_risk: Optional[str] = None


class OperationalHighlights(BaseModel):
    score: float
    active_factories: int
    total_factories: int
    key_risk: Optional[str] = None


class SupplyHighlights(BaseModel):
    score: float
    stockout_count: int
    total_items: int
    top_vendor_share_pct: float
    key_risk: Optional[str] = None


class ExecutiveBriefingResponse(BaseModel):
    company_id: UUID
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    overall_risk_score: float
    overall_risk_level: str  # LOW, MEDIUM, HIGH, CRITICAL
    ai_enriched: bool = False
    executive_summary: str
    financial_highlights: FinancialHighlights
    operational_highlights: OperationalHighlights
    supply_highlights: SupplyHighlights
    top_recommendations: List[RecommendationResponse] = []
    data_quality_notes: List[str] = []


class RiskEvaluateRequest(BaseModel):
    factory_id: Optional[UUID] = None


from pydantic import BaseModel, Field, ConfigDict


class RiskItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    title: str
    severity: str
    category: str
    likelihood_pct: float
    financial_impact: float
    department: str
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None


class AiActionItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    title: str
    severity: str
    category: str
    description: str
    cta_label: str
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None


class ExecutiveBriefingEntityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    generated_at: datetime
    summary_text: str
    critical_issues: List[Dict] = []
    business_impact: List[str] = []
    priority_actions: List[Dict] = []
    created_at: datetime


class AIAnalysisJobResponse(BaseModel):
    job_id: str
    status: str  # pending, running, completed, failed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    result_summary: Optional[Dict] = None
