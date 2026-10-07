SAP WAREHOUSE DATA SOURCE MAP

- **SAP connection status**: DISCONNECTED (Connection actively refused)
- **SAP Service Layer base URL pattern**: `http://localhost:50001/b1s/v1` (or `https://127.0.0.1:50000/b1s/v1`)
- **`$metadata` discovery result**: FAILED (Could not fetch metadata)
- **All discovered warehouse entities**: NONE
- **All verified warehouse properties**: NONE
- **All verified inventory properties**: NONE
- **Warehouse SH/SAHIBABAD verification**: FAILED
- **Complete warehouse list discovered from SAP**: NONE
- **Product/item mapping**: PENDING
- **Warehouse stock mapping**: PENDING
- **Sales/invoice mapping**: PENDING
- **Credit-note/return mapping**: PENDING
- **Customer mapping**: PENDING
- **Payment mapping**: PENDING
- **Branch mapping**: PENDING
- **Pagination behavior**: PENDING
- **Cache behavior**: Existing backend implements cache, but requires SAP connection for live data.
- **Backend API mapping**: PENDING
- **Frontend-to-backend mapping**: PENDING
- **Fields available from SAP**: PENDING
- **Fields unavailable from SAP**: PENDING
- **Current hardcoded/mock data found**: The frontend currently expects specific warehouse data which is not verifiable.
- **Backend corrections made**: Added connection test scripts (`test_env.py`, `test_env2.py`, `fetch_meta.py`) to verify the environment. No business logic altered yet.
- **Known limitations**: The SAP Service Layer tunnel/proxy is currently not listening on the expected ports (checked via `netstat`). Therefore, tenant-specific discovery and verification could not be performed.
- **Items that require SAP administrator confirmation**:
  - The correct host and port for the SAP Service Layer SSH tunnel.
  - Verification that the provided SAP credentials in `.env` are active for the `Amit_Kumar` CompanyDB.

### Note:
Because the strict instruction was to **NOT** assume fields, manufacture values, or rely on non-tenant-specific SAP knowledge, the backend code cannot be responsibly altered until the Service Layer connection is actively restored and the exact schema is discovered from `/b1s/v1/$metadata`.
