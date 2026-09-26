import sys
content = open('pos-frontend/src/pages/atlas/AtlasDashboard.tsx', 'r', encoding='utf-8').read()

# Add imports
content = content.replace(
    'useAtlasReturnsSummary,\n} from \'../../hooks/useAtlas\';',
    'useAtlasReturnsSummary,\n  useAtlasTopCustomers,\n  useAtlasProductVelocity,\n} from \'../../hooks/useAtlas\';'
)

# Add hooks
hook_addition = '''  const returnsQuery = useAtlasReturnsSummary(dateRange, undefined, undefined, selectedBranch || undefined);
  const topCustomersQuery = useAtlasTopCustomers(dateRange, undefined, undefined, selectedBranch || undefined);
  const productVelocityQuery = useAtlasProductVelocity(dateRange, undefined, undefined, selectedBranch || undefined);'''

content = content.replace(
    '  const returnsQuery = useAtlasReturnsSummary(dateRange, undefined, undefined, selectedBranch || undefined);',
    hook_addition
)

# Add UI sections
ui_addition = """
      {/* Top Customers & Product Velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Top Customers</h2>
          {topCustomersQuery.isLoading ? (
            <div className="h-48 flex items-center justify-center"><div className="animate-pulse text-gray-400">Loading...</div></div>
          ) : topCustomersQuery.isError ? (
            <div className="h-48 flex items-center justify-center text-red-500">Failed to load top customers</div>
          ) : topCustomersQuery.data && topCustomersQuery.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2">Customer</th>
                    <th className="px-4 py-2 text-right">Invoices</th>
                    <th className="px-4 py-2 text-right">Gross Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomersQuery.data.map((c) => (
                    <tr key={c.customerCode} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{c.customerName || c.customerCode}</td>
                      <td className="px-4 py-2 text-right">{c.invoiceCount}</td>
                      <td className="px-4 py-2 text-right">${c.totalSales.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">No customers found</div>
          )}
        </div>

        {/* Product Velocity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Product Velocity</h2>
          {productVelocityQuery.isLoading ? (
            <div className="h-48 flex items-center justify-center"><div className="animate-pulse text-gray-400">Loading...</div></div>
          ) : productVelocityQuery.isError ? (
            <div className="h-48 flex items-center justify-center text-red-500">Failed to load product velocity</div>
          ) : productVelocityQuery.data && productVelocityQuery.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2">Product</th>
                    <th className="px-4 py-2 text-right">Qty Sold</th>
                    <th className="px-4 py-2 text-right">Gross Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {productVelocityQuery.data.map((p) => (
                    <tr key={p.itemCode} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{p.itemName || p.itemCode}</td>
                      <td className="px-4 py-2 text-right">{p.quantitySold.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">${p.salesAmount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">No products found</div>
          )}
        </div>
      </div>
"""

content = content.replace(
    '    </div>\n  );\n};\n\nexport default AtlasDashboard;',
    ui_addition + '\n    </div>\n  );\n};\n\nexport default AtlasDashboard;'
)

open('pos-frontend/src/pages/atlas/AtlasDashboard.tsx', 'w', encoding='utf-8').write(content)
