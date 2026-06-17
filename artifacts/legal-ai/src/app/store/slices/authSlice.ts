import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AuthUser } from "@/domains/auth/authApi";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
}

const initialState: AuthState = {
  user: null,
  status: "loading",
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuthUser(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload;
      state.status = "authenticated";
    },
    setUnauthenticated(state) {
      state.user = null;
      state.status = "unauthenticated";
    },
  },
});

export const { setAuthUser, setUnauthenticated } = authSlice.actions;
export const authReducer = authSlice.reducer;
