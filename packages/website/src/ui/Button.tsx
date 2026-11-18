/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import React from "react";
import {
  Button as AriaButton,
  ButtonProps as AriaButtonProps,
  composeRenderProps,
} from "react-aria-components";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink border-transparent hover:brightness-110",
  secondary: "bg-raised text-text border-line-2 hover:border-muted",
  quiet:
    "bg-transparent text-muted border-transparent hover:text-text hover:bg-raised",
  danger: "bg-transparent text-err border-line-2 hover:bg-err-soft",
};

export const buttonClass = (
  variant: ButtonVariant = "secondary",
  size: "sm" | "md" = "md",
) =>
  [
    "inline-flex items-center justify-center gap-2 rounded-md border font-semibold whitespace-nowrap",
    "cursor-default transition-[filter,background-color,border-color] outline-none",
    "data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-accent",
    "data-[disabled]:opacity-50",
    size === "sm"
      ? "px-2.5 py-1.5 text-[12.5px]"
      : "px-3.5 py-2.5 text-[13px] leading-none",
    variants[variant],
  ].join(" ");

export interface ButtonProps extends AriaButtonProps {
  variant?: ButtonVariant;
  size?: "sm" | "md";
}

export const Button: React.FC<ButtonProps> = ({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}) => (
  <AriaButton
    {...props}
    className={composeRenderProps(
      className,
      (c) => `${buttonClass(variant, size)} ${c ?? ""}`,
    )}
  >
    {composeRenderProps(children, (child, { isPending }) => (
      <>
        {isPending && <Spinner />}
        {child}
      </>
    ))}
  </AriaButton>
);
