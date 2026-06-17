import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ContractType } from "@/domains/contracts/constants";

export interface ContractState {
  contractType: ContractType;
  generatedContract: string | null;
  validationWarnings: string[];
  partyName: string;
  isGenerating: boolean;
}

const initialState: ContractState = {
  contractType: "employment",
  generatedContract: null,
  validationWarnings: [],
  partyName: "",
  isGenerating: false,
};

const contractSlice = createSlice({
  name: "contract",
  initialState,
  reducers: {
    setContractType(state, action: PayloadAction<ContractType>) {
      state.contractType = action.payload;
      state.generatedContract = null;
      state.validationWarnings = [];
      state.partyName = "";
      state.isGenerating = false;
    },
    setGenerating(state, action: PayloadAction<boolean>) {
      state.isGenerating = action.payload;
    },
    setResult(
      state,
      action: PayloadAction<{ contract: string; partyName: string; warnings: string[] }>,
    ) {
      state.generatedContract = action.payload.contract;
      state.partyName = action.payload.partyName;
      state.validationWarnings = action.payload.warnings;
    },
    clearResult(state) {
      state.generatedContract = null;
      state.validationWarnings = [];
    },
  },
});

export const { setContractType, setGenerating, setResult, clearResult } = contractSlice.actions;
export const contractReducer = contractSlice.reducer;
