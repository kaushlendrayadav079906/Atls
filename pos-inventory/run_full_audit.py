import os
import re
import json

def audit_project():
    workspace = r"c:\Users\A\Documents\IB\Dashboard\New Dashboard\Atls\pos-inventory"
    docs_dir = os.path.join(workspace, "docs")
    if not os.path.exists(docs_dir):
        os.makedirs(docs_dir)
        
    audit_file = os.path.join(docs_dir, "FULL_PROJECT_BUG_AUDIT.md")
    
    findings = []
    
    # Simple recursive search for hardcoded data
    hardcoded_terms = [
        "Amazon", "AMIK KR", "Kaushal", "CUS001", "CUS002", "CUS011", 
        "GZB", "SH", "WH-001", "Main Branch", "INV-1", "INV-2", "INV-3", 
        "₹20K", "₹15K", "₹0.00", "0000000000", "1234567890",
        "mock", "dummy"
    ]
    
    exclude_dirs = ['.git', 'node_modules', 'venv', '__pycache__', 'dist', 'build']
    
    for root, dirs, files in os.walk(workspace):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            if file.endswith(('.ts', '.tsx', '.js', '.jsx', '.py')):
                path = os.path.join(root, file)
                rel_path = os.path.relpath(path, workspace)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                        for i, line in enumerate(lines):
                            for term in hardcoded_terms:
                                if term in line and "test" not in rel_path.lower():
                                    if "mock" in term.lower() and ("test" in rel_path or "mock" in rel_path):
                                        continue
                                    findings.append({
                                        "level": "HIGH",
                                        "type": "Hardcoded Data",
                                        "file": rel_path,
                                        "line": i + 1,
                                        "desc": f"Found '{term}' hardcoded"
                                    })
                except Exception as e:
                    pass

    # Basic API audit checks
    # Look for empty array returns except blocks
    
    with open(audit_file, 'w', encoding='utf-8') as f:
        f.write("# FULL PROJECT BUG AUDIT\n\n")
        f.write("## Findings\n\n")
        f.write("| Level | Type | File | Line | Description |\n")
        f.write("|-------|------|------|------|-------------|\n")
        for finding in findings:
            f.write(f"| {finding['level']} | {finding['type']} | `{finding['file']}:{finding['line']}` | {finding['line']} | {finding['desc']} |\n")
            
if __name__ == '__main__':
    audit_project()
