# Production Module - Phase 1 Audit

## Repository Audit

**Status:** PASS
- **Frontend Root:** `Dashboard-Ui/`
- **Backend Root:** `pos-backend/`
- **SAP Service Layer Client:** `app/services/sap/client.py`
- **Authentication:** Verified standard JWT logic in FastAPI
- **Existing Production Code:** None found. No existing routes, schemas, or UI components.

## SAP Metadata

**Status:** PASS
- Verified `ProductionOrders` entity and `ProductionOrderLines` sub-collection.

## Live SAP Read

**Status:** PASS
- Successfully fetched `ProductionOrders` from SAP Service Layer using the existing authenticated client.

## Verified SAP Entities and Fields

### `ProductionOrders`
- **DocNum**: `DocumentNumber` (int)
- **ItemCode**: `ItemNo` (str)
- **Status**: `ProductionOrderStatus` (str)
- **Type**: `ProductionOrderType` (str)
- **PlannedQty**: `PlannedQuantity` (float)
- **ProducedQty**: `CompletedQuantity` (float)
- **RejectedQty**: `RejectedQuantity` (float)
- **PostDate**: `PostingDate` (str)
- **DueDate**: `DueDate` (str)
- **StartDate**: `StartDate` (str)
- **CreateDate**: `CreationDate` (str)
- **Priority**: `Priority` (int)
- **Warehouse**: `Warehouse` (str)
- **Project**: `Project` (str)
- **Product Name**: `ProductDescription` (str)

### `ProductionOrderLines`
- **ItemCode**: `ItemNo` (str)
- **ItemName**: `ItemName` (str)
- **BaseQty**: `BaseQuantity` (float)
- **PlannedQty**: `PlannedQuantity` (float)
- **IssuedQty**: `IssuedQuantity` (float)
- **Warehouse**: `Warehouse` (str)

### Unavailable Fields (Requires verification or custom logic)
- **Efficiency / Production Percentage**: Calculated in backend.
- **Sales Order Links**: Available as `ProductionOrdersSalesOrderLines` but requires deeper joining if used.
- **Production Stages**: Field `ProductionOrdersStages` exists, but its usage depends on actual SAP configuration.

## Open Questions & Considerations
1. **Branch Mapping**: `Warehouse` is the primary filtering dimension for branch authorization. We will need to map user branch -> warehouses and append `$filter=Warehouse eq 'X'` to SAP queries.
2. **Performance**: Pagination via `$skip` and `$top` is supported. `$select` should be strictly used to prevent massive payload downloads.

## Recommended Phase 2 Implementation
- Create `app/schemas/production.py` for API contracts.
- Create `app/services/sap/production_service.py` extending the SAP client to fetch lists, details, and aggregated summaries (item-wise, date-wise).
- Create `app/api/v1/production.py` to expose the REST endpoints.
- Map `ProductionOrderStatus` enum values (`boposPlanned`, `boposReleased`, etc.) to frontend-friendly badges.
