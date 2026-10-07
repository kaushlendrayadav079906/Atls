from datetime import datetime, date, timedelta
from typing import List, Dict, Any
from collections import defaultdict
import calendar

def format_hour(hr: int) -> str:
    am_pm = "AM" if hr < 12 else "PM"
    h = hr % 12
    if h == 0:
        h = 12
    return f"{h:02d} {am_pm}"

def _compute_dynamic_trend(invoices: List[Dict[str, Any]], range_str: str, start_date: date, end_date: date) -> Dict[str, Any]:
    # Determine bounds
    actual_min_date = None
    actual_max_date = None
    if invoices:
        dates = [inv.get("DocDate") for inv in invoices if inv.get("DocDate")]
        if dates:
            actual_min_date = min(dates)[:10]
            actual_max_date = max(dates)[:10]
            
    if actual_min_date:
        d_min = datetime.strptime(actual_min_date, "%Y-%m-%d").date()
        d_max = datetime.strptime(actual_max_date, "%Y-%m-%d").date()
    else:
        d_min = start_date
        d_max = end_date

    span_days = (d_max - d_min).days + 1

    if range_str == "daily":
        group_by = "hour"
    elif range_str == "weekly":
        group_by = "day"
    elif range_str == "monthly":
        group_by = "day"
    elif range_str == "yearly":
        group_by = "month"
    elif range_str == "all_time":
        if span_days <= 31:
            group_by = "day"
        elif span_days <= 365:
            group_by = "month"
        else:
            group_by = "year"
    else:
        group_by = "day"

    # Generate buckets
    buckets = {}
    
    if group_by == "hour":
        # Extract hours
        hours = []
        for inv in invoices:
            doc_time = inv.get("DocTime")
            if doc_time is not None:
                try:
                    hr = int(doc_time) // 100
                    hours.append(hr)
                except ValueError:
                    pass
        min_hr = min(hours) if hours else 9
        max_hr = max(hours) if hours else 18
        if max_hr < min_hr: max_hr = min_hr
        
        for hr in range(min_hr, max_hr + 1):
            key = f"{hr:02d}"
            buckets[key] = {"label": format_hour(hr), "sales": 0.0, "invoice_count": 0}
            
    elif group_by == "day":
        if range_str == "weekly":
            # get monday to sunday of the start_date week
            # start_date might already be monday
            curr = start_date
            while curr.weekday() > 0:
                curr -= timedelta(days=1)
            for i in range(7):
                d = curr + timedelta(days=i)
                key = d.strftime("%Y-%m-%d")
                buckets[key] = {"label": d.strftime("%a"), "sales": 0.0, "invoice_count": 0}
        elif range_str == "monthly":
            # get 1st to last day of month
            curr = start_date.replace(day=1)
            _, last_day = calendar.monthrange(curr.year, curr.month)
            for i in range(1, last_day + 1):
                d = curr.replace(day=i)
                key = d.strftime("%Y-%m-%d")
                # format: "1 Oct"
                buckets[key] = {"label": f"{i} {d.strftime('%b')}", "sales": 0.0, "invoice_count": 0}
        else:
            # fill from d_min to d_max
            curr = d_min
            while curr <= d_max:
                key = curr.strftime("%Y-%m-%d")
                buckets[key] = {"label": curr.strftime("%d %b"), "sales": 0.0, "invoice_count": 0}
                curr += timedelta(days=1)
                
    elif group_by == "month":
        if range_str == "yearly":
            for i in range(1, 13):
                key = f"{start_date.year}-{i:02d}"
                buckets[key] = {"label": calendar.month_abbr[i], "sales": 0.0, "invoice_count": 0}
        else:
            # from min_month to max_month
            curr_y, curr_m = d_min.year, d_min.month
            end_y, end_m = d_max.year, d_max.month
            while (curr_y < end_y) or (curr_y == end_y and curr_m <= end_m):
                key = f"{curr_y}-{curr_m:02d}"
                buckets[key] = {"label": f"{calendar.month_abbr[curr_m]} {curr_y}", "sales": 0.0, "invoice_count": 0}
                curr_m += 1
                if curr_m > 12:
                    curr_m = 1
                    curr_y += 1
                    
    elif group_by == "year":
        curr_y = d_min.year
        end_y = d_max.year
        while curr_y <= end_y:
            key = str(curr_y)
            buckets[key] = {"label": str(curr_y), "sales": 0.0, "invoice_count": 0}
            curr_y += 1

    # Populate data
    for inv in invoices:
        raw_date = str(inv.get("DocDate") or "")[:10]
        if not raw_date: continue
        
        doc_time = inv.get("DocTime")
        hr_key = "00"
        if doc_time is not None:
            try:
                hr = int(doc_time) // 100
                hr_key = f"{hr:02d}"
            except ValueError:
                pass
                
        if group_by == "hour":
            key = hr_key
        elif group_by == "day":
            key = raw_date
        elif group_by == "month":
            key = raw_date[:7]
        elif group_by == "year":
            key = raw_date[:4]
            
        if key in buckets:
            buckets[key]["sales"] += float(inv.get("DocTotal") or 0)
            buckets[key]["invoice_count"] += 1
        else:
            # if out of predefined range (should rarely happen except 'all_time'), dynamically add
            if range_str == "all_time":
                label = key
                if group_by == "day":
                    try:
                        dt = datetime.strptime(key, "%Y-%m-%d")
                        label = dt.strftime("%d %b")
                    except: pass
                elif group_by == "month":
                    try:
                        y, m = key.split("-")
                        label = f"{calendar.month_abbr[int(m)]} {y}"
                    except: pass
                buckets[key] = {"label": label, "sales": float(inv.get("DocTotal") or 0), "invoice_count": 1}

    # sort buckets
    sorted_keys = sorted(buckets.keys())
    trend = []
    for k in sorted_keys:
        trend.append({
            "period": k,
            "label": buckets[k]["label"],
            "sales": round(buckets[k]["sales"], 2),
            "invoice_count": buckets[k]["invoice_count"]
        })
        
    total_sales = sum(float(inv.get("DocTotal") or 0) for inv in invoices)
    total_invoices = len(invoices)
    unique_customers = len(set(str(inv.get("CardCode") or "") for inv in invoices if inv.get("CardCode")))
    aov = round(total_sales / total_invoices, 2) if total_invoices else 0.0

    # compute payment breakdown
    payment_map = defaultdict(lambda: {"total": 0.0, "count": 0})
    for inv in invoices:
        pm = str(inv.get("PaymentMethod") or "unknown").strip().lower()
        if not pm or pm == "none":
            pm = "unknown"
        payment_map[pm]["total"] += float(inv.get("DocTotal") or 0)
        payment_map[pm]["count"] += 1
    
    payment_breakdown = [
        {"method": k, "total": round(v["total"], 2), "billCount": v["count"]}
        for k, v in payment_map.items()
    ]
    payment_breakdown.sort(key=lambda x: x["total"], reverse=True)

    return {
        "range": range_str,
        "group_by": group_by,
        "start_date": start_date.strftime("%Y-%m-%d"),
        "end_date": end_date.strftime("%Y-%m-%d"),
        "total_sales": round(total_sales, 2),
        "total_invoices": total_invoices,
        "total_customers": unique_customers,
        "average_order_value": aov,
        "payment_breakdown": payment_breakdown,
        "trend": trend
    }
