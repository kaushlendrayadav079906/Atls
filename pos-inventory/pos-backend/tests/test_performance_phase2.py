"""Tests for Phase 2 Backend Performance Optimizations."""

import pytest
import time
from datetime import date
from unittest.mock import MagicMock, patch

from app.core.cache import cache_get, cache_set, get_cache_stats_sync
from app.services.sap.client import get_sap_client
from app.services.sap.finance_service import (
    SAPFinanceService,
    _FINANCE_CACHE,
    _HISTORICAL_TREND_CACHE,
    invalidate_finance_cache,
)
from app.api.v1.dashboard import _get_customer_clv_map_sync, _CLV_CACHE


def test_cache_observability_metrics():
    """Verify cache hit/miss and statistics tracking."""
    stats_before = get_cache_stats_sync()
    assert "hits" in stats_before
    assert "misses" in stats_before
    assert "hit_ratio_pct" in stats_before
    assert "keys_total" in stats_before


def test_sap_client_performance_metrics():
    """Verify SAPClient request tracking and latency metrics."""
    client = get_sap_client()
    metrics = client.get_performance_metrics()
    assert "total_requests" in metrics
    assert "failed_requests" in metrics
    assert "total_duration_ms" in metrics
    assert "avg_duration_ms" in metrics


def test_finance_overview_parallel_execution_and_caching():
    """Verify get_finance_overview uses parallel execution and caches cleanly."""
    service = SAPFinanceService()
    invalidate_finance_cache()

    mock_sales = {
        "total_sales": 1000.0,
        "prev_sales": 800.0,
        "invoice_count": 5,
        "growth": 25.0,
        "current_invoices": [{"CardCode": "C001", "DocTotal": 1000.0}],
    }
    mock_purchases = {
        "total_purchases": 600.0,
        "prev_purchases": 500.0,
        "invoice_count": 3,
        "growth": 20.0,
        "current_pinvs": [{"CardCode": "V001", "DocTotal": 600.0}],
    }
    mock_incoming = {
        "total_payments": 900.0,
        "prev_payments": 700.0,
        "payment_count": 4,
        "growth": 28.6,
    }
    mock_outgoing = {
        "total_payments": 500.0,
        "prev_payments": 400.0,
        "payment_count": 2,
        "growth": 25.0,
    }
    mock_balances = {
        "accounts_receivable": 5000.0,
        "accounts_payable": 2000.0,
        "debtors": [],
        "total_debtors_count": 0,
        "creditors": [],
        "total_creditors_count": 0,
    }
    mock_recent = {"incoming": [], "outgoing": []}
    mock_sp_trend = [{"period": "Jan", "sales": 1000.0, "purchases": 600.0, "gross_profit": 400.0, "gross_margin": 40.0}]
    mock_pmt_trend = [{"period": "Jan", "incoming": 900.0, "outgoing": 500.0}]

    with patch.object(service, "_get_sales_metrics", return_value=mock_sales) as m_s, \
         patch.object(service, "_get_purchases_metrics", return_value=mock_purchases) as m_p, \
         patch.object(service, "_get_incoming_payments_metrics", return_value=mock_incoming) as m_i, \
         patch.object(service, "_get_outgoing_payments_metrics", return_value=mock_outgoing) as m_o, \
         patch.object(service, "_get_ar_ap_balances", return_value=mock_balances) as m_b, \
         patch.object(service, "_get_recent_payments", return_value=mock_recent) as m_r, \
         patch.object(service, "_get_sales_vs_purchases_trend", return_value=mock_sp_trend) as m_spt, \
         patch.object(service, "_get_payments_trend", return_value=mock_pmt_trend) as m_pmt:

        # First call (Cold / Cache MISS)
        res1 = service.get_finance_overview(range_str="monthly", branch_id="B01")
        assert res1["kpis"]["total_sales"]["value"] == 1000.0
        assert res1["kpis"]["total_purchases"]["value"] == 600.0
        assert res1["kpis"]["gross_profit"]["value"] == 400.0
        assert res1["kpis"]["gross_margin"]["value"] == 40.0
        assert m_s.call_count == 1
        assert m_p.call_count == 1

        # Second call (Warm / Cache HIT) - should NOT call underlying methods again
        res2 = service.get_finance_overview(range_str="monthly", branch_id="B01")
        assert res2["kpis"]["total_sales"]["value"] == 1000.0
        assert m_s.call_count == 1
        assert m_p.call_count == 1

        # Cache invalidation for branch B01
        invalidate_finance_cache("B01")
        res3 = service.get_finance_overview(range_str="monthly", branch_id="B01")
        assert res3["kpis"]["total_sales"]["value"] == 1000.0
        assert m_s.call_count == 2


def test_customer_clv_bounded_caching():
    """Verify customer lifetime value query is bounded and cached."""
    mock_client = MagicMock()
    mock_client.get.return_value = {
        "value": [
            {"CardCode": "C001", "DocTotal": 1500.0},
            {"CardCode": "C002", "DocTotal": 2500.0},
            {"CardCode": "C001", "DocTotal": 500.0},
        ]
    }
    _CLV_CACHE.clear()

    # Cold call
    clv_map1 = _get_customer_clv_map_sync(mock_client)
    assert clv_map1["C001"] == 2000.0
    assert clv_map1["C002"] == 2500.0
    assert mock_client.get.call_count == 1

    # Warm call (served from memory cache)
    clv_map2 = _get_customer_clv_map_sync(mock_client)
    assert clv_map2["C001"] == 2000.0
    assert mock_client.get.call_count == 1
