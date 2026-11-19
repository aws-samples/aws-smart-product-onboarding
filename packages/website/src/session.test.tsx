/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useApi } from "./api/client";
import { SessionRoot } from "./App";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { useToast } from "./ui/Toast";

const auth = vi.hoisted(() => ({
  fetchAuthSession: vi.fn(),
  getCurrentUser: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("aws-amplify/auth", () => auth);
vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
vi.mock("aws-amplify/utils", () => ({ Hub: { listen: () => () => {} } }));
vi.mock("./auth/SignIn", () => ({ SignIn: () => <p>Sign-in screen</p> }));
vi.mock("./config/runtime", () => ({
  API_KEY: "api",
  useRuntimeConfig: () => ({
    userPoolId: "pool",
    userPoolWebClientId: "client",
    typeSafeApis: { api: "https://api.example.com/prod" },
  }),
}));

const session = (username: string) => ({
  tokens: {
    idToken: {
      payload: { "cognito:username": username },
      toString: () => `token-of-${username}`,
    },
  },
});

const Signed: React.FC = () => {
  const { username, signOut } = useAuth();
  const { fetchClient } = useApi();
  const notify = useToast();
  return (
    <>
      <p>App for {username}</p>
      <button onClick={() => notify("Upload failed", "error")}>Toast</button>
      <button onClick={() => void signOut()}>Sign out</button>
      <button
        onClick={() =>
          void fetchClient
            .POST("/uploadFile", { body: { fileName: "a" } })
            .catch(() => undefined)
        }
      >
        Call API
      </button>
    </>
  );
};

const renderApp = () =>
  render(
    <AuthProvider>
      <SessionRoot>
        <Signed />
      </SessionRoot>
    </AuthProvider>,
  );

const otherTabChanged = () =>
  act(() => {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "CognitoIdentityServiceProvider.client.LastAuthUser",
      }),
    );
  });

describe("signed-in session", () => {
  beforeEach(() => {
    Object.values(auth).forEach((f) => f.mockReset());
    auth.getCurrentUser.mockResolvedValue({ username: "maria" });
    auth.fetchAuthSession.mockResolvedValue(session("maria"));
    auth.signOut.mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("clears toasts when the user signs out", async () => {
    renderApp();
    await userEvent.click(await screen.findByText("Toast"));
    expect(screen.getByText("Upload failed")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Sign out"));
    expect(await screen.findByText("Sign-in screen")).toBeInTheDocument();
    expect(screen.queryByText("Upload failed")).not.toBeInTheDocument();
  });

  it("shows sign-in when another tab signs out", async () => {
    renderApp();
    await screen.findByText("App for maria");
    auth.getCurrentUser.mockRejectedValue(new Error("no user"));
    otherTabChanged();
    expect(await screen.findByText("Sign-in screen")).toBeInTheDocument();
    expect(screen.queryByText("App for maria")).not.toBeInTheDocument();
  });

  it("reloads when another tab signs in as a different user", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    renderApp();
    await screen.findByText("App for maria");
    auth.getCurrentUser.mockResolvedValue({ username: "li" });
    otherTabChanged();
    await vi.waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it("ends the session instead of sending a request without a token", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("{}", {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderApp();
    await userEvent.click(await screen.findByText("Call API"));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const sent = (fetchMock.mock.calls[0] as unknown[])[0] as Request;
    expect(sent.headers.get("Authorization")).toBe("token-of-maria");
    fetchMock.mockClear();
    auth.fetchAuthSession.mockResolvedValue({ tokens: undefined });
    await userEvent.click(screen.getByText("Call API"));
    expect(await screen.findByText("Sign-in screen")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
