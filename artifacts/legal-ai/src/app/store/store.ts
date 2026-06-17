import { configureStore } from "@reduxjs/toolkit";
import { contractReducer } from "./slices/contractSlice";
import { uiReducer } from "./slices/uiSlice";

export const store = configureStore({
  reducer: {
    contract: contractReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
