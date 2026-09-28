import re

file_path = r'c:\Users\A\Documents\IB\Dashboard\New Dashboard\Atls\pos-inventory\Dashboard-Ui\src\pages\Dashboard.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the Recent Sales full width with a grid containing Recent Sales and Top Products
target = r'''<div className="overflow-hidden rounded-\[22px\] border border-sky-900/80 bg-\[linear-gradient\(180deg,#0b1f3b_0%,#091d36_100%\)\] shadow-\[0_18px_40px_rgba\(15,23,42,0\.35\)\]">
                <div className="flex items-center justify-between border-b border-sky-900/80 p-4">'''

replacement = r'''<div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
              <div className="overflow-hidden rounded-[22px] border border-sky-900/80 bg-[linear-gradient(180deg,#0b1f3b_0%,#091d36_100%)] shadow-[0_18px_40px_rgba(15,23,42,0.35)]">
                <div className="flex items-center justify-between border-b border-sky-900/80 p-4">'''

content = content.replace(target, replacement)

# Now find the end of the Recent Sales table to close the div and add Top Products
end_target = r'''                  </table>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-\[1\.5fr_1fr\]">'''

end_replacement = r'''                  </table>
                </div>
              </div>

              <div className="overflow-hidden rounded-[22px] border border-sky-900/80 bg-[linear-gradient(180deg,#0b1f3b_0%,#091d36_100%)] shadow-[0_18px_40px_rgba(15,23,42,0.35)]">
                <div className="flex items-center justify-between border-b border-sky-900/80 p-4">
                  <div className="flex items-center gap-2 text-white">
                    <PackageSearch className="h-4 w-4 text-sky-300" />
                    <span className="text-[18px] font-semibold">Top Products</span>
                  </div>
                  <button className="text-sm font-medium text-sky-300">View all</button>
                </div>
                <div className="overflow-x-auto p-4">
                  <table className="min-w-full text-left text-sm text-sky-100">
                    <thead className="text-[11px] uppercase tracking-[0.12em] text-sky-200/70">
                      <tr>
                        <th className="pb-3 font-medium">#</th>
                        <th className="pb-3 font-medium">Product</th>
                        <th className="pb-3 text-right font-medium">Units Sold</th>
                        <th className="pb-3 text-right font-medium">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="space-y-2">
                      {(topProducts || []).slice(0, 5).map((prod, idx) => (
                        <tr key={idx} className="border-t border-sky-900/70">
                          <td className="py-3 text-sky-100/60">{idx + 1}</td>
                          <td className="py-3 text-white flex items-center gap-2">
                            <div className="h-8 w-8 rounded bg-sky-900/50"></div>
                            {prod.itemName}
                          </td>
                          <td className="py-3 text-right text-sky-100">{prod.quantitySold}</td>
                          <td className="py-3 text-right font-semibold text-white">{money.format(prod.salesAmount || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">'''

content = content.replace(end_target, end_replacement)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
