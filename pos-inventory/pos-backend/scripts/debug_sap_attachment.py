from __future__ import annotations

import os
import sys
from urllib.parse import quote

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from app.services.sap.client import get_sap_client
from app.services.sap.items_service import SAPItemsService


def main(item_code: str) -> int:
    c = get_sap_client()
    c.login()

    if item_code.lower() in {"scan", "--scan"}:
        print("== Sampling first 100 Items and counting AttachmentEntry != null ==")
        resp = c.query_items(
            select=["ItemCode", "ItemName", "AttachmentEntry", "Picture"],
            top=100,
            skip=0,
        )
        rows = resp.get("value", [])
        with_attach = [r for r in rows if r.get("AttachmentEntry") not in (None, 0, "", "0")]
        with_pic = [r for r in rows if r.get("Picture")]
        print("Total sampled:", len(rows))
        print("With AttachmentEntry:", len(with_attach))
        print("With Picture:", len(with_pic))
        for r in with_attach[:20]:
            print("ATTACH:", r.get("ItemCode"), r.get("AttachmentEntry"), r.get("ItemName"))
        for r in with_pic[:10]:
            print("PICTURE:", r.get("ItemCode"), r.get("Picture"))
        return 0

    print(f"== Item raw: {item_code} ==")
    item = c.get(f"Items('{item_code}')")
    keys = [k for k in item.keys() if ("Attach" in k) or ("Atc" in k) or (k in ("ItemCode", "ItemName"))]
    print("Keys:", sorted(keys))
    print("ItemCode:", item.get("ItemCode"))
    print("ItemName:", item.get("ItemName"))
    print("Picture:", item.get("Picture"))
    print("AttachmentEntry:", item.get("AttachmentEntry"))
    print("AtcEntry:", item.get("AtcEntry"))
    print("AttachmentsEntry:", item.get("AttachmentsEntry"))

    print("\n== Item $select AttachmentEntry ==")
    item_sel = c.get(f"Items('{item_code}')", params={"$select": "ItemCode,ItemName,AttachmentEntry"})
    print(item_sel)

    print("\n== get_item_attachments() ==")
    att = c.get_item_attachments(item_code)
    print(att)

    if att:
        lines = att.get("Attachments2_Lines") or att.get("Attachments2_LinesCollection") or []
        print("Attachment lines count:", len(lines) if isinstance(lines, list) else "(not a list)")
        if isinstance(lines, list):
            for ln in lines[:5]:
                print("Line:", {k: ln.get(k) for k in ("LineNum", "FileName", "FileExtension", "SourcePath") if k in ln})

    print("\n== SAPItemsService.get_item_image_data() ==")
    svc = SAPItemsService()
    try:
        data, ctype = svc.get_item_image_data(item_code)
        print("Downloaded bytes:", len(data))
        print("Content-Type:", ctype)
        print("Magic bytes:", data[:16])
    except Exception as exc:
        print("ERROR:", type(exc).__name__, str(exc))
        # Continue with extra inspection

    picture = item.get("Picture")
    if picture:
        print("\n== Try SAP Images endpoint for Picture ==")
        encoded = quote(str(picture), safe="")
        candidates = [
            f"Images('{encoded}')/$value",
            f"Images('{encoded}')",
        ]
        for ep in candidates:
            try:
                data, ctype = c.get_binary(ep)
                print("Images endpoint:", ep)
                print("Downloaded bytes:", len(data))
                print("Content-Type:", ctype)
                print("Magic bytes:", data[:16])
                break
            except Exception as img_exc:
                print("Failed:", ep, type(img_exc).__name__, str(img_exc))
                continue

    return 0


def inspect_attachments2(c, item_code: str) -> None:
    for entity in ("Attachments2", "Attachments"):
        print(f"\n== {entity} sample ==")
        try:
            resp = c.get(entity, params={"$top": 1})
            vals = resp.get("value", [])
            print(f"{entity} rows:", len(vals))
            if vals:
                a = vals[0]
                print("Top row keys:", sorted(list(a.keys()))[:60])
        except Exception as exc:
            print(f"{entity} sample failed:", type(exc).__name__, str(exc))

    print("\n== Attachments2 search by filename (any) ==")
    try:
        # Try to find an Attachments2 record where any line matches the item code.
        # Some systems name the file with the item code (e.g., ELANN026.jpg).
        flt = f"Attachments2_Lines/any(d: d/FileName eq '{item_code}')"
        resp2 = c.get(
            "Attachments2",
            params={"$top": 5, "$filter": flt, "$orderby": "AbsEntry desc"},
        )
        vals2 = resp2.get("value", [])
        print("Matches:", len(vals2))
        for a in vals2:
            print("Match AbsEntry:", a.get("AbsEntry"))
    except Exception as exc:
        print("Attachments2 any() filter failed:", type(exc).__name__, str(exc))

    print("\n== $metadata probe (search for image/picture entities) ==")
    try:
        data, ctype = c.get_binary("$metadata", accept="application/xml")
        text = data.decode("utf-8", errors="ignore")
        print("$metadata length:", len(text))
        print("Occurrences: Attachments2=", text.count("Attachments2"), ", Attachments=", text.count("Attachments"), ", Image=", text.lower().count("image"))

        needles = [
            "EntitySet Name=\"Images\"",
            "EntitySet Name=\"Attachments2\"",
            "EntitySet Name=\"Attachments\"",
            "Picture",
            "AttachmentEntry",
            "AtcEntry",
            "GetImage",
            "GetPicture",
            "Attachment",
        ]
        for n in needles:
            idx = text.find(n)
            print(n, "->", "FOUND" if idx != -1 else "not found")
            if idx != -1:
                start = max(0, idx - 200)
                end = min(len(text), idx + 400)
                snippet = text[start:end].replace("\r", "").replace("\n", " ")
                print("  snippet:", snippet)
    except Exception as exc:
        print("$metadata probe failed:", type(exc).__name__, str(exc))


if __name__ == "__main__":
    code = sys.argv[1] if len(sys.argv) > 1 else "ELANN026"
    rc = main(code)
    try:
        client = get_sap_client()
        client.login()
        inspect_attachments2(client, code)
    except Exception as exc:
        print("\n== Extra inspection failed ==")
        print(type(exc).__name__, str(exc))
    raise SystemExit(rc)
