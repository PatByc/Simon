import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ApprovalMode } from "@simon/contracts";

interface AssistantUiState {
  isOpen: boolean;
  isPinned: boolean;
  approvalMode: ApprovalMode;
  open: () => void;
  close: () => void;
  togglePinned: () => void;
  setApprovalMode: (approvalMode: ApprovalMode) => void;
}

export const useAssistantUi = create<AssistantUiState>()(
  persist(
    (set) => ({
      isOpen: false,
      isPinned: false,
      approvalMode: "manual",
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      togglePinned: () => set((state) => ({ isPinned: !state.isPinned, isOpen: true })),
      setApprovalMode: (approvalMode) => set({ approvalMode }),
    }),
    {
      name: "simon-assistant-ui",
      partialize: (state) => ({ isPinned: state.isPinned, approvalMode: state.approvalMode }),
    },
  ),
);
