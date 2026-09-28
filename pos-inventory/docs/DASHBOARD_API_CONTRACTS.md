# Dashboard API Contracts

## Authentication
All endpoints require a valid JWT token passed in the `Authorization: Bearer <token>` header.
Tokens specify `role` and `branch_id`. Managers are automatically scoped to their `branch_id`.

## Base URL
`/api/v1`

---

### 1. Overview Summary (Admins / Managers)
**Endpoint**: `GET /atlas/overview`
**Auth**: Admin or Manager only.
**Description**: High-level KPIs (Total sales, counts, AOV) for a given date range.

**Query Parameters**:
- `range` (string): `daily`, `weekly`, `monthly`, `yearly`, `all_time`
- `from_date` (string, optional): `YYYY-MM-DD`
- `to_date` (string, optional): `YYYY-MM-DD`
- `branch` (string, optional): Admin override for SAP WarehouseCode. Managers ignore this and use their JWT `branch_id`.

**Response Schema**:
```json
{
  "totalSales": 15000.50,
  "invoiceCount": 42,
  "averageOrderValue": 357.15,
  "paymentBreakdown": [
    {
      "method": "cash",
      "total": 5000.00,
      "percentage": 33.33
    },
    ...
  ]
}
```

**Data Source**: SAP `Invoices` filtered by `DocDate` and `WarehouseCode`.
**Error States**: 
- 401 Unauthorized (invalid token)
- 403 Forbidden (missing role)
- 502 Bad Gateway (SAP fetch failed)

---

### 2. Product Velocity / Top Selling Products
**Endpoint**: `GET /atlas/product-velocity`
**Auth**: Admin or Manager only.
**Description**: Top products by quantity sold.

**Query Parameters**:
- `range` (string)
- `from_date` (string, optional)
- `to_date` (string, optional)
- `branch` (string, optional)
- `limit` (int, default: 10, max: 100)

**Response Schema**:
```json
[
  {
    "itemCode": "ITM001",
    "itemName": "Premium Widget",
    "quantitySold": 150,
    "salesAmount": 4500.00
  }
]
```

**Data Source**: SAP `Invoices` line items (`DocumentLines`) aggregated by `ItemCode`.
**Error States**: 
- 401/403/502 (same as above)

---

### 3. Inventory Summary (Low Stock / Availability)
**Endpoint**: `GET /atlas/inventory-summary`
**Auth**: Admin or Manager only.
**Description**: Current stock levels across the branch.

**Query Parameters**:
- `branch` (string, optional): Required for Admins if they want a specific branch.

**Response Schema**:
```json
{
  "snapshotTime": "2026-09-27T08:00:00Z",
  "items": [
    {
      "itemCode": "ITM001",
      "itemName": "Premium Widget",
      "inStock": 5.0,
      "warehouse": "MAIN_WH"
    }
  ]
}
```

**Data Source**: SAP `Items` joined with `ItemWarehouseInfoCollection`.
**Error States**: 
- 400 Bad Request (if branch missing for Admin and too large)
- 401/403/502

---

### 4. Recent Sales Feed
**Endpoint**: `GET /dashboard/recent-sales-feed`
**Auth**: Any authenticated user.
**Description**: Paginated feed of recent invoices.

**Query Parameters**:
- `range` (string)
- `search` (string, optional)
- `limit` (int, default: 10)
- `offset` (int, default: 0)

**Response Schema**:
```json
{
  "total": 150,
  "nextOffset": 10,
  "items": [
    {
      "docEntry": 12345,
      "docNum": 50001,
      "saleId": "SALE-MAIN_WH-050001",
      "docDate": "2026-09-27",
      "customerCode": "C001",
      "customerName": "John Doe",
      "customerPhone": "1234567890",
      "paymentMethod": "card",
      "subtotal": 100.0,
      "discount": 0.0,
      "gst": 5.0,
      "total": 105.0,
      "items": [
        {
          "itemCode": "ITM001",
          "itemName": "Premium Widget",
          "quantity": 1,
          "unitPrice": 100.0,
          "lineTotal": 100.0
        }
      ],
      "hasReturn": false
    }
  ]
}
```

**Data Source**: SAP `Invoices` and cross-referenced with `CreditNotes` comments for `hasReturn`.
**Error States**: 
- 401/403/502

---

### 5. Returns and Approvals Summary
**Endpoint**: `GET /atlas/returns-summary`
**Auth**: Admin or Manager only.
**Description**: Overview of returns and pending approval requests.

**Query Parameters**:
- `range` (string)
- `from_date` (string, optional)
- `to_date` (string, optional)
- `branch` (string, optional)

**Response Schema**:
```json
{
  "pendingApprovalsCount": 3,
  "sapCreditNotesCount": 12,
  "sapCreditNotesTotal": 1250.00
}
```

**Data Source**: Postgres (Approval Requests) and SAP (`CreditNotes`).
**Error States**: 
- 401/403/502

---

### 6. Sales Trends
**Endpoint**: `GET /atlas/sales-trends`
**Auth**: Admin or Manager only.
**Description**: Time series data of sales.

**Query Parameters**:
- `range` (string)
- `from_date` (string, optional)
- `to_date` (string, optional)
- `branch` (string, optional)

**Response Schema**:
```json
{
  "trend": [
    {
      "period": "2026-09-27",
      "sales": 1500.00,
      "orders": 12
    }
  ]
}
```

**Data Source**: SAP `Invoices` aggregated by date.
**Error States**: 
- 401/403/502
