import logging
from typing import Dict, List, Optional, Set, Tuple
from uuid import UUID
from dataclasses import dataclass, field
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.customer import Customer
from app.models.product import Product
from app.models.vendor import Vendor
from app.models.factory import Factory
from app.services.astroform_adapter import (
    AstroformAdapterResult,
    AstroformMarginRecord,
    AstroformSaleRecord,
    AstroformPurchaseRecord
)

logger = logging.getLogger(__name__)

@dataclass
class AstroformMasterDataResult:
    customers_matched: int = 0
    customers_created: int = 0
    products_matched: int = 0
    products_created: int = 0
    vendors_matched: int = 0
    vendors_created: int = 0
    factories_matched: int = 0
    factories_unmatched: int = 0
    resolved_customers: Dict[str, UUID] = field(default_factory=dict)
    resolved_products: Dict[str, UUID] = field(default_factory=dict)
    resolved_vendors: Dict[str, UUID] = field(default_factory=dict)
    resolved_factories: Dict[str, Optional[UUID]] = field(default_factory=dict)


class AstroformMasterDataService:
    def __init__(self, db: Session, company_id: UUID):
        if not company_id:
            raise ValueError("company_id is required for tenant-scoped master data resolution.")
        self.db = db
        self.company_id = company_id
        
        # In-memory batch caches for resolution during the same import
        self._customer_cache_by_code: Dict[str, Customer] = {}
        self._customer_cache_by_name: Dict[str, Customer] = {}
        
        self._product_cache_by_code: Dict[str, Product] = {}
        self._product_cache_by_name: Dict[str, Product] = {}
        
        self._vendor_cache_by_name: Dict[str, Vendor] = {}
        
        self._factory_cache: Dict[str, Optional[Factory]] = {}
        
        # Pre-populate caches with existing tenant records
        self._init_caches()

    def _init_caches(self):
        """Loads existing tenant records into lookup maps."""
        existing_customers = self.db.query(Customer).filter(Customer.company_id == self.company_id).all()
        for c in existing_customers:
            if c.code:
                self._customer_cache_by_code[c.code.strip()] = c
            self._customer_cache_by_name[c.name.strip().lower()] = c

        existing_products = self.db.query(Product).filter(Product.company_id == self.company_id).all()
        for p in existing_products:
            if p.code:
                self._product_cache_by_code[p.code.strip()] = p
            self._product_cache_by_name[p.name.strip().lower()] = p

        existing_vendors = self.db.query(Vendor).filter(Vendor.company_id == self.company_id).all()
        for v in existing_vendors:
            self._vendor_cache_by_name[v.name.strip().lower()] = v

        existing_factories = self.db.query(Factory).filter(Factory.company_id == self.company_id).all()
        for f in existing_factories:
            if f.code:
                self._factory_cache[f.code.strip().lower()] = f
            if f.location:
                self._factory_cache[f.location.strip().lower()] = f
            self._factory_cache[f.name.strip().lower()] = f

    def resolve_customer(self, name: str, code: Optional[str] = None) -> Tuple[Customer, bool]:
        """
        Resolves customer within company scope:
        1. Search by (company_id, code) if code available.
        2. Search by (company_id, name).
        3. If not found, create new Customer.
        Returns (Customer, is_newly_created).
        """
        clean_name = name.strip()
        norm_name = clean_name.lower()
        clean_code = code.strip() if code and code.strip() else None
        
        # 1. Check code cache
        if clean_code and clean_code in self._customer_cache_by_code:
            cust = self._customer_cache_by_code[clean_code]
            return cust, False
            
        # 2. Check name cache
        if norm_name in self._customer_cache_by_name:
            cust = self._customer_cache_by_name[norm_name]
            # If customer had no code and we now have one, populate it
            if clean_code and not cust.code:
                cust.code = clean_code
                self._customer_cache_by_code[clean_code] = cust
            return cust, False
            
        # 3. Create new Customer
        new_cust = Customer(
            company_id=self.company_id,
            name=clean_name,
            code=clean_code,
            status="active"
        )
        self.db.add(new_cust)
        self.db.flush() # obtain UUID
        
        # Update caches
        if clean_code:
            self._customer_cache_by_code[clean_code] = new_cust
        self._customer_cache_by_name[norm_name] = new_cust
        
        return new_cust, True

    def resolve_product(self, name: str, code: Optional[str] = None) -> Tuple[Product, bool]:
        """
        Resolves product within company scope:
        1. Search by (company_id, code) if code available.
        2. Search by (company_id, name).
        3. If not found, create new Product.
        Returns (Product, is_newly_created).
        """
        clean_name = name.strip()
        norm_name = clean_name.lower()
        clean_code = code.strip() if code and code.strip() else None
        
        # 1. Check code cache
        if clean_code and clean_code in self._product_cache_by_code:
            prod = self._product_cache_by_code[clean_code]
            return prod, False
            
        # 2. Check name cache
        if norm_name in self._product_cache_by_name:
            prod = self._product_cache_by_name[norm_name]
            if clean_code and not prod.code:
                prod.code = clean_code
                self._product_cache_by_code[clean_code] = prod
            return prod, False
            
        # 3. Create new Product
        new_prod = Product(
            company_id=self.company_id,
            name=clean_name,
            code=clean_code,
            category=None,
            status="active"
        )
        self.db.add(new_prod)
        self.db.flush()
        
        if clean_code:
            self._product_cache_by_code[clean_code] = new_prod
        self._product_cache_by_name[norm_name] = new_prod
        
        return new_prod, True

    def resolve_vendor(self, name: str) -> Tuple[Vendor, bool]:
        """
        Resolves vendor within company scope by name (no vendor code in source).
        Returns (Vendor, is_newly_created).
        """
        clean_name = name.strip()
        norm_name = clean_name.lower()
        
        if norm_name in self._vendor_cache_by_name:
            return self._vendor_cache_by_name[norm_name], False
            
        new_vendor = Vendor(
            company_id=self.company_id,
            name=clean_name,
            code=None, # Never invent vendor code
            status="active"
        )
        self.db.add(new_vendor)
        self.db.flush()
        
        self._vendor_cache_by_name[norm_name] = new_vendor
        return new_vendor, True

    def resolve_factory(self, loc_string: Optional[str]) -> Optional[Factory]:
        """
        Read-only factory resolution within company scope.
        DOES NOT create factory if unmatched.
        """
        if not loc_string or not str(loc_string).strip():
            return None
            
        norm_loc = str(loc_string).strip().lower()
        return self._factory_cache.get(norm_loc)

    def process_adapter_result(self, adapter_result: AstroformAdapterResult) -> AstroformMasterDataResult:
        """
        Resolves and ingests all master data entities from an AstroformAdapterResult.
        Guarantees cross-sheet deduplication and tenant isolation.
        """
        result = AstroformMasterDataResult()
        
        # 1. Resolve Customers from Margin Report (has both name & code)
        for m in adapter_result.margin_records:
            if m.customer_name:
                cust, created = self.resolve_customer(m.customer_name, m.customer_code)
                if created:
                    result.customers_created += 1
                else:
                    result.customers_matched += 1
                result.resolved_customers[m.customer_name] = cust.id
                if m.customer_code:
                    result.resolved_customers[m.customer_code] = cust.id

        # 2. Resolve Customers from Sale Register (may have additional customers)
        for s in adapter_result.sale_records:
            if s.customer_name and s.customer_name not in result.resolved_customers:
                cust, created = self.resolve_customer(s.customer_name, None)
                if created:
                    result.customers_created += 1
                else:
                    result.customers_matched += 1
                result.resolved_customers[s.customer_name] = cust.id

        # 3. Resolve Products from Margin Report
        for m in adapter_result.margin_records:
            if m.product_name:
                prod, created = self.resolve_product(m.product_name, m.product_code)
                if created:
                    result.products_created += 1
                else:
                    result.products_matched += 1
                result.resolved_products[m.product_name] = prod.id
                if m.product_code:
                    result.resolved_products[m.product_code] = prod.id

        # 4. Resolve Vendors from Purchase Register
        for p in adapter_result.purchase_records:
            if p.vendor_name:
                vendor, created = self.resolve_vendor(p.vendor_name)
                if created:
                    result.vendors_created += 1
                else:
                    result.vendors_matched += 1
                result.resolved_vendors[p.vendor_name] = vendor.id

        # 5. Resolve Factory locations (Read-only)
        all_locations = set()
        for m in adapter_result.margin_records:
            if m.location:
                all_locations.add(m.location)
        for s in adapter_result.sale_records:
            if s.location:
                all_locations.add(s.location)
        for p in adapter_result.purchase_records:
            if p.location:
                all_locations.add(p.location)
            if p.loc:
                all_locations.add(p.loc)

        for loc_str in all_locations:
            fac = self.resolve_factory(loc_str)
            if fac:
                result.factories_matched += 1
                result.resolved_factories[loc_str] = fac.id
            else:
                result.factories_unmatched += 1
                result.resolved_factories[loc_str] = None

        return result
