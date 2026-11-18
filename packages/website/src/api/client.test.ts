/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  createApiClients,
  errorMessage,
  isRetryable,
  uploadFile,
} from "./client";

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("API client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the raw ID token in Authorization and keeps the stage path", async () => {
    const fetchMock = vi.fn(async (_req: Request) => ok({ executions: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchClient } = createApiClients(
      "https://api.example.com/prod/",
      async () => "id-token-123",
    );

    await fetchClient.GET("/listBatchExecutions", {
      params: { query: { start_time: "a", end_time: "b" } },
    });

    const request = fetchMock.mock.calls[0][0];
    expect(request.headers.get("Authorization")).toBe("id-token-123");
    expect(request.url).toBe(
      "https://api.example.com/prod/listBatchExecutions?start_time=a&end_time=b",
    );
  });

  it("uploads through a presigned URL with the file's content type", async () => {
    const fetchMock = vi.fn(
      async (input: Request | string, init?: RequestInit) => {
        if (input instanceof Request)
          return ok({
            url: "https://bucket.example.com/put",
            objectKey: "uploads/x-a.csv",
          });
        expect(input).toBe("https://bucket.example.com/put");
        expect(new Headers(init?.headers).get("Content-Type")).toBe("text/csv");
        return new Response(null, { status: 200 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchClient } = createApiClients(
      "https://api.example.com/prod",
      async () => "t",
    );

    await expect(
      uploadFile(fetchClient, new Blob(["a"]), "a.csv", "text/csv"),
    ).resolves.toBe("uploads/x-a.csv");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reads error messages from the API's error bodies", () => {
    expect(errorMessage({ message: "Invalid request format" })).toBe(
      "Invalid request format",
    );
    expect(errorMessage("Retryable error")).toBe("Retryable error");
    expect(errorMessage(undefined, "fallback")).toBe("fallback");
    expect(isRetryable("Retryable error")).toBe(true);
    expect(isRetryable({ message: "Internal server error" })).toBe(false);
  });
});
