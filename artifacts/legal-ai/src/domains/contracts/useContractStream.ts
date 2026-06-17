import { useMemo } from "react";
import { useAppDispatch } from "@/app/store/hooks";
import { clearResult, setGenerating, setResult } from "@/app/store/slices/contractSlice";
import type { FormCallbacks } from "./types";

/**
 * Wires the streaming `submitContract` callbacks into the Redux contract slice,
 * so any form can drive the shared preview state without prop drilling.
 */
export function useContractStreamCallbacks(): FormCallbacks {
  const dispatch = useAppDispatch();
  return useMemo<FormCallbacks>(
    () => ({
      onResult: (contract, partyName, warnings) => {
        if (contract) {
          dispatch(setResult({ contract, partyName, warnings: warnings ?? [] }));
        } else {
          dispatch(clearResult());
        }
      },
      onLoadingChange: (loading) => dispatch(setGenerating(loading)),
    }),
    [dispatch],
  );
}
