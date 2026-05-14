import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  selectedKey: string | null;
  compareKeys: string[];
  setSelectedKey: (key: string | null) => void;
  toggleCompareKey: (key: string) => void;
  setCompareKeys: (keys: string[]) => void;
  clearCompare: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedKey: null,
      compareKeys: [],
      setSelectedKey: (key) => set({ selectedKey: key }),
      toggleCompareKey: (key) =>
        set((state) => {
          const has = state.compareKeys.includes(key);
          return {
            compareKeys: has
              ? state.compareKeys.filter((k) => k !== key)
              : [...state.compareKeys, key],
          };
        }),
      setCompareKeys: (keys) => set({ compareKeys: keys }),
      clearCompare: () => set({ compareKeys: [] }),
    }),
    { name: "scholar-agent-state" },
  ),
);
