/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import EmptyState from "@aws-northstar/ui/components/Table/components/EmptyState";
import {
  useListBatchExecutions,
  BatchExecution,
  useDownloadFile,
} from "@aws-samples/smart-product-onboarding-api-typescript-react-query-hooks";
import { useCollection } from "@cloudscape-design/collection-hooks";
import {
  Button,
  ColumnLayout,
  ContentLayout,
  Header,
  Icon,
  Link,
  Popover,
  Spinner,
  StatusIndicator,
  Table,
} from "@cloudscape-design/components";
import { OptionDefinition } from "@cloudscape-design/components/internal/components/option/interfaces";
import { useState } from "react";
import CreateBatch from "../../components/BatchOnboarding/CreateBatch";
import DateSelector, {
  getLocalIsoTzOffset,
} from "../../components/DateSelector";
import RefreshInterval from "../../components/RefreshInterval";
import { useGlobalUIContext } from "../../hooks/useGlobalUIContext";

function DownloadBatchLink(props: { item: BatchExecution }) {
  const downloadFile = useDownloadFile({
    onSuccess: (presignedUrlResponse) => {
      console.log(presignedUrlResponse);
      const url = presignedUrlResponse.url;

      if (!url) {
        console.error(`Invalid URL!`);
        return;
      }

      const link = document.createElement("a");
      link.href = url;
      link.download = "";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
  });

  function handleDownload() {
    console.log(props.item);

    if (!props.item.outputKey) {
      console.warn("Execution does not have an outputKey.");
      return;
    }

    downloadFile.mutate({
      downloadFileRequestContent: {
        outputKey: props.item.outputKey,
      },
    });
  }

  return (
    <Link href="#" onFollow={handleDownload}>
      {downloadFile.isLoading ? <Spinner /> : <Icon name="download" />}
    </Link>
  );
}

const BatchOnboarding: React.FC = () => {
  const [createBatchVisible, setCreateBatchVisible] = useState(false);
  const [executionRefreshInterval, setExecutionRefreshInterval] =
    useState<OptionDefinition>({
      label: "1 minute",
      value: "60000",
    });

  const { setHelpPanelTopic, makeHelpPanelHandler } = useGlobalUIContext();

  setHelpPanelTopic("batch-onboarding:overview");

  // default is 1000 days ago in yyyy-mm-dd
  const now = Date.now();
  const tz = getLocalIsoTzOffset();
  const defaultStartDate =
    new Date(now - 1000 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] +
    `T00:00:00${tz}`;
  const defaultEndDate =
    new Date(now).toISOString().split("T")[0] + `T23:59:59${tz}`;
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);

  function handleNewDates(newStartDate: string, newEndDate: string) {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  }

  const executions = useListBatchExecutions(
    {
      startTime: startDate,
      endTime: endDate,
    },
    {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchInterval: executionRefreshInterval.value
        ? parseInt(executionRefreshInterval.value)
        : false,
    },
  );

  const { items, actions, collectionProps } = useCollection(
    executions.data?.executions ?? [],
    {
      filtering: {
        empty: (
          <EmptyState title="No batches" subtitle="No batches to display." />
        ),
        noMatch: (
          <EmptyState
            title="No matches"
            subtitle="We can’t find a match."
            action={
              <Button onClick={() => actions.setFiltering("")}>
                Clear filter
              </Button>
            }
          />
        ),
      },
      sorting: {
        defaultState: {
          sortingColumn: {
            sortingField: "updatedAt",
          },
          isDescending: true,
        },
      },
    },
  );

  const onCreateBatch = () => {
    void executions.refetch();
  };

  return (
    <ContentLayout
      header={
        <Header
          actions={
            <Button
              variant="primary"
              onClick={(e) => {
                e.preventDefault();
                setCreateBatchVisible(true);
              }}
            >
              New Onboarding
            </Button>
          }
        >
          Batch Product Onboarding
          <Link
            variant="info"
            onClick={() => {
              makeHelpPanelHandler("batch-onboarding:overview");
            }}
          >
            Info
          </Link>
        </Header>
      }
    >
      {createBatchVisible ? (
        <CreateBatch
          visible={createBatchVisible}
          setVisible={setCreateBatchVisible}
          onCreateBatch={onCreateBatch}
        />
      ) : (
        <Table
          // nosemgrep: react-props-spreading
          {...collectionProps}
          header={
            <ColumnLayout columns={2}>
              <DateSelector
                handleNewDates={handleNewDates}
                startDate={startDate}
                endDate={endDate}
              />
              <RefreshInterval
                dataUpdatedAt={executions.dataUpdatedAt}
                isFetching={executions.isFetching}
                refetch={executions.refetch}
                refreshInterval={executionRefreshInterval}
                setRefreshInterval={setExecutionRefreshInterval}
              />
            </ColumnLayout>
          }
          items={items}
          columnDefinitions={[
            {
              id: "executionId",
              header: "Batch ID",
              cell: (item: BatchExecution) => {
                const action =
                  item.status === "SUCCESS" ? (
                    <DownloadBatchLink item={item} />
                  ) : null;
                return (
                  <>
                    {action} {item.executionId}
                  </>
                );
              },
            },
            {
              id: "status",
              header: "Status",
              sortingField: "status",
              cell: (item) => {
                switch (item.status) {
                  case "SUCCESS":
                    return (
                      <StatusIndicator type="success">
                        Completed
                      </StatusIndicator>
                    );
                  case "ERROR":
                    return (
                      <Popover
                        header="Error"
                        content={item.error}
                        size="medium"
                      >
                        <StatusIndicator type="error">Error</StatusIndicator>
                      </Popover>
                    );
                  case "STARTED":
                  case "WAITING":
                  case "QUEUED":
                    return (
                      <StatusIndicator type="pending">
                        {item.status.charAt(0).toUpperCase() +
                          item.status.slice(1).toLowerCase()}
                      </StatusIndicator>
                    );
                  case "RUNNING":
                    return (
                      <StatusIndicator type="in-progress">
                        Running
                      </StatusIndicator>
                    );
                  default:
                    return (
                      <StatusIndicator type="info">Unknown</StatusIndicator>
                    );
                }
              },
            },
            {
              id: "createdAt",
              header: "Created",
              cell: (item) => item.createdAt,
              sortingField: "createdAt",
            },
            {
              id: "updatedAt",
              header: "Updated",
              cell: (item) => item.updatedAt,
              sortingField: "updatedAt",
            },
          ]}
          totalItemsCount={items.length}
          trackBy={"executionId"}
          loading={executions.isLoading}
        />
      )}
    </ContentLayout>
  );
};

export default BatchOnboarding;
