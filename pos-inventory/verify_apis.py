import requests

def run():
    print('Checking APIs...')
    try:
        r = requests.post('http://127.0.0.1:3001/api/v1/auth/login', data={'username': 'admin', 'password': 'password'})
        token = r.json().get('access_token')
    except Exception as e:
        print('Could not login:', e)
        return
        
    headers = {'Authorization': f'Bearer {token}'}
    params = {'range': 'monthly'}
    
    print('\n--- OVERVIEW ---')
    print(requests.get('http://127.0.0.1:3001/api/v1/reports/payments/overview', headers=headers, params=params).json())
    
    print('\n--- DISTRIBUTION ---')
    print(requests.get('http://127.0.0.1:3001/api/v1/reports/payments/distribution', headers=headers, params=params).json())
    
    print('\n--- TREND ---')
    print(requests.get('http://127.0.0.1:3001/api/v1/reports/payments/trend', headers=headers, params=params).json())
    
    print('\n--- TRANSACTIONS (1) ---')
    txn = requests.get('http://127.0.0.1:3001/api/v1/reports/payments/transactions', headers=headers, params=params).json()
    items = txn.get('items', [])
    print(f'Total: {txn.get("total")}')
    if items:
        print(items[0])
    
run()
