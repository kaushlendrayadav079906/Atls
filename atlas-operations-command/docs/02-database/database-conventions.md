# Database Conventions and Architecture

## Confirmed Requirements

*   **Primary Key Convention:** Use UUID primary keys for all entities unless there's a specific requirement for an integer ID. Generated safely (e.g. `gen_random_uuid()` on PostgreSQL).
*   **Timestamp Convention:** Every entity should have `created_at` and `updated_at` timezone-aware timestamps (UTC).
*   **Tenant / Company Scoping:** Company-scoped entities will support a `company_id` column (UUID).
*   **Naming Convention:**
    *   Table names, column names, foreign keys, index names, unique constraints, and check constraints must use `snake_case`.
    *   Metadata naming conventions enforce prefixing (`pk_`, `fk_`, `uq_`, `ix_`, `ck_`).
*   **Financial Data:** PostgreSQL `NUMERIC`/`DECIMAL` must be used for money amounts. No floats for financials.
*   **Currency Convention:** Monetary records must be associated with an ISO-style `currency_code` (e.g., USD, INR).
*   **Percentage Convention:** Stored as `NUMERIC` values (e.g., `0.963` for 96.3% or `96.3` with documented scale). Do not store as strings.
*   **JSONB Convention:** Use `JSONB` for unstructured data (e.g., raw SAP payloads, AI outputs, staging data). Do not use to replace standard relational structures.
*   **Soft Delete:** Not every table will have `deleted_at`. Only use soft deletes when business requirements explicitly forbid hard deletion (e.g., for compliance).

## Architectural Decisions

*   **SQLAlchemy Base Configuration:**
    *   Central `Base` includes naming conventions to ensure Alembic works reliably.
    *   Mixins (`UUIDMixin`, `TimestampMixin`) are established in `app.models.base` to keep future models DRY.
*   **UUID Generation:** Primary keys are of type `UUID(as_uuid=True)` and are generated via `uuid.uuid4` in Python, with a server default of `gen_random_uuid()`.
*   **Timestamps:** Uses `DateTime(timezone=True)` defaulting to `datetime.now(timezone.utc)`.
*   **Foreign Key & Indexes:** 
    *   Company-scoped tables will be indexed by `company_id`.
    *   Factory-scoped tables will be indexed by `company_id` and `factory_id`.
    *   Time-series tables will be indexed by scoping IDs and `timestamp`/`date`.

## Requires Business Decision

*   **Foreign Key Behavior (ON DELETE / ON UPDATE):** Depends entirely on the specific business entities involved (e.g., cascade deletion vs. restrict/set null).
*   **Unique Constraints:** Globally unique values are rare. Determine if unique constraints need to be composite (e.g., `company_id` + `code`) based on business domains.
*   **Financial Precision:** Specific precision and scale for `NUMERIC` values (e.g., `NUMERIC(15, 2)` or `NUMERIC(19, 4)`) depends on specific business modules.
*   **Audit Fields:** Determine which specific business actions (settings changes, financial updates, SAP interactions) require logging to an audit table. Not implemented generically on all tables.
