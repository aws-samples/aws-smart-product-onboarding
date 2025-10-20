/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { GenProductRequestContentDescriptionLengthEnum } from "@aws-samples/smart-product-onboarding-api-typescript-react-query-hooks";
import {
  Input,
  Select,
  SelectProps,
  Slider,
  SpaceBetween,
} from "@cloudscape-design/components";
import FormField from "@cloudscape-design/components/form-field";
import { useState } from "react";
import "./llmoptions.css";
import DescriptionLengthSelector from "../DescriptionLengthSelector";

export const BedrockModels: SelectProps.Option[] = [
  // Amazon Nova Models (Multimodal: Text, Image, Video -> Text) - Regional cross-region inference (Default)
  {
    label: "Amazon Nova Lite",
    value: "us.amazon.nova-lite-v1:0",
  },
  {
    label: "Amazon Nova Pro",
    value: "us.amazon.nova-pro-v1:0",
  },
  // Anthropic Claude Models (Multimodal: Text, Image -> Text)
  {
    label: "Anthropic Claude 3 Haiku",
    value: "us.anthropic.claude-3-haiku-20240307-v1:0",
  },
  {
    label: "Anthropic Claude 3 Sonnet",
    value: "us.anthropic.claude-3-sonnet-20240229-v1:0",
  },
  {
    label: "Anthropic Claude 3.5 Sonnet",
    value: "us.anthropic.claude-3-5-sonnet-20240620-v1:0",
  },
  {
    label: "Anthropic Claude 3.5 Sonnet v2",
    value: "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
  },
  {
    label: "Anthropic Claude 3.7 Sonnet",
    value: "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
  },
  // Claude 4.5 Models - Global cross-region inference
  {
    label: "Anthropic Claude Haiku 4.5",
    value: "global.anthropic.claude-haiku-4-5-20251001-v1:0",
  },
  {
    label: "Anthropic Claude Sonnet 4.5",
    value: "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
  },
];

export interface LLMOptions {
  temperature?: number;
  model?: SelectProps.Option;
  language?: string;
  descriptionLength?: GenProductRequestContentDescriptionLengthEnum;
}

export interface LLMOptionsFormProps {
  options: LLMOptions;
  setOptions: React.Dispatch<React.SetStateAction<LLMOptions>>;
}

const defaultTemperature = 0.1;
const LLMOptionsForm: React.FC<LLMOptionsFormProps> = (
  props: LLMOptionsFormProps,
) => {
  const { options, setOptions } = props;
  const [languageError, setLanguageError] = useState<string | undefined>();
  const [temperatureError, setTemperatureError] = useState<
    string | undefined
  >();

  return (
    <SpaceBetween direction="vertical" size="l">
      <FormField
        label="Language"
        description="Describe the language to use"
        errorText={languageError}
      >
        <Input
          value={options.language || ""}
          onChange={({ detail }) => {
            if (detail.value.length > 200) {
              setLanguageError("Language must be less than 200 characters");
            } else {
              setLanguageError(undefined);
            }
            setOptions((prev) => {
              return { ...prev, language: detail.value };
            });
          }}
          placeholder="English"
        ></Input>
      </FormField>
      <DescriptionLengthSelector
        value={options.descriptionLength}
        onChange={(value) => {
          setOptions((prev) => {
            return {
              ...prev,
              descriptionLength:
                value as GenProductRequestContentDescriptionLengthEnum,
            };
          });
        }}
      />
      <FormField label="Model" description="Choose a model">
        <Select
          selectedOption={options.model || null}
          placeholder={BedrockModels[0].label}
          options={BedrockModels}
          onChange={({ detail }) => {
            setOptions((prev) => {
              return { ...prev, model: detail.selectedOption };
            });
          }}
        ></Select>
      </FormField>
      <FormField
        label="Temperature"
        description="Adjust the likelihood of randomness"
        errorText={temperatureError}
      >
        <div className="llmoptions-flex-wrapper">
          <div className="llmoptions-slider-wrapper">
            <Slider
              onChange={({ detail }) => {
                setTemperatureError(undefined);
                setOptions((prev) => {
                  return { ...prev, temperature: detail.value };
                });
              }}
              value={
                options.temperature !== undefined
                  ? options.temperature
                  : defaultTemperature
              }
              valueFormatter={(value) => value.toFixed(1)}
              step={0.1}
              max={1}
              min={0}
            />
          </div>
          <SpaceBetween size="m" alignItems="center" direction="horizontal">
            <div className="llmoptions-input-wrapper">
              <Input
                value={
                  options.temperature !== undefined
                    ? options.temperature.toFixed(1)
                    : defaultTemperature.toFixed(1)
                }
                step={0.1}
                onChange={({ detail }) => {
                  let value = Number(detail.value);
                  if (isNaN(value)) {
                    // if (detail.value.startsWith(".")) {
                    //   value = Number(`0${detail.value}`);
                    // } else if (detail.value.endsWith(".")) {
                    //   value = Number(`${detail.value}0`);
                    // } else {
                    //   setTemperatureError("Temperature must be a number");
                    // }
                    setTemperatureError("Temperature must be a number");
                  } else if (value < 0 || value > 1) {
                    setTemperatureError("Temperature must be between 0 and 1");
                  } else {
                    setTemperatureError(undefined);
                  }
                  setOptions((prev) => {
                    return { ...prev, temperature: value };
                  });
                }}
                placeholder={defaultTemperature.toFixed(1)}
                type="number"
                inputMode="numeric"
                controlId="validation-input"
              />
            </div>
          </SpaceBetween>
        </div>
      </FormField>
    </SpaceBetween>
  );
};

export default LLMOptionsForm;
