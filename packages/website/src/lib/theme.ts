/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { useState } from "react";
import { readJson, writeJson } from "./storage";

export type Theme = "dark" | "light";
const KEY = "spo:theme";

export function initialTheme(): Theme {
  const saved = readJson<Theme | null>(KEY, null);
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme;
};

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme) || initialTheme(),
  );
  return [
    theme,
    (t: Theme) => {
      setTheme(t);
      applyTheme(t);
      writeJson(KEY, t);
    },
  ];
}
