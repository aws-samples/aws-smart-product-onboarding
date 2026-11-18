/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  confirmResetPassword,
  confirmSignIn,
  resetPassword,
  signIn,
  type SignInOutput,
} from "aws-amplify/auth";
import React, { useRef, useState } from "react";
import {
  Form,
  Input,
  Label,
  TextField as AriaTextField,
  Text,
  FieldError,
} from "react-aria-components";
import { Button } from "../ui/Button";
import { labelClass, descriptionClass, TextField } from "../ui/Field";
import { Icon } from "../ui/Icon";

type Step = "signIn" | "newPassword" | "code" | "forgot" | "reset";

const PASSWORD_HINT =
  "At least 8 characters, with upper and lower case letters, a number and a symbol.";

export function authErrorMessage(error: unknown): string {
  const name = (error as { name?: string })?.name;
  switch (name) {
    case "NotAuthorizedException":
    case "UserNotFoundException":
      return "Incorrect username or password.";
    case "CodeMismatchException":
      return "The code is not correct. Check it and try again.";
    case "ExpiredCodeException":
      return "The code has expired. Request a new one.";
    case "LimitExceededException":
    case "TooManyRequestsException":
      return "Too many attempts. Wait a few minutes and try again.";
    case "EmptySignInUsername":
    case "EmptyResetPasswordUsername":
      return "Enter your username.";
    case "EmptySignInPassword":
      return "Enter your password.";
    default:
      return (
        (error as { message?: string })?.message || "Sign-in failed. Try again."
      );
  }
}

const PasswordField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  description?: string;
  errorMessage?: string;
}> = ({ label, value, onChange, autoComplete, description, errorMessage }) => {
  const [visible, setVisible] = useState(false);
  return (
    <AriaTextField
      value={value}
      onChange={onChange}
      isRequired
      isInvalid={!!errorMessage}
      type={visible ? "text" : "password"}
      autoComplete={autoComplete}
      className="flex flex-col gap-1.5"
    >
      <Label className={labelClass}>{label}</Label>
      <div className="relative">
        <Input className="field-input pr-10" />
        <button
          type="button"
          className="text-muted hover:text-text absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1.5"
          onClick={() => setVisible((v) => !v)}
          aria-label={
            visible
              ? `Hide ${label.toLowerCase()}`
              : `Show ${label.toLowerCase()}`
          }
          aria-pressed={visible}
        >
          <Icon name={visible ? "eyeOff" : "eye"} />
        </button>
      </div>
      {description && (
        <Text slot="description" className={descriptionClass}>
          {description}
        </Text>
      )}
      <FieldError className="text-err text-[12.5px]">{errorMessage}</FieldError>
    </AriaTextField>
  );
};

