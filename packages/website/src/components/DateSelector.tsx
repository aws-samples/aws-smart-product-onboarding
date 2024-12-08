/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import DateRangePicker, {
  DateRangePickerProps,
} from "@cloudscape-design/components/date-range-picker";
import { useEffect, useState } from "react";

export function getLocalIsoTzOffset() {
  // local time zone offset
  const now = new Date(Date.now());
  const tzOffset = now.getTimezoneOffset();
  const tzOffestHours = Math.floor(tzOffset / 60);
  const tzOffsetMinutes = tzOffset % 60;
  return `${tzOffestHours >= 0 ? "+" : "-"}${String(tzOffestHours).padStart(
    2,
    "0",
  )}:${String(tzOffsetMinutes).padStart(2, "0")}`;
}

const DateSelector = (props: {
  handleNewDates: (startDate: string, endDate: string) => void;
  startDate?: string;
  endDate?: string;
}) => {
  const [value, setValue] = useState<DateRangePickerProps.Value | null>(
    !!(props.startDate && props.endDate)
      ? {
          startDate: props.startDate,
          endDate: props.endDate,
          type: "absolute",
        }
      : null,
  );

  const validateRange = (
    range: DateRangePickerProps.Value | null,
  ): DateRangePickerProps.ValidationResult => {
    if (range === null) {
      return {
        valid: true,
      };
    }

    const differenceInDays = (dateOne: string, dateTwo: string) => {
      const milliseconds = Math.abs(
        new Date(dateTwo).valueOf() - new Date(dateOne).valueOf(),
      );
      return Math.ceil(milliseconds / (1000 * 60 * 60 * 24));
    };
    if (range.type === "absolute") {
      const [startDateWithoutTime] = range.startDate.split("T");
      const [endDateWithoutTime] = range.endDate.split("T");

      if (!startDateWithoutTime || !endDateWithoutTime) {
        return {
          valid: false,
          errorMessage: "Select a start and end date for the date range.",
        };
      }
      if (
        new Date(range.startDate).valueOf() -
          new Date(range.endDate).valueOf() >
        0
      ) {
        setValue({
          ...range,
          startDate: range.endDate,
          endDate: range.startDate,
        });
        return {
          valid: false,
          errorMessage: "Start date must be before end date. Swapping.",
        };
      }
      if (differenceInDays(range.startDate, range.endDate) < 1) {
        return {
          valid: false,
          errorMessage: "Select a range larger than 1 days.",
        };
      }
    }
    return { valid: true };
  };

  useEffect(() => {
    if (value !== null && validateRange(value) && value.type === "absolute") {
      const tz = getLocalIsoTzOffset();

      const startDate = value.startDate.split("T")[0] + `T00:00:00${tz}`;
      const endDate = value.endDate.split("T")[0] + `T23:59:59${tz}`;
      props.handleNewDates(startDate, endDate);
    }
  }, [value]);

  return (
    <DateRangePicker
      value={value}
      dateOnly={true}
      placeholder="Filter by a date range"
      rangeSelectorMode="absolute-only"
      isValidRange={(range) => validateRange(range)}
      relativeOptions={[]}
      onChange={({ detail }) => setValue(detail.value)}
      showClearButton={true}
    />
  );
};

export default DateSelector;
