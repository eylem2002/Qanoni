import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface UiState {
  advancedOpen: boolean;
}

const initialState: UiState = {
  advancedOpen: false,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleAdvanced(state) {
      state.advancedOpen = !state.advancedOpen;
    },
    setAdvancedOpen(state, action: PayloadAction<boolean>) {
      state.advancedOpen = action.payload;
    },
  },
});

export const { toggleAdvanced, setAdvancedOpen } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
