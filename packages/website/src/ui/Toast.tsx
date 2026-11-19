/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

type ToastKind = "info" | "success" | "error";
interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

const ToastContext = createContext<(text: string, kind?: ToastKind) => void>(
  () => undefined,
);

/** Shows short status messages in a polite live region. Errors stay until dismissed. */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(0);

  const dismiss = useCallback(
    (id: number) => setItems((all) => all.filter((t) => t.id !== id)),
    [],
  );
  const notify = useCallback(
    (text: string, kind: ToastKind = "info") => {
      const id = ++next.current;
      setItems((all) => [...all.slice(-3), { id, kind, text }]);
      if (kind !== "error") setTimeout(() => dismiss(id), 3500);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2 max-md:bottom-20"
        role="status"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`panel pointer-events-auto flex max-w-sm items-start gap-3 px-3.5 py-2.5 ${
              t.kind === "error" ? "border-err text-err" : ""
            }`}
          >
            <span className="flex-1">{t.text}</span>
            <button
              type="button"
              className="text-muted hover:text-text -m-1 rounded p-1"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
