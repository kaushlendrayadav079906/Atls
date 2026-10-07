import os

path = r'c:\Users\A\Documents\IB\Dashboard\New Dashboard\Atls\pos-inventory\Dashboard-Ui\src\pages\reports\SalesReportPage.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_colors = "const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];"
new_colors = """
  const getPaymentColor = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('cash')) return '#3b82f6';
    if (n.includes('card')) return '#a855f7';
    if (n.includes('upi') || n.includes('wallet')) return '#f59e0b';
    if (n.includes('credit')) return '#10b981';
    return '#94a3b8';
  };
"""
content = content.replace(old_colors, new_colors)
content = content.replace('fill={COLORS[index % COLORS.length]}', 'fill={getPaymentColor(entry.name)}')
content = content.replace('backgroundColor: COLORS[i % COLORS.length]', 'backgroundColor: getPaymentColor(item.name)')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
