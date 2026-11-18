/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { Amplify } from "aws-amplify";
import {
  fetchAuthSession,
  getCurrentUser,
  signOut as amplifySignOut,
} from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { SignIn } from "./SignIn";
import { useRuntimeConfig } from "../config/runtime";
import { setDraftsOwner } from "../lib/drafts";
import { FullPageMessage } from "../ui/FullPageMessage";

interface AuthState {
  username: string;
  getIdToken: () => Promise<string | undefined>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const useAuth = (): AuthState => {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside AuthProvider");
  return auth;
};

/** Returns the current ID token. Amplify refreshes it with the refresh token when it has expired. */
export const getIdToken = async (): Promise<string | undefined> =>
  (await fetchAuthSession()).tokens?.idToken?.toString();

/**
 * Signs users in against the stack's Cognito user pool and renders the app only
 * for signed-in users. Only the user pool is configured: the website calls the
 * API with the user's ID token and does not need identity pool credentials.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const config = useRuntimeConfig();
  const [user, setUser] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: config.userPoolId,
          userPoolClientId: config.userPoolWebClientId,
          loginWith: { username: true },
        },
      },
    });
    getCurrentUser()
      .then((u) => setUser(u.username))
      .catch(() => setUser(null));
    return Hub.listen("auth", ({ payload }) => {
      if (
        payload.event === "signedOut" ||
        payload.event === "tokenRefresh_failure"
      )
        setUser(null);
    });
  }, [config.userPoolId, config.userPoolWebClientId]);

  const signOut = useCallback(async () => {
    await amplifySignOut();
    setUser(null);
  }, []);

  // Drafts belong to the signed-in user.
  setDraftsOwner(user ?? "");

  if (user === undefined) return <FullPageMessage title="Loading…" busy />;
  if (user === null) {
    return (
      <SignIn
        appName={config.applicationName || "Smart Product Onboarding"}
        onSignedIn={() =>
          getCurrentUser()
            .then((u) => setUser(u.username))
            .catch(() => setUser(null))
        }
      />
    );
  }
  return (
    <AuthContext.Provider value={{ username: user, getIdToken, signOut }}>
      {/* Keyed by user so nothing from a previous session is reused. */}
      <React.Fragment key={user}>{children}</React.Fragment>
    </AuthContext.Provider>
  );
};
