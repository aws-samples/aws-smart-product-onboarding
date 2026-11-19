/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { idTokenFor, SessionEndedError } from "./AuthProvider";

const auth = vi.hoisted(() => ({ fetchAuthSession: vi.fn() }));
vi.mock("aws-amplify/auth", () => ({
  ...auth,
  getCurrentUser: vi.fn(),
  signOut: vi.fn(),
}));

const session = (username: string) => ({
  tokens: {
    idToken: {
      payload: { "cognito:username": username },
      toString: () => `token-of-${username}`,
    },
  },
});

describe("idTokenFor", () => {
  it("returns the token of the signed-in user", async () => {
    auth.fetchAuthSession.mockResolvedValue(session("maria"));
    await expect(idTokenFor("maria")).resolves.toBe("token-of-maria");
  });

  it("reports an ended session when there is no token", async () => {
    auth.fetchAuthSession.mockResolvedValue({ tokens: undefined });
    await expect(idTokenFor("maria")).rejects.toBeInstanceOf(SessionEndedError);
  });

  it("reloads instead of sending another account's token", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    auth.fetchAuthSession.mockResolvedValue(session("li"));
    await expect(idTokenFor("maria")).rejects.toThrow(/another tab/);
    expect(reload).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
