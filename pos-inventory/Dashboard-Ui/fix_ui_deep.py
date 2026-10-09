import os
import re

pages_dir = "src/pages/production"
pages = [
    "ProductionOverviewPage.tsx",
    "ProductionOrdersPage.tsx",
    "ProductionItemWisePage.tsx",
    "ProductionRejectionPage.tsx",
    "ProductionDateWisePage.tsx",
    "ProductionReportsPage.tsx"
]

for page in pages:
    path = os.path.join(pages_dir, page)
    if not os.path.exists(path):
        continue
        
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Fix DateRange type definition (handle any spacing)
    # e.g., type DateRange = 'today' | 'week' | 'month' | 'year' | 'custom';
    content = re.sub(
        r"type\s+DateRange\s*=\s*(?:'today'\s*\|\s*'week'\s*\|\s*'month'\s*\|\s*'year'\s*\|\s*'custom'|'month'\s*\|\s*'week'\s*\|\s*'custom'\s*\|\s*'year'\s*\|\s*'today'|'today'\s*\|\s*'week'\s*\|\s*'month'\s*\|\s*'year'\s*\|\s*'total'|'today'\s*\|\s*'week'\s*\|\s*'month'\s*\|\s*'year'\s*\|\s*'custom'\s*\|\s*'total')\s*;",
        "type DateRange = 'today' | 'week' | 'month' | 'year' | 'total';",
        content
    )

    # 2. Fix the duplicate/broken imports in ProductionOverviewPage.tsx
    if page == "ProductionOverviewPage.tsx":
        content = content.replace("import { useQuery } from '@tanstack/react-query';\nimport { useEffect, useState, useMemo } from '@tanstack/react-query';", "")
        content = content.replace("import { useEffect, useState, useMemo } from '@tanstack/react-query';", "")
        # Remove any other broken tanstack imports
        content = re.sub(r"import\s*\{\s*useEffect.*?\}\s*from\s*'@tanstack/react-query';\s*\n", "", content)
        content = re.sub(r"import\s*\{\s*useQuery,\s*useEffect\s*\}\s*from\s*'@tanstack/react-query';\s*\n", "import { useQuery } from '@tanstack/react-query';\n", content)
        # Ensure correct react imports
        if "useEffect" not in content[:content.find("from 'react'")]:
            content = content.replace("useState,", "useState, useEffect,")
            
    # 3. Completely remove the custom date picker block (it starts with {dateRange === 'custom' && ()
    # We will find the exact string to remove.
    # It usually looks like: {dateRange === 'custom' && ( ... )}
    # Let's remove any line containing setCustomFrom or setCustomTo or customFrom
    lines = content.split('\n')
    new_lines = []
    skip = False
    for i, line in enumerate(lines):
        if "{dateRange === 'custom'" in line:
            skip = True
            continue
        if skip and ("</button>" in line or "</div>" in line or ")} " in line or "}" in line):
            # We want to skip until the matching closing. This is brittle.
            # Instead, just skip lines that have input, setCustom, etc.
            pass
            
        if "setCustomFrom" in line or "customFrom" in line or "customTo" in line:
            # Drop lines referencing these
            if "dateRange === 'custom'" in line: # if it's the condition
                pass
            continue
            
        if skip and "RefreshCcw" in line:
            skip = False # we've gone too far
            
        if skip and "handleRefresh" in line:
            skip = False
            
        if not skip:
            new_lines.append(line)
            
    content = '\n'.join(new_lines)
    
    # 4. Remove dangling } or ) from the skipped block if any
    content = re.sub(r"\{\s*dateRange === 'custom' &&\s*\([\s\S]*?\}\)", "", content)

    # 5. Make sure button mapping is 'total' instead of 'custom'
    content = content.replace("['today', 'week', 'month', 'year', 'custom'] as const", "['today', 'week', 'month', 'year', 'total'] as const")

    # 6. Make sure useState('month') is DateRange
    content = re.sub(r"useState<DateRange>\(.*?\)", "useState<DateRange>('total')", content)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

print("UI fixed")
