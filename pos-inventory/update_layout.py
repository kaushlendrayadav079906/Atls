import sys

content = open('pos-frontend/src/components/Layout.tsx', 'r', encoding='utf-8').read()

# Add imports
if 'AlertsDrawer' not in content:
    content = content.replace(
        'import { logoutUser } from "../services/api";',
        'import { logoutUser } from "../services/api";\nimport AlertsDrawer from "./AlertsDrawer";\nimport { useAlerts } from "../hooks/useAlerts";'
    )

# Add state
if 'isAlertsOpen' not in content:
    content = content.replace(
        'const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);',
        'const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);\n  const [isAlertsOpen, setIsAlertsOpen] = useState(false);\n  const { data: alerts } = useAlerts(true);\n  const pendingAlertsCount = alerts ? alerts.length : 0;'
    )

# Add bell icon
bell_icon = '''
        <div className="p-4 border-t border-gray-100 bg-white space-y-3">
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <button
              onClick={() => setIsAlertsOpen(true)}
              className={`w-full flex items-center justify-center p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 ${
                pendingAlertsCount > 0
                  ? 'bg-amber-50 text-amber-900 hover:bg-amber-100'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <div className="relative">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {pendingAlertsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                  </span>
                )}
              </div>
              {!isSidebarCollapsed && (
                <span className="ml-3 font-medium text-sm">
                  Alerts {pendingAlertsCount > 0 && `(${pendingAlertsCount})`}
                </span>
              )}
            </button>
          )}
'''

content = content.replace(
    '<div className="p-4 border-t border-gray-100 bg-white space-y-3">',
    bell_icon
)

# Add Drawer to render tree
drawer_element = '''
      {/* Alerts Drawer */}
      <AlertsDrawer 
        isOpen={isAlertsOpen} 
        onClose={() => setIsAlertsOpen(false)} 
        isAdmin={user?.role === 'admin'}
      />
    </div>
'''
content = content.replace(
    '    </div>\n  );\n};\n\nexport default Layout;',
    drawer_element + '  );\n};\n\nexport default Layout;'
)

open('pos-frontend/src/components/Layout.tsx', 'w', encoding='utf-8').write(content)
