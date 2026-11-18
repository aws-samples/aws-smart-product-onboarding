/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import React from "react";
import {
  Button as AriaButton,
  Disclosure,
  DisclosurePanel,
  Heading,
  Label,
  Slider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
  ToggleButton,
  ToggleButtonGroup,
} from "react-aria-components";
import { MAX_EXAMPLES, MODELS } from "./models";
import type { ProductFlow } from "./useProductFlow";
import { Button } from "../../ui/Button";
import {
  descriptionClass,
  labelClass,
  SelectField,
  TextField,
} from "../../ui/Field";
import { Icon } from "../../ui/Icon";

const LENGTHS = ["short", "medium", "long"] as const;

/** Section wrapper with a disclosure header, used for the optional settings. */
export const Section: React.FC<{
  title: string;
  description?: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}> = ({ title, description, defaultExpanded, children }) => (
  <Disclosure
    defaultExpanded={defaultExpanded}
    className="border-line group rounded-lg border"
  >
    <Heading className="m-0">
      <AriaButton
        slot="trigger"
        className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-left outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-accent"
      >
        <Icon
          name="chevronRight"
          className="text-muted size-4 transition-transform group-data-[expanded]:rotate-90"
        />
        <span>
          <span className="block font-semibold">{title}</span>
          {description && (
            <span className={descriptionClass}>{description}</span>
          )}
        </span>
      </AriaButton>
    </Heading>
    <DisclosurePanel className="border-line hidden border-t px-4 py-4 group-data-[expanded]:block">
      {children}
    </DisclosurePanel>
  </Disclosure>
);

export const GenerationSettings: React.FC<{ flow: ProductFlow }> = ({
  flow,
}) => {
  const { options, setOptions } = flow;
  const segment =
    "flex-1 px-3 py-1.5 text-[13px] font-medium text-muted outline-none capitalize data-[selected]:bg-accent-soft data-[selected]:text-text data-[focus-visible]:outline-2 data-[focus-visible]:outline-accent [&+&]:border-l [&+&]:border-line-2";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        label="Language"
        description="Describe the language, for example Chilean Spanish."
        placeholder="English"
        value={options.language}
        onChange={(language) => setOptions({ ...options, language })}
        errorMessage={flow.languageError}
      />
      <div className="flex flex-col gap-1.5">
        <span className={labelClass} id="length-label">
          Description length
        </span>
        <ToggleButtonGroup
          aria-labelledby="length-label"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[options.descriptionLength]}
          onSelectionChange={(keys) => {
            const [v] = [...keys];
            if (v)
              setOptions({
                ...options,
                descriptionLength: v as (typeof LENGTHS)[number],
              });
          }}
          className="border-line-2 flex overflow-hidden rounded-md border"
        >
          {LENGTHS.map((l) => (
            <ToggleButton key={l} id={l} className={segment}>
              {l}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
      <SelectField
        label="Model"
        description="The default is the model configured for this deployment."
        value={options.model || "default"}
        options={[
          { id: "default", label: "Default model" },
          ...MODELS.map((m) => ({ id: m.id, label: m.label })),
        ]}
        onChange={(model) =>
          setOptions({ ...options, model: model === "default" ? "" : model })
        }
      />
      <Slider
        minValue={0}
        maxValue={1}
        step={0.1}
        value={options.temperature}
        onChange={(temperature) =>
          setOptions({
            ...options,
            temperature: Math.round(temperature * 10) / 10,
          })
        }
        className="flex flex-col gap-1.5"
      >
        <div className="flex justify-between">
          <Label className={labelClass}>Temperature</Label>
          <SliderOutput className="font-mono text-[12.5px]">
            {({ state }) => state.values[0].toFixed(1)}
          </SliderOutput>
        </div>
        <SliderTrack className="relative h-7 w-full">
          {({ state }) => (
            <>
              <div className="bg-line-2 absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full" />
              <div
                className="bg-accent absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
                style={{ width: `${state.getThumbPercent(0) * 100}%` }}
              />
              <SliderThumb
                aria-label="Temperature"
                className="bg-text border-bg data-[focus-visible]:outline-accent top-1/2 size-4 rounded-full border-2 data-[focus-visible]:outline-2"
              />
            </>
          )}
        </SliderTrack>
        <span className={descriptionClass}>
          Lower values give more predictable text.
        </span>
      </Slider>
    </div>
  );
};

export const ExamplesEditor: React.FC<{ flow: ProductFlow }> = ({ flow }) => {
  const { examples, setExamples } = flow;
  const update = (n: number, patch: { title?: string; description?: string }) =>
    setExamples(examples.map((e, i) => (i === n ? { ...e, ...patch } : e)));
  return (
    <div className="grid gap-4">
      {examples.length === 0 && (
        <p className="text-muted text-[13px]">
          Add up to {MAX_EXAMPLES} listings written in the tone and style you
          want.
        </p>
      )}
      {examples.map((e, n) => (
        <fieldset
          key={n}
          className="border-line grid gap-3 rounded-md border p-3"
        >
          <legend className="text-muted px-1 font-mono text-[11.5px]">
            Example {n + 1}
          </legend>
          <TextField
            label="Title"
            value={e.title}
            onChange={(title) => update(n, { title })}
          />
          <TextField
            label="Description"
            multiline
            rows={3}
            value={e.description}
            onChange={(description) => update(n, { description })}
          />
          <Button
            variant="danger"
            size="sm"
            className="justify-self-start"
            onPress={() => setExamples(examples.filter((_, i) => i !== n))}
          >
            <Icon name="trash" className="size-3.5" />
            Remove example {n + 1}
          </Button>
        </fieldset>
      ))}
      <Button
        size="sm"
        className="justify-self-start"
        isDisabled={examples.length >= MAX_EXAMPLES}
        onPress={() =>
          setExamples([...examples, { title: "", description: "" }])
        }
      >
        <Icon name="plus" className="size-3.5" />
        Add example
      </Button>
    </div>
  );
};

/** Generation settings and example listings, collapsed by default. */
export const AdvancedOptions: React.FC<{ flow: ProductFlow }> = ({ flow }) => (
  <div className="grid gap-3">
    <Section
      title="Generation settings"
      description="Language, length, model and temperature"
    >
      <GenerationSettings flow={flow} />
    </Section>
    <Section
      title="Example listings"
      description={
        flow.examples.length
          ? `${flow.examples.length} example(s)`
          : "Optional, to set tone and style"
      }
    >
      <ExamplesEditor flow={flow} />
    </Section>
  </div>
);
