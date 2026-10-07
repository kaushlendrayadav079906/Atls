import os
import re

with open('build_inventory_ui.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(r'\b\w', r'\\b\\w')
content = re.sub(r"open\(([^,]+),\s*['\"](w)['\"]\)", r"open(\1, '\2', encoding='utf-8')", content)
content = re.sub(r"open\(([^,]+),\s*['\"](r)['\"]\)", r"open(\1, '\2', encoding='utf-8')", content)

with open('build_inventory_ui2.py', 'w', encoding='utf-8') as f:
    f.write(content)
