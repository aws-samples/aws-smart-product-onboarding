/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import React, { useEffect } from "react";
import {
  Dialog,
  DialogTrigger,
  Popover,
  ToggleButton,
  ToggleButtonGroup,
} from "react-aria-components";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { RecentDrafts } from "./RecentDrafts";
import { useAuth } from "../auth/AuthProvider";
import { useDrafts } from "../lib/drafts";
import { useStoredState } from "../lib/storage";
import { useTheme } from "../lib/theme";
import { Button } from "../ui/Button";
import { Icon, type IconName } from "../ui/Icon";

export const newProductLink = () => ({
  pathname: "/new",
  state: { fresh: Date.now() },
});

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

const NavItem: React.FC<{
  to: string | ReturnType<typeof newProductLink>;
  icon: IconName;
  label: string;
  shortcut?: string;
  matchPrefixes?: string[];
}> = ({ to, icon, label, shortcut, matchPrefixes }) => {
  const location = useLocation();
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) => {
        const active =
          isActive ||
          (matchPrefixes ?? []).some((p) => location.pathname.startsWith(p));
        return [
          "group flex items-center gap-2.5 rounded-md px-2.5 py-2 font-medium whitespace-nowrap",
          "rail-collapsed:justify-center rail-collapsed:px-0",
          active
            ? "bg-accent-soft text-text shadow-[inset_2px_0_0_var(--accent)]"
            : "text-muted hover:bg-raised hover:text-text",
        ].join(" ");
      }}
    >
      {({ isActive }) => (
        <>
          <Icon name={icon} className="size-[18px]" />
          {/* On phones only the current page shows its label. */}
          <span
            className={`rail-collapsed:sr-only ${
              isActive ||
              (matchPrefixes ?? []).some((p) => location.pathname.startsWith(p))
                ? ""
                : "max-md:sr-only"
            }`}
          >
            {label}
          </span>
          {shortcut && (
            <span className="kbd rail-collapsed:hidden ml-auto max-md:hidden">
              {shortcut}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
};

/** Recent drafts in a popover, for phones where the rail is a top bar. */
const MobileDrafts: React.FC = () => {
  const drafts = useDrafts();
  return (
    <DialogTrigger>
      <Button
        variant="quiet"
        size="sm"
        className="px-2 md:hidden"
        aria-label={`Recent drafts, ${drafts.length}`}
      >
        <Icon name="batches" className="size-[18px] rotate-90" />
        <span className="font-mono text-[11px]">{drafts.length}</span>
      </Button>
      <Popover placement="bottom end" className="panel w-[min(320px,92vw)] p-2">
        <Dialog aria-label="Recent drafts" className="outline-none">
          {({ close }) => <RecentDrafts variant="menu" onNavigate={close} />}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
};

const ThemeSwitch: React.FC = () => {
  const [theme, setTheme] = useTheme();
  const item =
    "flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[12px] font-medium text-muted outline-none data-[selected]:bg-raised data-[selected]:text-text data-[selected]:shadow-[0_0_0_1px_var(--line-2)] data-[focus-visible]:outline-2 data-[focus-visible]:outline-accent";
  return (
    <ToggleButtonGroup
      aria-label="Color theme"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[theme]}
      onSelectionChange={(keys) => {
        const [t] = [...keys];
        if (t === "dark" || t === "light") setTheme(t);
      }}
      className="bg-bg border-line rail-collapsed:flex-col flex rounded-lg border p-[3px]"
    >
      <ToggleButton id="dark" aria-label="Dark" className={item}>
        <Icon name="moon" className="size-3.5" />
        <span className="rail-collapsed:hidden max-md:hidden">Dark</span>
      </ToggleButton>
      <ToggleButton id="light" aria-label="Light" className={item}>
        <Icon name="sun" className="size-3.5" />
        <span className="rail-collapsed:hidden max-md:hidden">Light</span>
      </ToggleButton>
    </ToggleButtonGroup>
  );
};

/** The left navigation rail and the page area. The rail collapses to icons and becomes a top bar on phones. */
export const AppShell: React.FC = () => {
  const { username, signOut } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useStoredState("spo:rail-collapsed", false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        isTyping(e.target) ||
        document.querySelector("[role=dialog]")
      )
        return;
      if (e.key === "n" || e.key === "N")
        void navigate(newProductLink().pathname, {
          state: newProductLink().state,
        });
      if (e.key === "b" || e.key === "B") void navigate("/batches");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <div
      className={`grid min-h-screen md:grid-cols-[var(--rail-w)_minmax(0,1fr)] ${collapsed ? "rail-collapsed" : ""}`}
      style={
        { "--rail-w": collapsed ? "64px" : "248px" } as React.CSSProperties
      }
    >
      <a
        href="#main"
        className="bg-accent text-accent-ink sr-only z-50 px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <nav
        aria-label="Primary"
        className="bg-surface border-line rail-collapsed:px-2.5 sticky top-0 z-30 flex min-w-0 gap-1 border-b px-3 py-2 max-md:items-center max-md:gap-2 md:h-screen md:flex-col md:border-r md:border-b-0 md:py-4"
      >
        <div className="rail-collapsed:flex-col flex items-center gap-2.5 md:px-2 md:pb-4">
          <span
            className="size-[30px] shrink-0 rounded-lg shadow-[0_0_0_1px_var(--line-2)] max-md:hidden"
            style={{
              background:
                "conic-gradient(from 210deg, var(--accent), #60a5fa, var(--accent))",
            }}
            aria-hidden="true"
          />
          <span className="rail-collapsed:hidden text-[15px] leading-[1.15] font-bold max-md:sr-only">
            Smart Product
            <br />
            Onboarding
          </span>
          <Button
            variant="quiet"
            size="sm"
            className="rail-collapsed:ml-0 ml-auto px-1.5 max-md:hidden"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-expanded={!collapsed}
            onPress={() => setCollapsed(!collapsed)}
          >
            <Icon name={collapsed ? "chevronRight" : "chevronLeft"} />
          </Button>
        </div>
        <div className="flex min-w-0 gap-1 max-md:flex-1 max-md:overflow-x-auto md:flex-col">
          <NavItem
            to={newProductLink()}
            icon="plus"
            label="New product"
            shortcut="N"
            matchPrefixes={["/drafts/"]}
          />
          <NavItem to="/batches" icon="batches" label="Batches" shortcut="B" />
          <NavItem to="/quick" icon="bolt" label="Quick generate" />
        </div>
        <RecentDrafts />
        <MobileDrafts />
        <div className="flex items-center gap-2 md:mt-auto md:grid md:border-t md:border-line md:pt-3">
          <ThemeSwitch />
          <div className="rail-collapsed:flex-col rail-collapsed:justify-center flex items-center gap-2.5 md:px-2">
            <span
              className="bg-raised border-line-2 grid size-[26px] shrink-0 place-items-center rounded-full border text-[12px] font-bold max-md:hidden"
              title={username}
              aria-hidden="true"
            >
              {username.slice(0, 1).toUpperCase()}
            </span>
            <span className="rail-collapsed:hidden min-w-0 flex-1 truncate text-[13px] max-md:hidden">
              {username}
            </span>
            <Button
              variant="quiet"
              size="sm"
              className="px-1.5"
              onPress={() => void signOut()}
              aria-label={`Sign out ${username}`}
            >
              <Icon name="signOut" />
              <span className="rail-collapsed:hidden max-md:hidden">
                Sign out
              </span>
            </Button>
          </div>
        </div>
      </nav>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
};

/** Sticky page bar with a breadcrumb and page actions. */
export const PageBar: React.FC<{
  crumb: React.ReactNode;
  children?: React.ReactNode;
}> = ({ crumb, children }) => (
  <header className="bg-bg/90 border-line sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-6 backdrop-blur max-md:static max-md:h-12 max-md:px-4">
    <span className="text-muted min-w-0 truncate text-[13px]">{crumb}</span>
    {children && (
      <div className="ml-auto flex items-center gap-2 max-md:hidden">
        {children}
      </div>
    )}
  </header>
);

/** Fixed action bar for phones, where the page bar hides its actions. */
export const MobileActions: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div className="bg-surface border-line fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t px-4 py-2.5 md:hidden [&>*]:flex-1">
    {children}
  </div>
);
