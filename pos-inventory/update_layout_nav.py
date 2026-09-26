import sys

content = open('pos-frontend/src/components/Layout.tsx', 'r', encoding='utf-8').read()

nav_link = '''
            {(user?.role === 'admin' || user?.role === 'manager') && (
              <NavLink to="/inventory-alerts" className={navLinkClass} onClick={closeMobileMenu}>
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {!isSidebarCollapsed && <span>Inventory Alerts</span>}
              </NavLink>
            )}
'''
if 'to="/inventory-alerts"' not in content:
    content = content.replace(
        '</span>\n              </NavLink>\n            )}',
        '</span>\n              </NavLink>\n            )}' + nav_link
    )
    open('pos-frontend/src/components/Layout.tsx', 'w', encoding='utf-8').write(content)
