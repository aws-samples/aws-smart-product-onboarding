/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import createFetchClient, { type Client, type Middleware } from "openapi-fetch";
import createClient, { type OpenapiQueryClient } from "openapi-react-query";
import React, { createContext, useContext, useMemo } from "react";
import type { components, paths } from "./schema";

export type Schemas = components["schemas"];
export type ProductData = Schemas["ProductData"];
export type Classification = Schemas["CategorizeProductResponseContent"];
export type ProductAttribute = Schemas["ProductAttribute"];
export type BatchExecution = Schemas["BatchExecution"];
export type BatchExecutionStatus = Schemas["BatchExecutionStatus"];
export type GenerationModel = NonNullable<
  Schemas["GenProductRequestContent"]["model"]
>;
export type DescriptionLength = NonNullable<
  Schemas["GenProductRequestContent"]["descriptionLength"]
>;

export type FetchClient = Client<paths>;

/**
 * Sends the Cognito ID token, unchanged and without a "Bearer" prefix, in the
 * Authorization header. The API's Cognito user pool authorizer expects that format.
 * Without a token the session has ended, so the request is not sent at all.
 */
export const authMiddleware = (
  getIdToken: () => Promise<string | undefined>,
): Middleware => ({
  async onRequest({ request }) {
    const token = await getIdToken();
    if (!token) throw new Error("Your session has ended. Sign in again.");
    request.headers.set("Authorization", token);
    return request;
  },
});

export const createApiClients = (
  baseUrl: string,
  getIdToken: () => Promise<string | undefined>,
) => {
  const fetchClient = createFetchClient<paths>({ baseUrl });
  fetchClient.use(authMiddleware(getIdToken));
  return { fetchClient, $api: createClient(fetchClient) };
};

interface ApiClients {
  fetchClient: FetchClient;
  $api: OpenapiQueryClient<paths>;
}

const ApiContext = createContext<ApiClients | undefined>(undefined);

export const ApiProvider: React.FC<{
  baseUrl: string;
  getIdToken: () => Promise<string | undefined>;
  children: React.ReactNode;
}> = ({ baseUrl, getIdToken, children }) => {
  const clients = useMemo(
    () => createApiClients(baseUrl, getIdToken),
    [baseUrl, getIdToken],
  );
  return <ApiContext.Provider value={clients}>{children}</ApiContext.Provider>;
};

export const useApi = (): ApiClients => {
  const clients = useContext(ApiContext);
  if (!clients) throw new Error("useApi must be used inside ApiProvider");
  return clients;
};

/** The API returns `{ message }` error bodies; some handlers return a plain string. */
export const errorMessage = (
  error: unknown,
  fallback = "Something went wrong",
): string => {
  if (typeof error === "string" && error) return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
};

/** Model throttling and invalid model output come back as "Retryable error". */
export const isRetryable = (error: unknown) =>
  errorMessage(error, "").startsWith("Retryable");

/** A content filter blocked the model. The same input is blocked again, so it is not retried. */
export const isContentFiltered = (error: unknown) =>
  errorMessage(error, "").startsWith("Blocked by the model's content filter");

/** Retry policy for the model-backed operations: 3 retries, longer waits when the model is throttled. */
export const modelRetry = {
  retry: (failureCount: number, error: unknown) =>
    failureCount < 3 && !isContentFiltered(error),
  retryDelay: (attempt: number, error: unknown) => {
    const base = isRetryable(error) ? 10_000 : 1_000;
    return base * 2 ** attempt + Math.random() * 1_000;
  },
};

/** Gets a presigned URL from the API and uploads the file to it. Returns the S3 object key. */
export async function uploadFile(
  fetchClient: FetchClient,
  file: Blob,
  fileName: string,
  contentType: string,
): Promise<string> {
  const { data, error } = await fetchClient.POST("/uploadFile", {
    body: { fileName },
  });
  if (!data?.url || !data.objectKey) {
    throw new Error(
      errorMessage(error, `Could not get an upload URL for ${fileName}`),
    );
  }
  const response = await fetch(data.url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!response.ok) {
    throw new Error(
      `Uploading ${fileName} failed with status ${response.status}`,
    );
  }
  return data.objectKey;
}
