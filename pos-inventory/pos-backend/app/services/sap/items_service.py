"""SAP Items service - Product/Item management"""

from typing import List, Dict, Any, Optional
import logging
from mimetypes import guess_type
from urllib.parse import quote

from app.services.sap.client import get_sap_client, SAPValidationError
from app.core.config import settings


logger = logging.getLogger(__name__)


class SAPItemsService:
    """Service for SAP Items (Products) operations"""

    def __init__(self):
        self.client = get_sap_client()
        self.default_price_list = settings.SAP_DEFAULT_PRICE_LIST

    # Confirmed by live test (test_sap_limits.py):
    #   Without Prefer header  → SAP hard-caps at 20 regardless of $top
    #   With Prefer:100 header → SAP honours up to 100 items per page
    # The Prefer header is set globally in SAPServiceLayerClient._get_headers().
    # 100 reduces startup warming from ~15 round-trips to ~3 for a 300-item catalogue.
    _SAP_PAGE_SIZE = 100

    def get_items(
        self,
        search: Optional[str] = None,
        top: Optional[int] = 1000,
        orderby: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Fetch available items from SAP with optional search.

        Items are filtered to only include Valid='Y' and Frozen='N' (available items).
        Fetches pages sequentially until no more data.

        Args:
            search: Search term for ItemName or ItemCode
            top: Hard cap on total items returned (default 1000)

        Returns:
            List of SAP Items
        """
        try:
            # Base filter: only available items (Valid and not Frozen)
            base_filter = "Valid eq 'tYES' and Frozen eq 'tNO'"
            
            if search:
                filter_str = f"({base_filter}) and (contains(ItemName, '{search}') or contains(ItemCode, '{search}'))"
            else:
                filter_str = base_filter

            select_fields = [
                "ItemCode",
                "ItemName",
                "ItemType",
                "ItemsGroupCode",
                "InventoryUOM",
                "InventoryItem",
                "SalesItem",
                "QuantityOnStock",
                "Picture",
                "AttachmentEntry",
                "BarCode",
                "Valid",
                "Frozen",
                "SalesVATGroup",
                "AvgStdPrice",
                "MovingAveragePrice",
                "ItemPrices",
                "ItemWarehouseInfoCollection",
                "CreateDate",
                "UpdateDate",
                "UpdateTime",
                "Mainsupplier",
                "InventoryWeight",
                "PurchaseUnitWeight",
                "SalesUnitWeight",
                "U_PerPices",
                "U_Drawing",
                "User_Text",
                "U_QC",
                "U_V_Chk",
                "U_LM",
                "U_OLNG",
                "U_LPK",
                "U_LBL",
                "U_MC_OR_PT",
            ]

            all_items: List[Dict[str, Any]] = []
            skip = 0

            while top is None or len(all_items) < top:
                batch_limit = self._SAP_PAGE_SIZE if top is None else min(self._SAP_PAGE_SIZE, top - len(all_items))
                if batch_limit <= 0:
                    break
                response = self.client.query_items(
                    filter_str=filter_str,
                    select=select_fields,
                    top=batch_limit,
                    skip=skip,
                    orderby=orderby,
                )
                page = response.get("value", [])
                
                if not page:
                    # No more items - done
                    break
                
                all_items.extend(page)
                
                if len(page) < batch_limit:
                    # Last page (less than full page) - done
                    break
                
                skip += len(page)

            logger.info(f"Fetched {len(all_items)} available items from SAP")
            return all_items if top is None else all_items[:top]

        except Exception as e:
            logger.error(f"Error fetching items from SAP: {str(e)}")
            raise

    def get_item_by_code(
        self,
        item_code: str,
        select: Optional[List[str]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Get specific item by ItemCode

        Args:
            item_code: SAP ItemCode

        Returns:
            SAP Item or None
        """
        try:
            safe_code = quote(item_code, safe="")
            endpoint = f"Items('{safe_code}')"
            params = None
            if select:
                params = {"$select": ",".join(select)}
            item = self.client.get(endpoint, params=params)
            return item

        except SAPValidationError:
            return None
        except Exception as e:
            logger.error(f"Error fetching item {item_code}: {str(e)}")
            raise

    def get_item_by_barcode(self, barcode: str) -> Optional[Dict[str, Any]]:
        """
        Get item by barcode

        Args:
            barcode: Product barcode

        Returns:
            SAP Item or None
        """
        try:
            filter_str = f"BarCode eq '{barcode}'"
            response = self.client.query_items(filter_str=filter_str, top=1)

            items = response.get("value", [])
            return items[0] if items else None

        except Exception as e:
            logger.error(f"Error fetching item by barcode {barcode}: {str(e)}")
            raise

    def build_item_image_url(self, item_code: str, base_url: Optional[str] = None) -> str:
        """Build the backend proxy URL for an item's image."""
        safe_code = quote(item_code, safe="")
        path = f"/api/v1/products/{safe_code}/image"
        if base_url:
            return f"{base_url.rstrip('/')}{path}"
        return path

    def extract_image_url(
        self,
        sap_item: Dict[str, Any],
        base_url: Optional[str] = None,
    ) -> Optional[str]:
        """Extract an image URL for a product.

        Priority:
        1) Attachments (Items.AttachmentEntry -> Attachments2)
        2) Picture field (if SAP provides a usable URL/path)
        """
        item_code = sap_item.get("ItemCode")
        attachment_entry = sap_item.get("AttachmentEntry")
        picture = sap_item.get("Picture")

        if item_code:
            has_attachment = False
            if attachment_entry not in (None, "", 0, "0"):
                try:
                    has_attachment = int(attachment_entry) > 0
                except (TypeError, ValueError):
                    has_attachment = False

            # If either an attachment link exists OR Picture is populated, use our
            # backend proxy endpoint. The proxy will try attachments first, then
            # fall back to Picture if configured.
            if has_attachment or picture:
                return self.build_item_image_url(str(item_code), base_url=base_url)

        if picture:
            # Fallback if ItemCode is missing for some reason.
            return str(picture)

        return None

    def get_item_image_data(
        self,
        item_code: str,
        line_num: Optional[int] = None,
    ) -> tuple[bytes, str | None]:
        """Fetch item image bytes from SAP attachments.

        SAP links attachments via Items.AttachmentEntry -> Attachments2(AbsEntry).
        This selects the first image-like attachment line when possible.
        """
        attachments = self.client.get_item_attachments(item_code)
        if not attachments:
            raise SAPValidationError("No attachment found for item")

        abs_entry = (
            attachments.get("AbsEntry")
            or attachments.get("AbsoluteEntry")
            or attachments.get("AttachmentEntry")
        )
        if abs_entry is None:
            raise SAPValidationError("Attachment metadata missing AbsEntry/AbsoluteEntry")

        resolved_line = line_num
        chosen_ext: Optional[str] = None
        if resolved_line is None:
            lines = attachments.get("Attachments2_Lines") or attachments.get("Attachments2_LinesCollection") or []
            image_exts = {"jpg", "jpeg", "png", "gif", "webp", "bmp"}
            if isinstance(lines, list) and lines:
                selected = None
                for ln in lines:
                    ext = (ln.get("FileExtension") or "").lstrip(".").lower()
                    if ext in image_exts:
                        selected = ln
                        chosen_ext = ext
                        break
                if selected is None:
                    selected = lines[0]
                    chosen_ext = (selected.get("FileExtension") or "").lstrip(".").lower() or None
                resolved_line = selected.get("LineNum")

        data, content_type = self.client.get_attachment_data(int(abs_entry), resolved_line)

        if not content_type or content_type.startswith("application/octet-stream"):
            if chosen_ext:
                guessed = guess_type(f"x.{chosen_ext}")[0]
                if guessed:
                    content_type = guessed

        return data, content_type

    def extract_price(self, sap_item: Dict[str, Any]) -> float:
        """
        Extract price from SAP item.

        Strategy (first non-zero value wins):
        1. ItemPrices list – present when the expand is available
        2. AvgStdPrice    – moving-average / standard cost (scalar)
        3. LastSalePrice  – last invoice price (scalar)
        4. LastPurchasePrice – last PO price (scalar)

        Args:
            sap_item: SAP Item data

        Returns:
            Price or 0.0 if not found
        """
        # 1. Expanded ItemPrices collection (if available on this SAP version)
        item_prices = sap_item.get("ItemPrices") or sap_item.get("ItemPricesCollection") or []
        if isinstance(item_prices, list):
            for price_entry in item_prices:
                if price_entry.get("PriceList") == self.default_price_list:
                    price = price_entry.get("Price")
                    if price is not None:
                        return float(price)

        # 2-4. Scalar fallbacks
        for field in ("AvgStdPrice", "LastSalePrice", "LastPurchasePrice"):
            val = sap_item.get(field)
            if val is not None:
                try:
                    fval = float(val)
                    if fval > 0:
                        return fval
                except (TypeError, ValueError):
                    pass

        return 0.0

    def create_item(self, item_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create new item in SAP

        Args:
            item_data: Item fields (ItemCode, ItemName, BarCode, etc.)

        Returns:
            Created SAP Item
        """
        try:
            # Prepare item payload
            payload = {
                "ItemCode": item_data.get("item_code"),
                "ItemName": item_data["name"],
                "BarCode": item_data.get("barcode"),
                "ItemPrices": [
                    {
                        "PriceList": self.default_price_list,
                        "Price": item_data["price"],
                    }
                ],
            }

            # Add custom fields if provided
            if item_data.get("image"):
                payload["U_Image"] = item_data["image"]
            if item_data.get("category"):
                payload["U_SUBG"] = item_data["category"]
            if item_data.get("brand"):
                payload["U_Brand"] = item_data["brand"]

            result = self.client.post("Items", payload)
            logger.info(f"Created item in SAP: {result.get('ItemCode')}")

            return result

        except Exception as e:
            logger.error(f"Error creating item in SAP: {str(e)}")
            raise

    def update_item(self, item_code: str, update_data: Dict[str, Any]) -> bool:
        """
        Update existing item in SAP Business One Service Layer with two-way persistence validation.

        Args:
            item_code: SAP ItemCode
            update_data: Fields to update (including standard fields and UDFs)

        Returns:
            True if successful and verified
        """
        try:
            payload: Dict[str, Any] = {}

            if "name" in update_data:
                payload["ItemName"] = update_data["name"]

            if "barcode" in update_data:
                payload["BarCode"] = update_data["barcode"]

            if "price" in update_data:
                payload["ItemPrices"] = [
                    {
                        "PriceList": self.default_price_list,
                        "Price": update_data["price"],
                    }
                ]

            if "image" in update_data:
                payload["U_Image"] = update_data["image"]

            if "category" in update_data:
                payload["U_SUBG"] = update_data["category"]

            if "brand" in update_data:
                payload["U_Brand"] = update_data["brand"]

            # Stock Configuration: NT. WEIGHT -> InventoryWeight, PurchaseUnitWeight, SalesUnitWeight, U_PerPices
            if "nt_weight" in update_data and update_data["nt_weight"] is not None:
                w_val = round(max(0.0, float(update_data["nt_weight"])), 2)
                payload["InventoryWeight"] = w_val
                payload["PurchaseUnitWeight"] = w_val
                payload["SalesUnitWeight"] = w_val
                payload["U_PerPices"] = int(round(w_val))
            elif "InventoryWeight" in update_data and update_data["InventoryWeight"] is not None:
                w_val = round(max(0.0, float(update_data["InventoryWeight"])), 2)
                payload["InventoryWeight"] = w_val
                payload["PurchaseUnitWeight"] = w_val
                payload["SalesUnitWeight"] = w_val
                payload["U_PerPices"] = int(round(w_val))

            def _clean_yn_val(v: Any) -> str:
                if v is None:
                    return ""
                s = str(v).strip().upper()
                if s in ("Y", "YES", "TRUE", "1", "T"):
                    return "Y"
                if s in ("N", "NO", "FALSE", "0", "F"):
                    return "N"
                return ""

            # Stock Configuration: DRW. Y/N -> U_Drawing
            drw_val = update_data.get("drw_yn") if "drw_yn" in update_data else update_data.get("U_Drawing", update_data.get("drawing"))
            if drw_val is not None:
                c_drw = _clean_yn_val(drw_val)
                if c_drw:
                    payload["U_Drawing"] = c_drw

            # Stock Configuration: REMARKS -> User_Text
            for r_key in ("remark", "remarks", "User_Text", "UserText"):
                if r_key in update_data and update_data[r_key] is not None:
                    payload["User_Text"] = str(update_data[r_key]).strip()
                    break

            # Stock Configuration: QC -> U_QC
            qc_val = update_data.get("qc") if "qc" in update_data else update_data.get("U_QC")
            if qc_val is not None:
                c_qc = _clean_yn_val(qc_val)
                if c_qc:
                    payload["U_QC"] = c_qc

            # Stock Configuration: V CHK -> U_V_Chk
            vchk_val = update_data.get("v_chk") if "v_chk" in update_data else update_data.get("U_V_Chk")
            if vchk_val is not None:
                c_vchk = _clean_yn_val(vchk_val)
                if c_vchk:
                    payload["U_V_Chk"] = c_vchk

            # Stock Configuration: LM -> U_LM
            lm_val = update_data.get("lm") if "lm" in update_data else update_data.get("U_LM")
            if lm_val is not None:
                c_lm = _clean_yn_val(lm_val)
                if c_lm:
                    payload["U_LM"] = c_lm

            # Stock Configuration: OLNG -> U_OLNG
            olng_val = update_data.get("olng") if "olng" in update_data else update_data.get("U_OLNG")
            if olng_val is not None:
                c_olng = _clean_yn_val(olng_val)
                if c_olng:
                    payload["U_OLNG"] = c_olng

            # Stock Configuration: I PK / LPK -> U_LPK
            lpk_val = update_data.get("lpk") if "lpk" in update_data else (update_data.get("i_pk") if "i_pk" in update_data else update_data.get("U_LPK"))
            if lpk_val is not None:
                c_lpk = _clean_yn_val(lpk_val)
                if c_lpk:
                    payload["U_LPK"] = c_lpk

            # Stock Configuration: LBL -> U_LBL
            lbl_val = update_data.get("lbl") if "lbl" in update_data else update_data.get("U_LBL")
            if lbl_val is not None:
                c_lbl = _clean_yn_val(lbl_val)
                if c_lbl:
                    payload["U_LBL"] = c_lbl

            # Stock Configuration: MC OR PT -> U_MC_OR_PT
            mc_val = update_data.get("mc_or_pt") if "mc_or_pt" in update_data else (update_data.get("mc_pt") if "mc_pt" in update_data else update_data.get("U_MC_OR_PT"))
            if mc_val is not None:
                c_mc = _clean_yn_val(mc_val)
                if c_mc:
                    payload["U_MC_OR_PT"] = c_mc

            if not payload:
                logger.info(f"No SAP updatable fields in payload for item {item_code}")
                return True

            endpoint = f"Items('{item_code}')"
            self.client.patch(endpoint, payload)

            # Verification: Read-back from SAP Service Layer
            select_props = list(payload.keys())
            if "UpdateDate" not in select_props:
                select_props.append("UpdateDate")
            if "UpdateTime" not in select_props:
                select_props.append("UpdateTime")
            post_item = self.client.get(endpoint, params={"$select": ",".join(select_props)})

            for key, expected in payload.items():
                actual = post_item.get(key)
                if isinstance(expected, float):
                    if actual is None or abs(float(actual) - expected) > 0.01:
                        raise RuntimeError(f"Read-back mismatch for {key}: expected {expected}, got {actual}")
                elif isinstance(expected, int):
                    if actual is None or int(actual) != expected:
                        raise RuntimeError(f"Read-back mismatch for {key}: expected {expected}, got {actual}")
                else:
                    if str(actual or "").strip().upper() != str(expected or "").strip().upper():
                        raise RuntimeError(f"Read-back mismatch for {key}: expected '{expected}', got '{actual}'")

            logger.info(f"Updated and verified item in SAP: {item_code} ({list(payload.keys())})")
            return True

        except Exception as e:
            logger.error(f"Error updating item {item_code}: {str(e)}")
            raise

    def soft_delete_item(self, item_code: str) -> bool:
        """
        Soft delete item by marking as frozen (SAP best practice)

        Args:
            item_code: SAP ItemCode

        Returns:
            True if successful
        """
        try:
            endpoint = f"Items('{item_code}')"
            payload = {"Frozen": "tYES"}  # Mark as frozen

            self.client.patch(endpoint, payload)
            logger.info(f"Soft deleted item in SAP: {item_code}")

            return True

        except Exception as e:
            logger.error(f"Error soft deleting item {item_code}: {str(e)}")
            raise

    def get_item_price(
        self, item_code: str, price_list: Optional[int] = None
    ) -> Optional[float]:
        """
        Get item price from specific price list

        Args:
            item_code: SAP ItemCode
            price_list: Price list number (default from settings)

        Returns:
            Price or None
        """
        try:
            item = self.get_item_by_code(item_code)
            if not item:
                return None

            price_list_num = price_list or self.default_price_list
            item_prices = item.get("ItemPrices", [])

            for price_entry in item_prices:
                if price_entry.get("PriceList") == price_list_num:
                    return price_entry.get("Price")

            return None

        except Exception as e:
            logger.error(f"Error fetching item price: {str(e)}")
            return None

    def get_item_stock(self, item_code: str, warehouse: Optional[str] = None) -> float:
        """
        Get item stock quantity

        Args:
            item_code: SAP ItemCode
            warehouse: Warehouse code (optional)

        Returns:
            Stock quantity
        """
        try:
            item = self.get_item_by_code(item_code)
            if not item:
                return 0.0

            # If no specific warehouse, return total stock
            if not warehouse:
                return item.get("QuantityOnStock", 0.0)

            # Get warehouse-specific stock
            warehouses = item.get("ItemWarehouseInfoCollection", [])
            for wh in warehouses:
                if wh.get("WarehouseCode") == warehouse:
                    return wh.get("InStock", 0.0)

            return 0.0

        except Exception as e:
            logger.error(f"Error fetching item stock: {str(e)}")
            return 0.0
