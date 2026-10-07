import os

path = r'c:\Users\A\Documents\IB\Dashboard\New Dashboard\Atls\pos-inventory\Dashboard-Ui\src\pages\reports\SalesReportPage.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace handleRangeChange
old_hook = """  const handleRangeChange = (newRange: string) => {
    setRange(newRange);
    setChartRange(newRange);
    setAppliedFilters(prev => ({ ...prev, range: newRange }));
    setPage(1);
  };"""
content = content.replace(old_hook, '')
content = content.replace('onClick={() => handleRangeChange(p)}', 'onClick={() => setChartRange(p)}')
content = content.replace('onChange={(e) => handleRangeChange(e.target.value)}', 'onChange={(e) => setDonutRange(e.target.value)}')

content = content.replace('const [chartRange, setChartRange] = useState(\'yearly\');', 'const [chartRange, setChartRange] = useState(\'yearly\');\n  const [donutRange, setDonutRange] = useState(\'yearly\');')

donut_query = """  const { data: donutOverview, isLoading: loadingDonut } = useQuery({
    queryKey: ['donutOverview', appliedFilters, donutRange],
    queryFn: () => atlasApi.getOverview(appliedFilters.branchId, donutRange, appliedFilters.customer, appliedFilters.category, appliedFilters.paymentMethod, appliedFilters.fromDate || undefined, appliedFilters.toDate || undefined),
    retry: 1,
  });"""
content = content.replace('const { data: overviewData', donut_query + '\n\n  const { data: overviewData')

old_apply = """  const handleApplyFilters = () => {
    setAppliedFilters({
      range,
      fromDate,
      toDate,
      branchId: branchId || undefined,
      customer,
      category,
      paymentMethod,
      groupBy
    });
    setChartRange(range);
    setPage(1);
  };"""
new_apply = """  const handleApplyFilters = () => {
    setAppliedFilters({
      range,
      fromDate,
      toDate,
      branchId: branchId || undefined,
      customer,
      category,
      paymentMethod,
      groupBy
    });
    setChartRange(range);
    setDonutRange(range);
    setPage(1);
  };"""
content = content.replace(old_apply, new_apply)

content = content.replace('setChartRange(DEFAULT_RANGE);', 'setChartRange(DEFAULT_RANGE);\n    setDonutRange(DEFAULT_RANGE);')
content = content.replace('const paymentBreakdown = overviewData?.paymentBreakdown ?? [];', 'const paymentBreakdown = donutOverview?.paymentBreakdown ?? [];')
content = content.replace('loadingOverview ? (', 'loadingDonut ? (')

# Also fix the chart header select
old_select = '<select value={chartRange} onChange={(e) => setDonutRange(e.target.value)}'
new_select = '<select value={donutRange} onChange={(e) => setDonutRange(e.target.value)}'
content = content.replace(old_select, new_select)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
