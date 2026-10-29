"use client";

import { create } from "zustand";

type ToastState = {
  message: string | null;
  tone: "ink" | "accent";
  notify: (message: string, tone?: "ink" | "accent") => void;
  clear: () => void;
};

let timer: ReturnType<typeof setTimeout> | null = null;

export const useToast = create<ToastState>((set) => ({
  message: null,
  tone: "ink",
  notify: (message, tone = "ink") => {
    if (timer) clearTimeout(timer);
    set({ message, tone });
    timer = setTimeout(() => set({ message: null }), 2800);
  },
  clear: () => {
    if (timer) clearTimeout(timer);
    set({ message: null });
  },
}));
