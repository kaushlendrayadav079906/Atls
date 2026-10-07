content = open('Dashboard-Ui/src/pages/CustomersPage.tsx', encoding='utf-8').read()

# Add onClick to tr
content = content.replace('<tr key={`${customer.cardCode ?? \\\'customer\\\'}-${index}`} className=', 
                              '<tr onClick={() => setSelectedCardCode(customer.cardCode || null)} key={`${customer.cardCode ?? \\\'customer\\\'}-${index}`} className=')

# Remove unused variables
content = content.replace('const { data: profile, isLoading: profileLoading } = useQuery', 'const { data: profile } = useQuery')
content = content.replace('const { data: purchases, isLoading: purchasesLoading } = useQuery', 'const { data: purchases } = useQuery')
content = content.replace('const { data: returns, isLoading: returnsLoading } = useQuery', 'const { data: returns } = useQuery')

open('Dashboard-Ui/src/pages/CustomersPage.tsx', 'w', encoding='utf-8').write(content)