/** Sign-in card, including the new-password, code and forgot-password steps. */
export const SignIn: React.FC<{ appName: string; onSignedIn: () => void }> = ({
  appName,
  onSignedIn,
}) => {
  const [step, setStep] = useState<Step>("signIn");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  // Ignore responses that arrive after the user moved to another screen.
  const screen = useRef(0);

  const go = (next: Step, message?: string) => {
    screen.current++;
    setStep(next);
    setError(undefined);
    setNotice(message);
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const sendResetCode = async (prefix = "") => {
    const mine = screen.current;
    const out = await resetPassword({ username: username.trim() });
    if (mine !== screen.current) return;
    const lead = prefix ? `${prefix} ` : "";
    if (out.nextStep.resetPasswordStep === "DONE")
      go("signIn", "Your password has been reset.");
    else {
      const to = out.nextStep.codeDeliveryDetails?.destination;
      go(
        "reset",
        lead +
          (to
            ? `We sent a code to ${to}.`
            : "We sent you a verification code."),
      );
    }
  };

  const handleSignInStep = (output: SignInOutput) => {
    switch (output.nextStep.signInStep) {
      case "DONE":
        onSignedIn();
        return;
      case "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED":
        go("newPassword", "Choose a new password to finish signing in.");
        return;
      case "CONFIRM_SIGN_IN_WITH_TOTP_CODE":
        go("code", "Enter the code from your authenticator app.");
        return;
      case "CONFIRM_SIGN_IN_WITH_SMS_CODE":
      case "CONFIRM_SIGN_IN_WITH_EMAIL_CODE":
        go("code", "Enter the verification code we sent you.");
        return;
      case "RESET_PASSWORD":
        // An administrator requires a new password: send a reset code for this user.
        void run(() => sendResetCode("Your password must be reset."));
        return;
      default:
        setError(
          `This sign-in step (${output.nextStep.signInStep}) is not supported by the demo website.`,
        );
    }
  };

  const run = async (action: () => Promise<void>) => {
    const mine = screen.current;
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (e) {
      if (mine !== screen.current) return;
      if (
        (e as { name?: string })?.name === "UserAlreadyAuthenticatedException"
      )
        onSignedIn();
      else setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const mismatch =
    confirmPassword && newPassword !== confirmPassword
      ? "The passwords do not match."
      : undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    switch (step) {
      case "signIn":
        void run(async () =>
          handleSignInStep(
            await signIn({ username: username.trim(), password }),
          ),
        );
        break;
      case "newPassword":
        if (mismatch) return;
        void run(async () =>
          handleSignInStep(
            await confirmSignIn({ challengeResponse: newPassword }),
          ),
        );
        break;
      case "code":
        void run(async () =>
          handleSignInStep(
            await confirmSignIn({ challengeResponse: code.trim() }),
          ),
        );
        break;
      case "forgot":
        void run(() => sendResetCode());
        break;
      case "reset":
        if (mismatch) return;
        void run(async () => {
          await confirmResetPassword({
            username: username.trim(),
            confirmationCode: code.trim(),
            newPassword,
          });
          setPassword("");
          go(
            "signIn",
            "Your password has been reset. Sign in with the new password.",
          );
        });
        break;
    }
  };

  const titles: Record<Step, string> = {
    signIn: "Sign in",
    newPassword: "Set a new password",
    code: "Verify it's you",
    forgot: "Reset your password",
    reset: "Choose a new password",
  };
  const actions: Record<Step, string> = {
    signIn: "Sign in",
    newPassword: "Set password and sign in",
    code: "Verify",
    forgot: "Send code",
    reset: "Reset password",
  };

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span
            className="size-9 rounded-lg"
            style={{
              background:
                "conic-gradient(from 210deg, var(--accent), #60a5fa, var(--accent))",
            }}
            aria-hidden="true"
          />
          <p className="text-[15px] leading-tight font-bold">{appName}</p>
        </div>
        <div className="panel p-6">
          <h1 className="mb-1 text-xl font-bold tracking-tight">
            {titles[step]}
          </h1>
          {notice && (
            <p className="text-muted mb-1" role="status">
              {notice}
            </p>
          )}
          <Form
            onSubmit={submit}
            className="mt-4 grid gap-4"
            validationBehavior="aria"
          >
            {(step === "signIn" || step === "forgot") && (
              <TextField
                label="Username"
                value={username}
                onChange={setUsername}
                isRequired
                autoComplete="username"
                autoFocus
              />
            )}
            {step === "signIn" && (
              <PasswordField
                label="Password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
              />
            )}
            {(step === "code" || step === "reset") && (
              <TextField
                label="Verification code"
                value={code}
                onChange={setCode}
                isRequired
                autoComplete="one-time-code"
                inputMode="numeric"
                autoFocus
              />
            )}
            {(step === "newPassword" || step === "reset") && (
              <>
                <PasswordField
                  label="New password"
                  value={newPassword}
                  onChange={setNewPassword}
                  autoComplete="new-password"
                  description={PASSWORD_HINT}
                />
                <PasswordField
                  label="Confirm new password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                  errorMessage={mismatch}
                />
              </>
            )}
            {error && (
              <p
                role="alert"
                className="border-err bg-err-soft rounded-md border px-3 py-2 text-[13px]"
              >
                {error}
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              isPending={busy}
              className="w-full"
            >
              {actions[step]}
            </Button>
          </Form>
          <div className="mt-4 text-center text-[13px]">
            {step === "signIn" ? (
              <button
                type="button"
                className="text-accent font-semibold hover:underline"
                disabled={busy}
                onClick={() => go("forgot")}
              >
                Forgot your password?
              </button>
            ) : (
              <button
                type="button"
                className="text-accent font-semibold hover:underline"
                disabled={busy}
                onClick={() => go("signIn")}
              >
                Back to sign in
              </button>
            )}
          </div>
        </div>
        <p className="text-faint mt-4 text-center text-[12.5px]">
          Accounts are created by an administrator in the Amazon Cognito user
          pool.
        </p>
      </div>
    </main>
  );
};
