import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { loginUser, registerUser } from '../../services/api';
import { setCookie, getCookie, deleteCookie } from '../../utils/cookies';

interface User {
  id: string;
  username?: string;
  email: string;
  name: string;
  role?: string;
  branch_id?: string | null;
  store_name?: string | null;
  sap_user_code?: string | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  sessionVersion: number;
  transactionVersion: number;
}

// Token expires in 1 day (24 hours) to match backend JWT
const TOKEN_EXPIRY_DAYS = 1;

// Load user from cookie
const loadUserFromCookie = (): User | null => {
  try {
    const userStr = getCookie('pos_user');
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
};

const initialState: AuthState = {
  user: loadUserFromCookie(),
  isAuthenticated: !!loadUserFromCookie(),
  loading: false,
  error: null,
  sessionVersion: Date.now(),
  transactionVersion: 0,
};

/** Async thunk: validate credentials against backend, then store JWT. */
export const loginAsync = createAsyncThunk(
  'auth/loginAsync',
  async (credentials: { username: string; password: string }, { rejectWithValue }) => {
    try {
      const data = await loginUser(credentials);
      
      // Store token in secure cookie with expiration
      setCookie('pos_token', data.access_token, { 
        expires: TOKEN_EXPIRY_DAYS,
        secure: window.location.protocol === 'https:',
        sameSite: 'Lax'
      });
      
      const user: User = {
        id: data.user?.id || credentials.username,
        username: data.user?.username || credentials.username,
        email: data.user?.email || credentials.username,
        name: data.user?.name || credentials.username,
        role: data.user?.role || 'user',
        branch_id: data.user?.branch_id ?? null,
        store_name: data.user?.store_name ?? null,
        sap_user_code: data.user?.sap_user_code ?? null,
      };
      setCookie('pos_user', JSON.stringify(user), { 
        expires: TOKEN_EXPIRY_DAYS,
        secure: window.location.protocol === 'https:',
        sameSite: 'Lax'
      });
      
      return user;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }, message?: string };
      const message = error?.response?.data?.detail ?? error?.message ?? 'Invalid credentials';
      return rejectWithValue(message);
    }
  }
);

/** Async thunk: register new user */
export const registerAsync = createAsyncThunk(
  'auth/registerAsync',
  async (
    userData: {
      username: string;
      email: string;
      password: string;
      name: string;
      master_password: string;
      role?: 'user' | 'admin';
      branch_id?: string;
      store_name?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const data = await registerUser(userData);
      
      // Store token in secure cookie with expiration
      setCookie('pos_token', data.access_token, { 
        expires: TOKEN_EXPIRY_DAYS,
        secure: window.location.protocol === 'https:',
        sameSite: 'Lax'
      });
      
      const user: User = {
        id: data.user?.id || userData.username,
        username: data.user?.username || userData.username,
        email: data.user?.email || userData.email,
        name: data.user?.name || userData.name,
        role: data.user?.role || 'user',
        branch_id: data.user?.branch_id ?? null,
        store_name: data.user?.store_name ?? null,
        sap_user_code: data.user?.sap_user_code ?? null,
      };
      setCookie('pos_user', JSON.stringify(user), { 
        expires: TOKEN_EXPIRY_DAYS,
        secure: window.location.protocol === 'https:',
        sameSite: 'Lax'
      });
      
      return user;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }, message?: string };
      const message = error?.response?.data?.detail ?? error?.message ?? 'Registration failed';
      return rejectWithValue(message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login: (state, action: PayloadAction<{ email: string; password: string }>) => {
      // Get users from localStorage
      const usersStr = localStorage.getItem('pos_users');
      const users: Array<{ id: string; email: string; name: string; password: string }> = usersStr
        ? JSON.parse(usersStr)
        : [];

      // Find user
      const user = users.find(
        (u) => u.email === action.payload.email && u.password === action.payload.password
      );

      if (user) {
        const { ...userWithoutPassword } = user;
        delete (userWithoutPassword as Partial<typeof userWithoutPassword>).password;
        state.user = userWithoutPassword;
        state.isAuthenticated = true;
        state.sessionVersion = Date.now();
        localStorage.setItem('pos_user', JSON.stringify(userWithoutPassword));
      } else {
        throw new Error('Invalid credentials');
      }
    },
    register: (state, action: PayloadAction<{ email: string; password: string; name: string }>) => {
      // Get users from localStorage
      const usersStr = localStorage.getItem('pos_users');
      const users: Array<{ id: string; email: string; name: string; password: string }> = usersStr
        ? JSON.parse(usersStr)
        : [];

      // Check if user already exists
      if (users.find((u) => u.email === action.payload.email)) {
        throw new Error('User already exists');
      }

      // Create new user
      const newUser = {
        id: Date.now().toString(),
        email: action.payload.email,
        name: action.payload.name,
        password: action.payload.password,
      };

      users.push(newUser);
      localStorage.setItem('pos_users', JSON.stringify(users));

      const { ...userWithoutPassword } = newUser;
      delete (userWithoutPassword as Partial<typeof userWithoutPassword>).password;
      state.user = userWithoutPassword;
      state.isAuthenticated = true;
      state.sessionVersion = Date.now();
      localStorage.setItem('pos_user', JSON.stringify(userWithoutPassword));
    },
    bumpTransactionVersion: (state) => {
      state.transactionVersion += 1;
    },
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.sessionVersion = Date.now();
      // Clear all auth cookies
      deleteCookie('pos_user');
      deleteCookie('pos_token');
      // Also clear any old localStorage data
      localStorage.removeItem('pos_user');
      localStorage.removeItem('pos_token');
    },
  },
  extraReducers: (builder) => {
    builder
      // Login cases
      .addCase(loginAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginAsync.fulfilled, (state, action: PayloadAction<User>) => {
        state.loading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.sessionVersion = Date.now();
      })
      .addCase(loginAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Register cases
      .addCase(registerAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerAsync.fulfilled, (state, action: PayloadAction<User>) => {
        state.loading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.sessionVersion = Date.now();
      })
      .addCase(registerAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { login, register, logout, bumpTransactionVersion } = authSlice.actions;
export default authSlice.reducer;
