/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { FlashbarProps } from "@cloudscape-design/components";
import { AppLayoutProps } from "@cloudscape-design/components/app-layout";
import * as React from "react";
import { useCallback, useRef, useState } from "react";

export interface GlobalUIContextType {
  flashItems: FlashbarProps.MessageDefinition[];
  setFlashItems: React.Dispatch<
    React.SetStateAction<FlashbarProps.MessageDefinition[]>
  >;
  addFlashItem: (item: FlashbarProps.MessageDefinition) => void;
  toolsOpen: boolean;
  setToolsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  helpPanelTopic: string;
  setHelpPanelTopic: React.Dispatch<React.SetStateAction<string>>;
  makeHelpPanelHandler: (topic: string) => void;
  appLayoutRef?: React.MutableRefObject<any>;
}

export const GlobalUIContext = React.createContext<GlobalUIContextType>({
  flashItems: [],
  setFlashItems: () => {},
  addFlashItem: () => {},
  toolsOpen: false,
  setToolsOpen: () => {},
  helpPanelTopic: "default",
  setHelpPanelTopic: () => {},
  makeHelpPanelHandler: () => {},
  appLayoutRef: undefined,
});

const GlobalUIContextProvider: React.FC<any> = ({ children }) => {
  const [flashItems, setFlashItems] = useState<
    FlashbarProps.MessageDefinition[]
  >([]);

  const addFlashItem = (item: FlashbarProps.MessageDefinition) => {
    const id = new Date().getTime().toString();
    item.id = id;
    item.dismissible = true;
    item.onDismiss = () =>
      setFlashItems((prev) => prev.filter((f) => f.id !== id));
    setFlashItems((prev) => [...prev, item]);
  };

  const [toolsOpen, setToolsOpen] = useState(false);
  const [helpPanelTopic, setHelpPanelTopic] = useState("default");
  const appLayoutRef = useRef<AppLayoutProps.Ref>();

  const makeHelpPanelHandler = useCallback(
    (topic: string) => {
      setHelpPanelTopic(topic);
      setToolsOpen(true);
      appLayoutRef.current?.focusToolsClose();
    },
    [appLayoutRef],
  );

  const setHelpPanelTopicIfDefault: React.Dispatch<
    React.SetStateAction<string>
  > = (topic) => {
    if (helpPanelTopic === "default") {
      setHelpPanelTopic(topic);
    }
  };

  return (
    <GlobalUIContext.Provider
      value={{
        flashItems,
        setFlashItems,
        addFlashItem,
        toolsOpen,
        setToolsOpen,
        helpPanelTopic,
        setHelpPanelTopic: setHelpPanelTopicIfDefault,
        makeHelpPanelHandler,
        appLayoutRef,
      }}
    >
      {children}
    </GlobalUIContext.Provider>
  );
};

export default GlobalUIContextProvider;
