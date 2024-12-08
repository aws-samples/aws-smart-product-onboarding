/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { NorthStarThemeProvider } from "@aws-northstar/ui";
import { I18nProvider } from "@cloudscape-design/components/i18n";
import messages from "@cloudscape-design/components/i18n/messages/all.en";
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import Auth from "./components/Auth";
import GlobalUIContextProvider from "./components/GlobalUIContextProvider";
import RuntimeContextProvider from "./components/RuntimeContext";
import TypeSafeApiClientProvider from "./components/TypeSafeApiClientProvider";
import App from "./layouts/App";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <NorthStarThemeProvider>
      <I18nProvider locale="en" messages={[messages]}>
        <BrowserRouter>
          <RuntimeContextProvider>
            <Auth>
              <TypeSafeApiClientProvider>
                <GlobalUIContextProvider>
                  <App />
                </GlobalUIContextProvider>
              </TypeSafeApiClientProvider>
            </Auth>
          </RuntimeContextProvider>
        </BrowserRouter>
      </I18nProvider>
    </NorthStarThemeProvider>
  </React.StrictMode>,
);
