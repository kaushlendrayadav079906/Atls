import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { CartItem, Product } from '../../types';

interface CartState {
  items: CartItem[];
  gstPercentage: number;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
}

const initialState: CartState = {
  items: [],
  gstPercentage: 5,
  discountType: 'percentage',
  discountValue: 0,
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem: (state, action: PayloadAction<Product>) => {
      const existingItem = state.items.find(
        item => item.product.id === action.payload.id
      );
      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        state.items.push({ product: action.payload, quantity: 1 });
      }
    },
    removeItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(item => item.product.id !== action.payload);
    },
    updateQty: (state, action: PayloadAction<{ productId: string; quantity: number }>) => {
      const item = state.items.find(
        item => item.product.id === action.payload.productId
      );
      if (item) {
        if (action.payload.quantity <= 0) {
          state.items = state.items.filter(
            i => i.product.id !== action.payload.productId
          );
        } else {
          item.quantity = action.payload.quantity;
        }
      }
    },
    clearCart: (state) => {
      state.items = [];
      state.discountValue = 0;
    },
    setGstPercentage: (state, action: PayloadAction<number>) => {
      state.gstPercentage = action.payload;
    },
    setDiscountType: (state, action: PayloadAction<'percentage' | 'fixed'>) => {
      state.discountType = action.payload;
    },
    setDiscountValue: (state, action: PayloadAction<number>) => {
      state.discountValue = action.payload;
    },
  },
});

export const { addItem, removeItem, updateQty, clearCart, setGstPercentage, setDiscountType, setDiscountValue } = cartSlice.actions;

// Selectors
export const selectCartItems = (state: { cart: CartState }) => state.cart.items;
export const selectCartTotal = (state: { cart: CartState }) =>
  state.cart.items.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0
  );
export const selectCartItemCount = (state: { cart: CartState }) =>
  state.cart.items.reduce((count, item) => count + item.quantity, 0);

export default cartSlice.reducer;
