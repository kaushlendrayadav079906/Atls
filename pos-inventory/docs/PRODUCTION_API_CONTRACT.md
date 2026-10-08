# Production API Contract

## Endpoints

### 1. Production Summary
`GET /api/v1/production/summary`
**Query Params:** `date_from`, `date_to`, `warehouse`
**Response:** `ProductionSummaryResponse`

### 2. Production Orders List
`GET /api/v1/production/orders`
**Query Params:** `page`, `page_size`, `search`, `status`, `item_code`, `warehouse`, `production_type`, `priority`, `date_from`, `date_to`
**Response:** `ProductionOrderListResponse` (Paginated)

### 3. Production Order Detail
`GET /api/v1/production/orders/{production_order_no}`
**Response:** `ProductionOrderDetail` (Includes Components)

### 4. Item-wise Production
`GET /api/v1/production/item-wise`
**Query Params:** `date_from`, `date_to`, `warehouse`, `search`
**Response:** `List[ProductionItemWiseAggregation]`

### 5. Production Rejection
`GET /api/v1/production/rejection`
**Query Params:** `date_from`, `date_to`, `warehouse`, `search`
**Response:** `ProductionRejectionAggregation`

### 6. Date-wise Production
`GET /api/v1/production/date-wise`
**Query Params:** `date_from`, `date_to`, `warehouse`, `granularity` (daily/weekly/monthly/yearly)
**Response:** `List[ProductionDateWiseItem]`

### 7. Status Distribution
`GET /api/v1/production/status-distribution`
**Query Params:** `date_from`, `date_to`, `warehouse`
**Response:** `List[ProductionStatusDistributionItem]`

### 8. Warehouse Summary
`GET /api/v1/production/warehouses`
**Query Params:** `date_from`, `date_to`, `warehouse`
**Response:** `List[ProductionWarehouseSummaryItem]`

## Security & Authorization
- **Authentication:** Standard JWT Bearer token required.
- **Branch Security:** Warehouse parameter is implicitly filtered. Users are restricted to their authorized warehouses/branches via `_get_permitted_branch()`.

## Error Handling
- `400 Bad Request`: Validation failure (e.g. `date_from > date_to`).
- `401 Unauthorized`: Invalid or missing token.
- `403 Forbidden`: Trying to access a restricted order or warehouse.
- `404 Not Found`: Production order not found.
- `500 Internal Server Error`: SAP Service Layer connectivity or extraction failure.
