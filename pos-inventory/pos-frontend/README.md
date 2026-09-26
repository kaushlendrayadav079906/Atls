# POS Frontend - Retail Manager

A modern, responsive Point of Sale (POS) system built with React, TypeScript, and Redux Toolkit.

## 🚀 Features

### Dashboard
- **Real-time Sales Metrics**: Today's total sales, bill count, and average sale
- **Quick Actions**: Fast navigation to POS and Product Management
- **Responsive Cards**: Clean, modern UI with color-coded metrics

### Product Management
- **Full CRUD Operations**: Add, Edit, Delete products
- **Real-time Search**: Filter products by name or barcode
- **Stock Management**: Track inventory with low-stock warnings
- **Loading States**: Smooth user experience with spinners during operations

### POS (Point of Sale)
- **Barcode Scanner Support**: Instant product lookup via barcode input
- **Shopping Cart**: Add, update quantity, remove items
- **Auto-calculation**: Real-time subtotal and total calculation
- **Receipt Preview**: Digital receipt display after checkout
- **Keyboard-friendly**: Optimized for barcode scanner workflow

## 🛠️ Tech Stack

- **Frontend Framework**: React 19.2
- **Build Tool**: Vite 7.3
- **Language**: TypeScript
- **State Management**: Redux Toolkit
- **Routing**: React Router DOM 7.13
- **HTTP Client**: Axios
- **Styling**: Tailwind CSS 4.1
- **Code Quality**: ESLint

## 📦 Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## 🏗️ Project Structure

```
src/
├── app/
│   ├── store.ts          # Redux store configuration
│   └── hooks.ts          # Typed Redux hooks
├── features/
│   ├── products/
│   │   └── productsSlice.ts   # Products state & async actions
│   ├── cart/
│   │   └── cartSlice.ts       # Cart state & actions
│   └── sales/
│       └── salesSlice.ts      # Sales summary state
├── pages/
│   ├── Dashboard.tsx     # Dashboard with sales metrics
│   ├── Products.tsx      # Product management page
│   └── POS.tsx           # Point of sale page
├── components/
│   ├── Layout.tsx        # Main layout with navigation
│   └── Loader.tsx        # Reusable loading component
├── services/
│   └── api.ts            # Axios instance & API services
└── types/
    └── index.ts          # TypeScript type definitions
```

## 🔌 API Integration

The application uses mock data with placeholder API endpoints. To integrate with a real backend:

1. Update the `baseURL` in `src/services/api.ts`
2. Remove the mock data fallbacks
3. Ensure API endpoints match:
   - `GET /api/products` - Fetch all products
   - `POST /api/products` - Create product
   - `PUT /api/products/:id` - Update product
   - `DELETE /api/products/:id` - Delete product
   - `POST /api/sales` - Create sale
   - `GET /api/dashboard/summary` - Get dashboard summary

## 📊 State Management

### Redux Slices

1. **productsSlice**
   - Manages product list
   - Handles CRUD operations
   - Tracks loading and error states

2. **cartSlice**
   - Manages shopping cart items
   - Actions: `addItem`, `removeItem`, `updateQty`, `clearCart`
   - Selectors: `selectCartTotal`, `selectCartItemCount`

3. **salesSlice**
   - Tracks today's sales summary
   - Handles sale creation
   - Updates dashboard metrics

## 🎨 UI/UX Features

- **Responsive Design**: Works on desktop, tablet, and mobile
- **Loading States**: Spinners and loaders for all async operations
- **Error Handling**: User-friendly error messages
- **Modal Dialogs**: Clean modals for product editing
- **Receipt Preview**: Digital receipt after checkout
- **Keyboard Navigation**: Optimized for barcode scanners

## 🔑 Key Components

### Loader Component
Reusable loading component with three sizes and full-screen option:
```tsx
<Loader message="Loading..." size="medium" fullScreen={false} />
```

### Layout Component
Main application layout with navigation and routing

### Pages
- **Dashboard**: Sales metrics and quick actions
- **Products**: Product management with search and CRUD
- **POS**: Billing interface with barcode scanner

## 🚦 Development

The application includes:
- ✅ TypeScript type checking
- ✅ ESLint code quality checks
- ✅ Production build optimization
- ✅ Hot Module Replacement (HMR)
- ✅ Responsive design
- ✅ Loading states for all async operations

## 📝 Build Output

```
dist/
├── index.html                    0.46 kB
├── assets/
│   ├── index-[hash].css         18.48 kB (gzipped: 4.46 kB)
│   └── index-[hash].js         317.14 kB (gzipped: 102.66 kB)
```

## 🔄 Next Steps (Phase 2)

- [ ] Connect to real backend/SAP integration
- [ ] Add user authentication
- [ ] Implement payment processing
- [ ] Add print receipt functionality
- [ ] Add product categories
- [ ] Implement inventory alerts
- [ ] Add sales reports and analytics
- [ ] Multi-currency support
- [ ] Offline mode support

## 📄 License

MIT

## 👨‍💻 Development Team

Built for retail management operations with focus on speed, reliability, and user experience.

---

**Status**: ✅ Phase 1 Complete - Ready for backend integration
