/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  Container,
  ContentLayout,
  Header,
  SpaceBetween,
  // Spinner,
} from "@cloudscape-design/components";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
// import { useSayHello } from "@aws-samples/smart-product-onboarding-api-typescript-react-query-hooks";

/**
 * Component to render the home "/" route.
 */
const Home: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => navigate("/smartProductOnboarding"), []);

  // const sayHello = useSayHello({ name: "World" });

  return (
    <ContentLayout header={<Header>Home</Header>}>
      <SpaceBetween size="l">
        <Container>
          Hello World!
          {/* {sayHello.isLoading ? <Spinner /> : <>{sayHello.data?.message}</>} */}
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
};

export default Home;
