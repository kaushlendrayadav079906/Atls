const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'production', 'ProductionOverviewPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add ChevronLeft, ChevronRight to lucide-react imports if not there
if (!content.includes('ChevronLeft')) {
  content = content.replace(/import \{([\s\S]*?)\} from 'lucide-react';/, "import { ChevronLeft, ChevronRight, $1 } from 'lucide-react';");
}

// 2. Add state hooks for pagination right after date_to
const stateHooks = `
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(5);
  
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsPageSize, setItemsPageSize] = useState(5);

  const [warehousePage, setWarehousePage] = useState(1);
  const [warehousePageSize, setWarehousePageSize] = useState(5);

  useEffect(() => {
    setOrdersPage(1);
    setItemsPage(1);
    setWarehousePage(1);
  }, [dateRange, branchId]);
`;

content = content.replace(/const queryFilters = \{ date_from, date_to, warehouse: branchId \};\s*\n/, `const queryFilters = { date_from, date_to, warehouse: branchId };\n${stateHooks}\n`);

// 3. Update useQuery keys
content = content.replace(
  /queryKey: \['production', 'orders', branchId, date_from, date_to\],[\s\n]*queryFn: \(\) => getProductionOrders\(\{ \.\.\.queryFilters, page: 1, page_size: 5 \}\),/g,
  `queryKey: ['production', 'orders', branchId, date_from, date_to, ordersPage, ordersPageSize],
    queryFn: () => getProductionOrders({ ...queryFilters, page: ordersPage, page_size: ordersPageSize }),`
);

// We need a helper for pagination footer
const paginationFooter = `
const PaginationFooter = ({ page, totalPages, totalItems, pageSize, setPage, setPageSize, itemName }: any) => {
  if (totalItems <= 5 && pageSize === 5 && page === 1) return null; // do not create meaningless pagination
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50 text-[13px]">
      <div className="text-slate-500">
        Showing <span className="font-medium text-slate-700">{Math.min((page - 1) * pageSize + 1, totalItems)}</span> to <span className="font-medium text-slate-700">{Math.min(page * pageSize, totalItems)}</span> of <span className="font-medium text-slate-700">{totalItems}</span> {itemName}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-slate-500">
          <span>Rows per page:</span>
          <select 
            value={pageSize} 
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="border-none bg-transparent outline-none font-medium text-slate-700 cursor-pointer"
          >
            {[5, 10, 20, 50].map(size => <option key={size} value={size}>{size}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setPage(p => Math.max(1, p - 1))} 
            disabled={page === 1}
            className="p-1 rounded text-slate-500 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-slate-600 font-medium px-2">Page {page} of {Math.max(1, totalPages)}</span>
          <button 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
            disabled={page >= totalPages}
            className="p-1 rounded text-slate-500 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
`;

if (!content.includes('PaginationFooter')) {
  content = content.replace(/export default function ProductionOverviewPage\(\) \{/, `${paginationFooter}\nexport default function ProductionOverviewPage() {`);
}

// 4. Update the render for Recent Orders
content = content.replace(
  /<\/table>\s*<\/div>\s*<\/div>\s*\{\/\* Production by Warehouse \*\/\}/,
  `</table>
              </div>
              <PaginationFooter 
                page={ordersPage} 
                totalPages={recentOrders?.total_pages || 1} 
                totalItems={recentOrders?.total || 0} 
                pageSize={ordersPageSize} 
                setPage={setOrdersPage} 
                setPageSize={setOrdersPageSize} 
                itemName="orders" 
              />
            </div>

            {/* Production by Warehouse */}`
);

// 5. Update Production by Warehouse
const warehouseRenderRegex = /warehouseData\?\.length \? \(\s*warehouseData\.map\(.*?\)\s*\) : \(/s;
const warehouseRenderMatch = content.match(warehouseRenderRegex);

if (warehouseRenderMatch && !content.includes('warehouseData.slice(')) {
  const replacement = `warehouseData?.length ? (
                      warehouseData.slice((warehousePage - 1) * warehousePageSize, warehousePage * warehousePageSize).map((wh, idx) => (`;
  content = content.replace(/warehouseData\?\.length \? \(\s*warehouseData\.map\(\(wh, idx\) => \(/s, replacement);

  content = content.replace(
    /<\/table>\s*<\/div>\s*<\/div>\s*<\/div>\s*\{\/\* Bottom row \*\/\}/,
    `</table>
              </div>
              <PaginationFooter 
                page={warehousePage} 
                totalPages={Math.ceil((warehouseData?.length || 0) / warehousePageSize)} 
                totalItems={warehouseData?.length || 0} 
                pageSize={warehousePageSize} 
                setPage={setWarehousePage} 
                setPageSize={setWarehousePageSize} 
                itemName="warehouses" 
              />
            </div>
          </div>

          {/* Bottom row */}`
  );
}

// 6. Update Top Produced Items
if (!content.includes('topItems.slice(')) {
  content = content.replace(
    /topItems\?\.length \? \(\s*topItems\.map\(\(item, idx\) => \(/s,
    `topItems?.length ? (
                      topItems.slice((itemsPage - 1) * itemsPageSize, itemsPage * itemsPageSize).map((item, idx) => (`
  );

  content = content.replace(
    /<\/table>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\);/,
    `</table>
              </div>
              <PaginationFooter 
                page={itemsPage} 
                totalPages={Math.ceil((topItems?.length || 0) / itemsPageSize)} 
                totalItems={topItems?.length || 0} 
                pageSize={itemsPageSize} 
                setPage={setItemsPage} 
                setPageSize={setItemsPageSize} 
                itemName="items" 
              />
            </div>
          </div>
        </>
      )}
    </div>
  );`
  );
}

fs.writeFileSync(filePath, content);
console.log("Pagination added");
