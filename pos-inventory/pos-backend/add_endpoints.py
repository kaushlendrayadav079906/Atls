from app.models.schemas import CustomerProfile, CustomerPurchase, CustomerReturn
from app.services.sap.business_partners_service import SAPBusinessPartnersService
from app.services.sap.returns_service import SAPReturnsService
from datetime import datetime

code = """
@router.get("/{card_code}", response_model=CustomerProfile)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_customer_profile(
    request: Request,
    card_code: str,
    current_user: dict = Depends(get_current_user),
):
    \"\"\"Get full customer profile from SAP.\"\"\"
    from app.services.sap.business_partners_service import SAPBusinessPartnersService
    from app.services.sap.returns_service import SAPReturnsService
    
    bp_service = SAPBusinessPartnersService()
    invoice_service = SAPInvoicesService()
    returns_service = SAPReturnsService()
    loop = asyncio.get_running_loop()
    
    try:
        bp = await loop.run_in_executor(_executor, lambda: bp_service.get_customer(card_code))
        if not bp:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Get all invoices for lifetime value & purchase history
        invoices = await loop.run_in_executor(
            _executor, lambda: invoice_service.get_invoices_by_date("2000-01-01", "2099-12-31")
        )
        customer_invoices = [inv for inv in invoices if str(inv.get("CardCode") or "") == card_code]
        
        # Get all returns
        try:
            returns = await loop.run_in_executor(
                _executor, lambda: returns_service.get_recent_returns(limit=5000)
            )
            customer_returns = [r for r in returns if str(r.get("CardCode") or "") == card_code]
        except Exception:
            customer_returns = []
            
        total_sales = sum(float(inv.get("DocTotal") or 0) for inv in customer_invoices)
        
        last_purchase = None
        if customer_invoices:
            last_inv = sorted(customer_invoices, key=lambda x: str(x.get("DocDate") or ""), reverse=True)[0]
            last_purchase = str(last_inv.get("DocDate") or "")

        branch_counts = defaultdict(int)
        for inv in customer_invoices:
            b = _extract_invoice_branch(inv)
            if b:
                branch_counts[b] += 1
        preferred_branch = max(branch_counts.items(), key=lambda x: x[1])[0] if branch_counts else None

        address = None
        if bp.get("BPAddresses"):
            addresses = bp.get("BPAddresses")
            if addresses:
                addr = addresses[0]
                parts = [addr.get("Street"), addr.get("City"), addr.get("State"), addr.get("Country")]
                address = ", ".join(p for p in parts if p)
                
        status_val = "Active"
        if bp.get("Valid") == "tYES":
            status_val = "Active"
        elif bp.get("Frozen") == "tYES":
            status_val = "Frozen"

        return CustomerProfile(
            cardCode=bp.get("CardCode"),
            cardName=bp.get("CardName") or bp.get("CardCode"),
            cardType=bp.get("CardType") or "Retail",
            phone=bp.get("Phone1"),
            email=bp.get("EmailAddress"),
            whatsappNumber=bp.get("Cellular"),
            address=address,
            status=status_val,
            registeredOn=bp.get("CreateDate"),
            lastPurchase=last_purchase,
            preferredBranch=preferred_branch,
            recentInvoicesCount=len(customer_invoices),
            recentReturnsCount=len(customer_returns),
            lifetimeValue=round(total_sales, 2)
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Failed to fetch customer profile {card_code}: {exc}")
        raise HTTPException(status_code=502, detail="SAP service unavailable")


@router.get("/{card_code}/purchases", response_model=List[CustomerPurchase])
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_customer_purchases(
    request: Request,
    card_code: str,
    current_user: dict = Depends(get_current_user),
):
    \"\"\"Get customer purchase history from SAP.\"\"\"
    invoice_service = SAPInvoicesService()
    loop = asyncio.get_running_loop()
    
    try:
        # Optimally we would filter by CardCode in OData, but the current service doesn't expose it.
        # This is a bit inefficient but works for the current backend capabilities.
        invoices = await loop.run_in_executor(
            _executor, lambda: invoice_service.get_invoices_by_date_with_lines("2000-01-01", "2099-12-31", max_line_rows=100000)
        )
        
        purchases = []
        for inv in invoices:
            if str(inv.get("CardCode") or "") == card_code:
                lines = inv.get("DocumentLines") or []
                branch = _extract_invoice_branch(inv) or "Unknown"
                purchases.append(CustomerPurchase(
                    docEntry=inv.get("DocEntry"),
                    docNum=inv.get("DocNum"),
                    docDate=str(inv.get("DocDate") or ""),
                    docTotal=float(inv.get("DocTotal") or 0),
                    status=inv.get("DocumentStatus") or "Closed",
                    branch=branch,
                    itemCount=sum(float(l.get("Quantity") or 0) for l in lines)
                ))
                
        purchases.sort(key=lambda x: x.docDate, reverse=True)
        return purchases
    except Exception as exc:
        logger.error(f"Failed to fetch customer purchases {card_code}: {exc}")
        raise HTTPException(status_code=502, detail="SAP service unavailable")


@router.get("/{card_code}/returns", response_model=List[CustomerReturn])
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_customer_returns(
    request: Request,
    card_code: str,
    current_user: dict = Depends(get_current_user),
):
    \"\"\"Get customer returns history from SAP.\"\"\"
    from app.services.sap.returns_service import SAPReturnsService
    returns_service = SAPReturnsService()
    loop = asyncio.get_running_loop()
    
    try:
        returns = await loop.run_in_executor(
            _executor, lambda: returns_service.get_recent_returns(limit=5000)
        )
        
        customer_returns = []
        for r in returns:
            if str(r.get("CardCode") or "") == card_code:
                lines = r.get("DocumentLines") or []
                branch = str(r.get("BPLName") or "Unknown")
                customer_returns.append(CustomerReturn(
                    docEntry=r.get("DocEntry"),
                    docNum=r.get("DocNum"),
                    docDate=str(r.get("DocDate") or ""),
                    docTotal=float(r.get("DocTotal") or 0),
                    status=r.get("DocumentStatus") or "Closed",
                    branch=branch,
                    itemCount=sum(float(l.get("Quantity") or 0) for l in lines)
                ))
                
        customer_returns.sort(key=lambda x: x.docDate, reverse=True)
        return customer_returns
    except Exception as exc:
        logger.error(f"Failed to fetch customer returns {card_code}: {exc}")
        raise HTTPException(status_code=502, detail="SAP service unavailable")

"""

with open('app/api/v1/customers.py', 'a', encoding='utf-8') as f:
    f.write(code)
