/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import React from "react";
import {
  FieldError,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Button as AriaButton,
  Select as AriaSelect,
  SelectValue,
  Text,
  TextArea,
  TextField as AriaTextField,
  TextFieldProps,
} from "react-aria-components";
import { Icon } from "./Icon";

export const labelClass = "text-[13px] font-semibold";
export const descriptionClass = "text-muted text-[12.5px]";

interface FieldProps extends TextFieldProps {
  label: string;
  description?: string;
  errorMessage?: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  inputClassName?: string;
  hideLabel?: boolean;
}

/** Labelled text input or text area with description and error text. */
export const TextField: React.FC<FieldProps> = ({
  label,
  description,
  errorMessage,
  placeholder,
  multiline,
  rows = 4,
  inputClassName = "",
  hideLabel,
  className,
  ...props
}) => (
  <AriaTextField
    {...props}
    isInvalid={props.isInvalid ?? !!errorMessage}
    className={`flex flex-col gap-1.5 ${typeof className === "string" ? className : ""}`}
  >
    <Label className={hideLabel ? "sr-only" : labelClass}>{label}</Label>
    {multiline ? (
      <TextArea
        rows={rows}
        placeholder={placeholder}
        className={`field-input resize-y ${inputClassName}`}
      />
    ) : (
      <Input
        placeholder={placeholder}
        className={`field-input ${inputClassName}`}
      />
    )}
    {description && (
      <Text slot="description" className={descriptionClass}>
        {description}
      </Text>
    )}
    <FieldError className="text-err text-[12.5px]">{errorMessage}</FieldError>
  </AriaTextField>
);

export interface SelectOption {
  id: string;
  label: string;
}

/** Labelled single select built on the React Aria Select. */
export const SelectField: React.FC<{
  label: string;
  description?: string;
  options: SelectOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  hideLabel?: boolean;
}> = ({
  label,
  description,
  options,
  value,
  onChange,
  className = "",
  hideLabel,
}) => (
  <AriaSelect
    selectedKey={value}
    onSelectionChange={(key) => key !== null && onChange(String(key))}
    className={`flex flex-col gap-1.5 ${className}`}
  >
    <Label className={hideLabel ? "sr-only" : labelClass}>{label}</Label>
    <AriaButton className="field-input flex items-center justify-between gap-2 text-left">
      <SelectValue className="truncate" />
      <Icon name="chevronDown" className="text-muted size-4" />
    </AriaButton>
    {description && (
      <Text slot="description" className={descriptionClass}>
        {description}
      </Text>
    )}
    <Popover className="panel min-w-[var(--trigger-width)] p-1">
      <ListBox className="outline-none">
        {options.map((o) => (
          <ListBoxItem
            key={o.id}
            id={o.id}
            className="data-[focused]:bg-accent-soft data-[selected]:text-accent cursor-default rounded px-2.5 py-2 outline-none data-[selected]:font-semibold"
          >
            {o.label}
          </ListBoxItem>
        ))}
      </ListBox>
    </Popover>
  </AriaSelect>
);
