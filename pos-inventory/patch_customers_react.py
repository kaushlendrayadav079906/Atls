import re

content = open('Dashboard-Ui/src/pages/CustomersPage.tsx', encoding='utf-8').read()

# Add profile, purchases, returns queries
hook_injection = """  const [selectedCardCode, setSelectedCardCode] = useState<string | null>(null);

  const selectedCustomer = useMemo(
    () => filteredCustomers.find((c) => c.cardCode === selectedCardCode) || filteredCustomers[0] || null,
    [filteredCustomers, selectedCardCode]
  );
  
  const currentCardCode = selectedCustomer?.cardCode;

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['customer-profile', currentCardCode],
    queryFn: () => currentCardCode ? customersApi.getCustomerProfile(currentCardCode) : null,
    enabled: !!currentCardCode,
  });

  const { data: purchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ['customer-purchases', currentCardCode],
    queryFn: () => currentCardCode ? customersApi.getCustomerPurchases(currentCardCode) : null,
    enabled: !!currentCardCode,
  });

  const { data: returns, isLoading: returnsLoading } = useQuery({
    queryKey: ['customer-returns', currentCardCode],
    queryFn: () => currentCardCode ? customersApi.getCustomerReturns(currentCardCode) : null,
    enabled: !!currentCardCode,
  });
"""

# Find `const selectedCustomer = filteredCustomers[0] ?? null;` and replace it
content = content.replace('const selectedCustomer = filteredCustomers[0] ?? null;', hook_injection)

# In the table, we need to set selectedCardCode on click
content = content.replace('onClick={() => setSelectedCustomer(customer)}', 'onClick={() => setSelectedCardCode(customer.cardCode || null)}')

# Update row highlight logic:
content = content.replace("selectedCustomer?.cardCode === customer.cardCode ? 'bg-blue-50' : 'hover:bg-slate-50'", "currentCardCode === customer.cardCode ? 'bg-blue-50' : 'hover:bg-slate-50'")
content = content.replace("onClick={() => setSelectedCardCode", "onClick={() => setSelectedCardCode(customer.cardCode || null)} //")
content = re.sub(r'onClick=\{[^\}]+\}', 'onClick={() => setSelectedCardCode(customer.cardCode || null)}', content, count=1)

# Now add onClick to the row if it doesn't exist
if 'onClick={() => setSelectedCardCode' not in content:
    content = content.replace('<tr key={`${customer.cardCode ?? \'customer\'}-${index}`} className=', 
                              '<tr onClick={() => setSelectedCardCode(customer.cardCode || null)} key={`${customer.cardCode ?? \'customer\'}-${index}`} className=')


# Update Profile Data Rendering
content = content.replace('value={selectedCustomer?.cardName || \'Jane Smith\'}', 'value={profile?.cardName || selectedCustomer?.cardName || "-"}')
content = content.replace('value={selectedCustomer?.phone || \'+91 98765 43210\'}', 'value={profile?.phone || selectedCustomer?.phone || selectedCustomer?.whatsappNumber || "-"}')
content = content.replace('value={selectedCustomer?.email || \'jane.smith@gmail.com\'}', 'value={profile?.email || selectedCustomer?.email || "-"}')
content = content.replace('value={selectedCustomer?.whatsappNumber || \'123 MG Road, Bangalore 560001, Karnataka, India\'}', 'value={profile?.address || "-"}')
content = content.replace('{selectedCustomer?.cardName || \'Jane Smith\'}', '{profile?.cardName || selectedCustomer?.cardName || "-"}')
content = content.replace('{selectedCustomer?.cardCode || \'CUS-1001\'}', '{profile?.cardCode || selectedCustomer?.cardCode || "-"}')
content = content.replace('{selectedCustomer?.cardName || \'Unknown customer\'}', '{profile?.cardName || selectedCustomer?.cardName || "-"}')
content = content.replace('{selectedCustomer?.cardCode || \'\'}', '{profile?.cardCode || selectedCustomer?.cardCode || "-"}')
content = content.replace('value="Retail"', 'value={profile?.cardType || "Retail"}')
content = content.replace('value="Active"', 'value={profile?.status || "Active"}')
content = content.replace('label="Registered On" value=""', 'label="Registered On" value={profile?.registeredOn ? new Date(profile.registeredOn).toLocaleDateString() : "-"}')
content = content.replace('label="Last Purchase" value=""', 'label="Last Purchase" value={profile?.lastPurchase ? new Date(profile.lastPurchase).toLocaleDateString() : "-"}')
content = content.replace('value="Main Branch (WH-001)"', 'value={profile?.preferredBranch || "-"}')
content = content.replace('label="Preferred Branch" value="-"', 'label="Preferred Branch" value={profile?.preferredBranch || "-"}')
content = content.replace('value="4"', 'value={profile?.recentInvoicesCount?.toString() || "0"}')
content = content.replace('value="2"', 'value={profile?.recentReturnsCount?.toString() || "0"}')

# Update Purchases/Returns Tabs counts
content = content.replace('Purchases (12)', 'Purchases ({purchases?.length || 0})')
content = content.replace('Returns (2)', 'Returns ({returns?.length || 0})')

# KPIs
content = content.replace('value={String(customers.length || 0)}', 'value={String(insights?.totalCustomers || 0)}')

open('Dashboard-Ui/src/pages/CustomersPage.tsx', 'w', encoding='utf-8').write(content)
