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
  useMemo,
  useState,
} from "react";
import { SignIn } from "./SignIn";
import { useRuntimeConfig } from "../config/runtime";
import { FLUSH_DRAFTS, setDraftsOwner } from "../lib/drafts";
import { FullPageMessage } from "../ui/FullPageMessage";

interface AuthState {
  username: string;
  getIdToken: () => Promise<string>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const useAuth = (): AuthState => {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside AuthProvider");
  return auth;
};

/** Thrown when the session has ended, for example after signing out in another tab. */
export class SessionEndedError extends Error {
  constructor() {
    super("Your session has ended. Sign in again.");
    this.name = "SessionEndedError";
  }
}

/**
 * Returns the current ID token. Amplify refreshes it when it has expired.
 * If another tab signed in as a different user, reload so the page and the
 * API calls belong to the same account. With no token the session has ended.
 */
export const idTokenFor = async (username: string): Promise<string> => {
  const token = (await fetchAuthSession()).tokens?.idToken;
  if (!token) throw new SessionEndedError();
  if (token.payload["cognito:username"] !== username) {
    window.location.reload();
    throw new Error("The signed-in user changed in another tab.");
  }
  return token.toString();
};

/** Amplify keeps the user pool tokens in localStorage under keys with this prefix. */
const TOKEN_KEY_PREFIX = "CognitoIdentityServiceProvider.";

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

  /** Shows the sign-in screen and unmounts the signed-in app. Open editors save their drafts first. */
  const endSession = useCallback(() => {
    window.dispatchEvent(new Event(FLUSH_DRAFTS));
    setUser(null);
  }, []);

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
        endSession();
    });
  }, [config.userPoolId, config.userPoolWebClientId, endSession]);

  // Another tab signed in or out: follow it here.
  useEffect(() => {
    if (!user) return undefined;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && !e.key.startsWith(TOKEN_KEY_PREFIX)) return;
      getCurrentUser()
        .then((u) => {
          if (u.username === user) return;
          window.dispatchEvent(new Event(FLUSH_DRAFTS));
          window.location.reload();
        })
        .catch(endSession);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [user, endSession]);

  // One stable token function per signed-in user, so the API client is not rebuilt on every render.
  const getIdToken = useMemo(
    () =>
      user
        ? () =>
            idTokenFor(user).catch((e: unknown) => {
              if (e instanceof SessionEndedError) endSession();
              throw e;
            })
        : undefined,
    [user, endSession],
  );

  const signOut = useCallback(async () => {
    // Let open editors save their drafts while the user is still known.
    window.dispatchEvent(new Event(FLUSH_DRAFTS));
    await amplifySignOut();
    setUser(null);
  }, []);

  // Drafts belong to the signed-in user.
  setDraftsOwner(user ?? "");

  if (user === undefined) return <FullPageMessage title="Loading…" busy />;
  if (user === null || !getIdToken) {
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
