/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { lazy, Suspense, useState } from "react";
import {
  I18nProvider,
  RouterProvider as AriaRouterProvider,
} from "react-aria-components";
import {
  Navigate,
  Route,
  Routes,
  useHref,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { ApiProvider } from "./api/client";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import {
  API_KEY,
  RuntimeConfigProvider,
  useRuntimeConfig,
} from "./config/runtime";
import { ProductPage } from "./features/product/ProductPage";
import { AppShell } from "./layout/AppShell";
import { PageErrorBoundary } from "./ui/ErrorBoundary";
import { Spinner } from "./ui/Spinner";
import { ToastProvider } from "./ui/Toast";

const BatchesPage = lazy(() =>
  import("./features/batches/BatchesPage").then((m) => ({
    default: m.BatchesPage,
  })),
);
const QuickGeneratePage = lazy(() =>
  import("./features/quick/QuickGeneratePage").then((m) => ({
    default: m.QuickGeneratePage,
  })),
);

const Loading = () => (
  <div className="text-muted grid min-h-64 place-items-center" role="status">
    <Spinner label="Loading…" />
  </div>
);

const NewProduct: React.FC = () => {
  const location = useLocation();
  const fresh = (location.state as { fresh?: number } | null)?.fresh;
  return <ProductPage key={`new-${fresh ?? 0}`} />;
};

const DraftProduct: React.FC = () => {
  const { id } = useParams();
  return <ProductPage key={id} draftId={id} />;
};

/**
 * Toasts, API clients and a query cache for the signed-in session. It renders
 * inside AuthProvider's per-user subtree, so signing out unmounts all of them.
 */
export const SessionRoot: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const config = useRuntimeConfig();
  const { getIdToken } = useAuth();
  const [queryClient] = useState(() => new QueryClient());
  return (
    <ToastProvider>
      <QueryClientProvider client={queryClient}>
        <ApiProvider
          baseUrl={config.typeSafeApis[API_KEY]}
          getIdToken={getIdToken}
        >
          {children}
        </ApiProvider>
      </QueryClientProvider>
    </ToastProvider>
  );
};

export const AppRoutes: React.FC = () => (
  <Routes>
    <Route element={<AppShell />}>
      <Route path="/new" element={<NewProduct />} />
      <Route path="/drafts/:id" element={<DraftProduct />} />
      <Route
        path="/batches"
        element={
          <PageErrorBoundary>
            <Suspense fallback={<Loading />}>
              <BatchesPage />
            </Suspense>
          </PageErrorBoundary>
        }
      />
      <Route
        path="/quick"
        element={
          <PageErrorBoundary>
            <Suspense fallback={<Loading />}>
              <QuickGeneratePage />
            </Suspense>
          </PageErrorBoundary>
        }
      />
      {/* Paths used by the previous website. */}
      <Route
        path="/smartProductOnboarding"
        element={<Navigate to="/new" replace />}
      />
      <Route
        path="/batchOnboarding"
        element={<Navigate to="/batches" replace />}
      />
      <Route
        path="/genProductData"
        element={<Navigate to="/quick" replace />}
      />
      <Route path="*" element={<Navigate to="/new" replace />} />
    </Route>
  </Routes>
);

export const App: React.FC = () => {
  const navigate = useNavigate();
  return (
    <I18nProvider locale="en-US">
      <AriaRouterProvider navigate={navigate} useHref={useHref}>
        <RuntimeConfigProvider>
          <AuthProvider>
            <SessionRoot>
              <AppRoutes />
            </SessionRoot>
          </AuthProvider>
        </RuntimeConfigProvider>
      </AriaRouterProvider>
    </I18nProvider>
  );
};
