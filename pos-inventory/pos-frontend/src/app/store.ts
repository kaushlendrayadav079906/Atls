import { configureStore } from '@reduxjs/toolkit';
import cartReducer, { clearCart } from '../features/cart/cartSlice';
import authReducer from '../features/auth/authSlice';

export const store = configureStore({
  reducer: {
    cart: cartReducer,
    auth: authReducer,
  },
});

const getUserKey = (user: { id?: string; branch_id?: string | null } | null) =>
  `${user?.id ?? ''}|${user?.branch_id ?? ''}`;

let lastUserKey = getUserKey(store.getState().auth.user);

store.subscribe(() => {
  const state = store.getState();
  const nextUserKey = getUserKey(state.auth.user);

  if (nextUserKey !== lastUserKey) {
    lastUserKey = nextUserKey;
    if (state.cart.items.length > 0) {
      store.dispatch(clearCart());
    }
  }
});

// Infer types from the store
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
