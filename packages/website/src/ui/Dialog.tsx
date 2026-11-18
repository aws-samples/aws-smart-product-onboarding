/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import React from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { Button } from "./Button";
import { Icon } from "./Icon";

/** A modal panel that slides in from the right (drawer) or sits centered. */
export const ModalPanel: React.FC<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  eyebrow?: string;
  placement?: "side" | "center";
  isDismissable?: boolean;
  children: React.ReactNode;
}> = ({
  isOpen,
  onOpenChange,
  title,
  eyebrow,
  placement = "side",
  isDismissable = true,
  children,
}) => (
  <ModalOverlay
    isOpen={isOpen}
    onOpenChange={onOpenChange}
    isDismissable={isDismissable}
    isKeyboardDismissDisabled={!isDismissable}
    className={`fixed inset-0 z-40 flex bg-black/55 ${placement === "side" ? "justify-end" : "items-center justify-center p-4"}`}
  >
    <Modal
      className={
        placement === "side"
          ? "bg-surface border-line-2 h-full w-full max-w-[480px] overflow-y-auto border-l"
          : "panel max-h-[92vh] w-full max-w-3xl overflow-y-auto"
      }
    >
      <Dialog className="grid gap-5 p-6 outline-none">
        {({ close }) => (
          <>
            <header className="flex items-start gap-3">
              <div>
                {eyebrow && <p className="eyebrow">{eyebrow}</p>}
                <Heading slot="title" className="text-lg font-bold">
                  {title}
                </Heading>
              </div>
              <Button
                variant="quiet"
                size="sm"
                className="ml-auto"
                onPress={close}
                isDisabled={!isDismissable}
                aria-label="Close"
              >
                <Icon name="close" />
              </Button>
            </header>
            {children}
          </>
        )}
      </Dialog>
    </Modal>
  </ModalOverlay>
);
