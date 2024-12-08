/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { useCognitoAuthContext } from "@aws-northstar/ui";
import NavHeader from "@aws-northstar/ui/components/AppLayout/components/NavHeader";
import getBreadcrumbs from "@aws-northstar/ui/components/AppLayout/utils/getBreadcrumbs";
import {
  BreadcrumbGroup,
  BreadcrumbGroupProps,
  Flashbar,
  SideNavigation,
} from "@cloudscape-design/components";
import AppLayout, {
  AppLayoutProps,
} from "@cloudscape-design/components/app-layout";
import * as React from "react";
import { createContext, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NavItems } from "./navitems";
import Config from "../../config.json";
import helpPanelContent from "../../help/helpPanelContent";
import { useGlobalUIContext } from "../../hooks/useGlobalUIContext";
import Routes from "../Routes";

/**
 * Context for updating/retrieving the AppLayout.
 */
export const AppLayoutContext = createContext({
  appLayoutProps: {},
  setAppLayoutProps: (_: AppLayoutProps) => {},
});

/**
 * Defines the App layout and contains logic for routing.
 */
const App: React.FC = () => {
  const [username, setUsername] = useState<string | undefined>();
  const [email, setEmail] = useState<string | undefined>();
  const { getAuthenticatedUser } = useCognitoAuthContext();

  const navigate = useNavigate();
  const [activeHref, setActiveHref] = useState("/");
  const [activeBreadcrumbs, setActiveBreadcrumbs] = useState<
    BreadcrumbGroupProps.Item[]
  >([{ text: "/", href: "/" }]);
  const [appLayoutProps, setAppLayoutProps] = useState<AppLayoutProps>({});
  const location = useLocation();

  const { flashItems, toolsOpen, setToolsOpen, helpPanelTopic, appLayoutRef } =
    useGlobalUIContext();

  useEffect(() => {
    const authUser = getAuthenticatedUser();
    setUsername(authUser?.getUsername());

    authUser?.getSession(() => {
      authUser.getUserAttributes((_, attributes) => {
        setEmail(attributes?.find((a) => a.Name === "email")?.Value);
      });
    });
  }, [getAuthenticatedUser, setUsername, setEmail]);

  const setAppLayoutPropsSafe = useCallback(
    (props: AppLayoutProps) => {
      JSON.stringify(appLayoutProps) !== JSON.stringify(props) &&
        setAppLayoutProps(props);
    },
    [appLayoutProps],
  );

  useEffect(() => {
    setActiveHref(location.pathname);
    const breadcrumbs = getBreadcrumbs(location.pathname, location.search, "/");
    setActiveBreadcrumbs(breadcrumbs);
  }, [location]);

  const onNavigate = useCallback(
    (e: CustomEvent<{ href: string; external?: boolean }>) => {
      if (!e.detail.external) {
        e.preventDefault();
        setAppLayoutPropsSafe({
          contentType: undefined,
          splitPanelOpen: false,
          splitPanelSize: undefined,
          splitPanelPreferences: undefined,
        });
        navigate(e.detail.href);
      }
    },
    [navigate],
  );

  return (
    <AppLayoutContext.Provider
      value={{ appLayoutProps, setAppLayoutProps: setAppLayoutPropsSafe }}
    >
      <NavHeader
        title={Config.applicationName}
        logo={Config.logo}
        user={
          username
            ? {
                username,
                email,
              }
            : undefined
        }
        onSignout={() =>
          new Promise(() => {
            getAuthenticatedUser()?.signOut();
            window.location.href = "/";
          })
        }
      />
      <AppLayout
        ref={appLayoutRef}
        breadcrumbs={
          <BreadcrumbGroup onFollow={onNavigate} items={activeBreadcrumbs} />
        }
        toolsOpen={toolsOpen}
        onToolsChange={(event) => setToolsOpen(event.detail.open)}
        tools={helpPanelContent[helpPanelTopic]}
        navigation={
          <SideNavigation
            header={{ text: Config.applicationName, href: "/" }}
            activeHref={activeHref}
            onFollow={onNavigate}
            items={NavItems}
          />
        }
        content={<Routes />}
        splitPanelOpen={false}
        splitPanelPreferences={{ position: "bottom" }}
        notifications={<Flashbar items={flashItems} />}
        // nosemgrep: react-props-spreading
        {...appLayoutProps}
      />
    </AppLayoutContext.Provider>
  );
};

export default App;
