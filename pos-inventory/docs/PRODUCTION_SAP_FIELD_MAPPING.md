# Production SAP Field Mapping

| UI Field | SAP Entity | SAP Property | Data Type | Transformation | Verified? |
|---|---|---|---|---|---|
| Production Order No. | `ProductionOrders` | `DocumentNumber` | `int` | None | YES |
| Item Code | `ProductionOrders` | `ItemNo` | `str` | None | YES |
| Item Name | `ProductionOrders` | `ProductDescription` | `str` | None | YES |
| Status | `ProductionOrders` | `ProductionOrderStatus` | `str` | Enum Map (`boposReleased` -> `Released`) | YES |
| Type | `ProductionOrders` | `ProductionOrderType` | `str` | Enum Map (`bopotStandard` -> `Standard`) | YES |
| Planned Qty | `ProductionOrders` | `PlannedQuantity` | `float` | None | YES |
| Produced Qty | `ProductionOrders` | `CompletedQuantity` | `float` | None | YES |
| Rejected Qty | `ProductionOrders` | `RejectedQuantity` | `float` | None | YES |
| Pending Qty | `ProductionOrders` | N/A | `float` | `MAX(PlannedQuantity - CompletedQuantity, 0)` | YES |
| Production % | `ProductionOrders` | N/A | `float` | `(CompletedQuantity / PlannedQuantity) * 100` | YES |
| Rejection % | `ProductionOrders` | N/A | `float` | `(RejectedQuantity / CompletedQuantity) * 100` | YES |
| Order Date | `ProductionOrders` | `PostingDate` | `str` | Date Parse | YES |
| Start Date | `ProductionOrders` | `StartDate` | `str` | Date Parse | YES |
| Due Date | `ProductionOrders` | `DueDate` | `str` | Date Parse | YES |
| Warehouse | `ProductionOrders` | `Warehouse` | `str` | None | YES |
| Priority | `ProductionOrders` | `Priority` | `int` | None | YES |

## Components (Production Order Lines)
| UI Field | SAP Entity | SAP Property | Data Type | Transformation | Verified? |
|---|---|---|---|---|---|
| Component Item Code | `ProductionOrderLines` | `ItemNo` | `str` | None | YES |
| Component Name | `ProductionOrderLines` | `ItemName` | `str` | None | YES |
| Planned Qty | `ProductionOrderLines` | `PlannedQuantity` | `float` | None | YES |
| Issued Qty | `ProductionOrderLines` | `IssuedQuantity` | `float` | None | YES |
| Pending Issue Qty | `ProductionOrderLines` | N/A | `float` | `PlannedQuantity - IssuedQuantity` | YES |
| Warehouse | `ProductionOrderLines` | `Warehouse` | `str` | None | YES |
