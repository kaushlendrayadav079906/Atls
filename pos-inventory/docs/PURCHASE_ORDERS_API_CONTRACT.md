# Purchase Orders API Contract

## GET /api/v1/purchase-orders

**Parameters:**
- `page` (int, default: 1)
- `limit` (int, default: 10)
- `search` (string)
- `status` (string: pending, received, cancelled)
- `supplier` (string)
- `buyer` (string)
- `branch_id` (int)
- `warehouse_code` (string)
- `date_from` (string)
- `date_to` (string)

**Response:**
```json
{
  "items": [
    {
      "doc_entry": 1,
      "doc_num": 1,
      "doc_date": "2023-09-25T00:00:00Z",
      "doc_due_date": "2023-09-25T00:00:00Z",
      "card_code": "VEN002",
      "card_name": "HASAGREEN Ven",
      "doc_total": 1050.0,
      "document_status": "bost_Close",
      "cancelled": "tNO",
      "sales_person_code": "-1",
      "bpl_id": 3,
      "comments": null
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10,
  "total_pages": 1
}
```

## GET /api/v1/purchase-orders/summary

**Parameters:**
- `branch_id` (int)

**Response:**
```json
{
  "total_orders": 28,
  "pending_orders": 16,
  "received_orders": 9,
  "cancelled_orders": 3
}
```

## GET /api/v1/purchase-orders/{doc_entry}

**Response:**
```json
{
  "doc_entry": 1,
  "doc_num": 1,
  "doc_date": "2023-09-25T00:00:00Z",
  "doc_due_date": "2023-09-25T00:00:00Z",
  "card_code": "VEN002",
  "card_name": "HASAGREEN Ven",
  "doc_total": 1050.0,
  "document_status": "bost_Close",
  "cancelled": "tNO",
  "sales_person_code": "-1",
  "bpl_id": 3,
  "comments": null,
  "document_lines": [
    {
      "line_num": 0,
      "item_code": "CABLE0001",
      "item_description": "BajajCable",
      "quantity": 10.0,
      "price": 100.0,
      "price_after_vat": 105.0,
      "line_total": 1000.0,
      "warehouse_code": "SH"
    }
  ]
}
```
