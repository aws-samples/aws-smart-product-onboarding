/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignIn } from "./SignIn";

const auth = vi.hoisted(() => ({
  signIn: vi.fn(),
  confirmSignIn: vi.fn(),
  resetPassword: vi.fn(),
  confirmResetPassword: vi.fn(),
}));
vi.mock("aws-amplify/auth", () => auth);

describe("SignIn", () => {
  beforeEach(() => Object.values(auth).forEach((f) => f.mockReset()));

  it("signs in, then asks for a new password when Cognito requires one", async () => {
    const onSignedIn = vi.fn();
    auth.signIn.mockResolvedValue({
      nextStep: { signInStep: "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED" },
    });
    auth.confirmSignIn.mockResolvedValue({ nextStep: { signInStep: "DONE" } });
    render(<SignIn appName="Test" onSignedIn={onSignedIn} />);

    await userEvent.type(screen.getByLabelText("Username"), "maria");
    await userEvent.type(screen.getByLabelText("Password"), "Old-pass1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(auth.signIn).toHaveBeenCalledWith({
      username: "maria",
      password: "Old-pass1",
    });

    await userEvent.type(
      await screen.findByLabelText("New password"),
      "New-pass1!",
    );
    await userEvent.type(
      screen.getByLabelText("Confirm new password"),
      "New-pass1!",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Set password and sign in" }),
    );
    expect(auth.confirmSignIn).toHaveBeenCalledWith({
      challengeResponse: "New-pass1!",
    });
    expect(onSignedIn).toHaveBeenCalled();
  });

  it("starts the reset flow when Cognito requires a password reset", async () => {
    auth.signIn.mockResolvedValue({
      nextStep: { signInStep: "RESET_PASSWORD" },
    });
    auth.resetPassword.mockResolvedValue({
      nextStep: {
        resetPasswordStep: "CONFIRM_RESET_PASSWORD_WITH_CODE",
        codeDeliveryDetails: {},
      },
    });
    render(<SignIn appName="Test" onSignedIn={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Username"), "maria");
    await userEvent.type(screen.getByLabelText("Password"), "Old-pass1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(auth.resetPassword).toHaveBeenCalledWith({ username: "maria" });
    expect(
      await screen.findByText(/Your password must be reset/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Verification code")).toBeInTheDocument();
  });

  it("requires the new password to be confirmed", async () => {
    auth.signIn.mockResolvedValue({
      nextStep: { signInStep: "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED" },
    });
    render(<SignIn appName="Test" onSignedIn={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Username"), "maria");
    await userEvent.type(screen.getByLabelText("Password"), "Old-pass1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await userEvent.type(
      await screen.findByLabelText("New password"),
      "New-pass1!",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Set password and sign in" }),
    );
    expect(auth.confirmSignIn).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Confirm the new password."),
    ).toBeInTheDocument();
  });

  it("shows a readable error for a wrong password", async () => {
    auth.signIn.mockRejectedValue(
      Object.assign(new Error("x"), { name: "NotAuthorizedException" }),
    );
    render(<SignIn appName="Test" onSignedIn={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Username"), "maria");
    await userEvent.type(screen.getByLabelText("Password"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Incorrect username or password.",
    );
  });

  it("resets a forgotten password with the emailed code", async () => {
    auth.resetPassword.mockResolvedValue({
      nextStep: {
        resetPasswordStep: "CONFIRM_RESET_PASSWORD_WITH_CODE",
        codeDeliveryDetails: { destination: "m***@example.com" },
      },
    });
    auth.confirmResetPassword.mockResolvedValue(undefined);
    render(<SignIn appName="Test" onSignedIn={vi.fn()} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Forgot your password?" }),
    );
    await userEvent.type(screen.getByLabelText("Username"), "maria");
    await userEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(
      await screen.findByText("We sent a code to m***@example.com."),
    ).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Verification code"), "123456");
    await userEvent.type(screen.getByLabelText("New password"), "New-pass1!");
    await userEvent.type(
      screen.getByLabelText("Confirm new password"),
      "New-pass1!",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Reset password" }),
    );
    expect(auth.confirmResetPassword).toHaveBeenCalledWith({
      username: "maria",
      confirmationCode: "123456",
      newPassword: "New-pass1!",
    });
    expect(
      await screen.findByText(/Your password has been reset/),
    ).toBeInTheDocument();
  });
});
