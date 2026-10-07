content = open('Dashboard-Ui/src/pages/CustomersPage.tsx', encoding='utf-8').read()
content = content.replace('onClick={() => setSelectedCardCode(customer.cardCode || null)} className="rounded-lg border border-red-200', 'onClick={() => refetch()} className="rounded-lg border border-red-200')
open('Dashboard-Ui/src/pages/CustomersPage.tsx', 'w', encoding='utf-8').write(content)
