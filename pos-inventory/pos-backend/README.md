# POS Backend API

FastAPI backend for Point of Sale system with SAP Business One Service Layer integration.

## Features

- **SAP Business One Integration**: Bi-directional sync with SAP B1 Service Layer
  - Items (Products) management
  - Business Partners (Customers)
  - AR Invoices (Sales documents)
  - Inventory tracking
  - Payment processing
  - Price lists

- **Authentication**: JWT-based user authentication
- **Caching**: Local database caching for improved performance
- **Background Jobs**: Automated sync with SAP B1
- **API Versioning**: RESTful API with versioning support

## Prerequisites

- Python 3.11+
- PostgreSQL 14+
- SAP Business One with Service Layer enabled
- Access to SAP B1 Service Layer (HTTPS endpoint)

## Installation

1. Clone the repository and navigate to backend:
```bash
cd pos-backend
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```
# .\venv\Scripts\Activate.ps1  
3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment:
```bash
cp .env.example .env
# Edit .env with your SAP B1 and database credentials
```

5. Configure PostgreSQL and start the backend:
```bash
uvicorn app.main:app --reload --port 3000
```

On startup the backend will:
- create the `users` table automatically if it does not exist

## Configuration

Edit `.env` file with your settings:

### SAP Business One Service Layer
- `SAP_SERVICE_LAYER_URL`: Your SAP B1 Service Layer endpoint
- `SAP_COMPANY_DB`: Company database name
- `SAP_USERNAME`: SAP B1 username
- `SAP_PASSWORD`: SAP B1 password

### Database
- `DATABASE_URL`: PostgreSQL connection string

### Security
- `SECRET_KEY`: JWT secret (generate with `openssl rand -hex 32`)

## Running the Application

### Development
```bash
uvicorn app.main:app --reload --port 3000
```

### Production
```bash
uvicorn app.main:app --host 0.0.0.0 --port 3000 --workers 4
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:3000/docs
- ReDoc: http://localhost:3000/redoc

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user or admin with master password
- `POST /api/v1/auth/login` - Login user
- `GET /api/v1/auth/me` - Get current user

Authentication is stored in PostgreSQL. The login flow matches the old JSON-based flow:
- login accepts `username` or `email`
- passwords are verified against `password_hash`
- inactive users cannot log in
- JWT payload still includes `user_id`, `role`, `branch_id`, and `store_name`

Registration is protected by a master password:
- set `REGISTER_MASTER_PASSWORD` in `.env`
- send `master_password` in `POST /api/v1/auth/register`
- `role` can be `user` or `admin`
- example:
```json
{
  "username": "admin",
  "email": "admin@pos.local",
  "password": "admin123",
  "name": "Administrator",
  "master_password": "your-master-password",
  "role": "admin"
}
```

### Products
- `GET /api/v1/products` - List all products (from SAP Items)
- `GET /api/v1/products/{barcode}` - Get product by barcode
- `GET /api/v1/products/{item_code}/image` - Public product image proxy (attachments first; Picture fallback if configured)
- `POST /api/v1/products` - Create new product (creates SAP Item)
- `PUT /api/v1/products/{id}` - Update product
- `DELETE /api/v1/products/{id}` - Soft delete product

### Sales
- `POST /api/v1/sales` - Create sale (creates SAP AR Invoice)
- `GET /api/v1/sales` - List sales history

### Dashboard
- `GET /api/v1/dashboard/summary` - Get today's sales summary

### Health
- `GET /health` - Health check endpoint

## SAP Business One Integration

### Data Flow

**Products (Items)**:
- Fetched from SAP `Items` entity via OData
- Cached locally for performance
- Auto-refreshed every 15 minutes

**Sales (AR Invoices)**:
- Created in SAP `Invoices` entity
- Local backup before SAP sync
- Automatic retry on failure

**Inventory**:
- Stock levels fetched from SAP `InventoryGenEntries`
- Real-time validation before sale

**Customers (Business Partners)**:
- Auto-created in SAP if new customer
- CardType = 'C' (Customer)

### SAP Field Mapping

| POS Field | SAP B1 Field | Entity |
|-----------|--------------|--------|
| id | ItemCode | Items |
| name | ItemName | Items |
| price | Price (from PriceList) | Items |
| barcode | BarCode | Items |
| stock | OnHand | Items (joined with warehouse) |

## Database Schema

### Tables
- `users` - User accounts with this schema:
  - `id`
  - `username`
  - `email`
  - `name`
  - `password_hash`
  - `role`
  - `sap_user_code`
  - `branch_id`
  - `store_name`
  - `created_at`
  - `is_active`
- `products_cache` - Cached SAP Items
- `customers_cache` - Cached Business Partners
- `sales` - Local sales records
- `sync_log` - SAP sync status tracking

## Background Jobs

- **Product Cache Refresh**: Every 15 minutes
- **Failed Sync Retry**: Exponential backoff
- **Stock Level Update**: Every 30 minutes
- **Price List Update**: Every 1 hour

## Development

### Run Tests
```bash
pytest
```

### Code Formatting
```bash
black app/
```

### Type Checking
```bash
mypy app/
```

## Troubleshooting

### SAP Connection Issues
- Verify SAP Service Layer URL is accessible
- Check SSL certificate settings (`SAP_SSL_VERIFY`)
- Confirm credentials and company database name

### Product Images (SAP Items)
This backend serves item images from SAP in two ways:

1) **Attachments (preferred)**
  - SAP field: `Items.AttachmentEntry` → Service Layer `Attachments2(<entry>)/$value`
  - Works when the item has an attachment linked in SAP.

2) **Picture fallback (when AttachmentEntry is null)**
  - SAP field: `Items.Picture` contains a filename (e.g. `ELA00081.png`).
  - Some SAP Service Layer deployments do **not** expose an `Images` entityset, so the backend cannot download picture bytes directly.
  - To serve these pictures, configure one of:
    - `SAP_PICTURE_BASE_PATH` (read from local/shared filesystem)
    - `SAP_PICTURE_BASE_URL` (307 redirect to an HTTP-hosted images folder)

The image endpoint is public so `<img src=...>` can load it without auth headers.

### Database Connection
- Ensure PostgreSQL is running
- Check DATABASE_URL connection string
- Verify database user permissions

### CORS Errors
- Add frontend URL to `CORS_ORIGINS` in `.env`
- Check protocol (http vs https)

## License

Proprietary - Internal Use Only
