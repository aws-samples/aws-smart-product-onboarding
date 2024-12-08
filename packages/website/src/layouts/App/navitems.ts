/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { SideNavigationProps } from "@cloudscape-design/components";

/**
 * Define your Navigation Items here
 */
export const NavItems: SideNavigationProps.Item[] = [
  { text: "Home", type: "link", href: "/" },
  {
    text: "Onboard Product",
    type: "link",
    href: "/smartProductOnboarding",
  },
  {
    text: "Batch Product Onboarding",
    type: "link",
    href: "/batchOnboarding",
  },
  { type: "divider" },
  {
    text: "Individual Demos",
    type: "expandable-link-group",
    href: "#",
    defaultExpanded: false,
    items: [
      { text: "Product Data Generator", type: "link", href: "/genProductData" },
    ],
  },
];
