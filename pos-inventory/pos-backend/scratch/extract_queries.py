import re

with open("app/services/stock_configuration_service.py", "r", encoding="utf-8") as f:
    content = f.read()

# Find multiline strings that contain SQL
pattern = re.compile(r'("""[\s\S]*?"""|\'\'\'[\s\S]*?\'\'\')')
matches = pattern.findall(content)

keywords = ["SELECT", "INSERT INTO", "UPDATE", "CREATE TABLE", "ALTER TABLE"]
for i, m in enumerate(matches):
    if any(k in m.upper() for k in keywords):
        # find line number
        pos = content.find(m)
        line_num = content[:pos].count("\n") + 1
        print(f"==================== QUERY #{i+1} at Line {line_num} ====================")
        # print first 25 lines
        lines = m.strip().splitlines()
        print("\n".join(lines[:30]))
        if len(lines) > 30:
            print(f"... ({len(lines)-30} more lines) ...")
        print()
