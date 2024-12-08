/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { ProductData } from "@aws-samples/smart-product-onboarding-api-typescript-react-query-hooks";
import {
  Button,
  Container,
  Header,
  SpaceBetween,
  Textarea,
  FormField,
  Input,
} from "@cloudscape-design/components";

export interface ExamplesProps {
  value: ProductData[];
  setValue: React.Dispatch<React.SetStateAction<ProductData[]>>;
}

const Examples: React.FC<ExamplesProps> = (props: ExamplesProps) => {
  const { value, setValue } = props;

  return (
    <SpaceBetween direction="vertical" size="xs">
      {value.map((example, index) => (
        <Container
          header={
            <Header
              variant="h3"
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      setValue((prevState) => [
                        ...prevState.slice(0, index),
                        ...prevState.slice(index + 1),
                      ]);
                    }}
                    variant="icon"
                    iconName="remove"
                  />
                </SpaceBetween>
              }
            >
              Example {index + 1}
            </Header>
          }
        >
          <SpaceBetween direction="vertical" size="xs">
            <FormField label="Title">
              <Input
                value={example.title}
                onChange={(e) => {
                  setValue((prevState) => {
                    const newState = [...prevState];
                    newState[index].title = e.detail.value;
                    return newState;
                  });
                }}
              />
            </FormField>
            <FormField label="Description">
              <Textarea
                value={example.description}
                onChange={(e) => {
                  setValue((prevState) => {
                    const newState = [...prevState];
                    newState[index].description = e.detail.value;
                    return newState;
                  });
                }}
              />
            </FormField>
          </SpaceBetween>
        </Container>
      ))}
      <SpaceBetween direction="horizontal" size="xs">
        <Button
          onClick={(e) => {
            e.preventDefault();
            setValue([]);
          }}
        >
          Clear
        </Button>
        <Button
          variant="primary"
          onClick={(e) => {
            e.preventDefault();
            setValue((prevState) => [
              ...prevState,
              { title: "", description: "" },
            ]);
          }}
        >
          Add
        </Button>
      </SpaceBetween>
    </SpaceBetween>
  );
};

export default Examples;
