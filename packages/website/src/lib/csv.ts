/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

/** Splits CSV text into rows of fields, honouring quoted fields with commas, quotes and line breaks. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface CsvSummary {
  columns: string[];
  rows: number;
}

export function summarizeCsv(text: string): CsvSummary {
  const [header = [], ...rest] = parseCsv(text);
  return {
    columns: header.map((c) => c.trim().toLowerCase()).filter(Boolean),
    rows: rest.filter((r) => r.some((f) => f.trim())).length,
  };
}

/**
 * Checks the catalog against the columns the batch workflow needs.
 * Returns an error message, or undefined when the file is usable.
 */
export function validateCatalog(
  summary: CsvSummary,
  hasImagesZip: boolean,
): string | undefined {
  const { columns, rows } = summary;
  if (!columns.length) return "The file appears to be empty.";
  const hasText = columns.includes("title") && columns.includes("description");
  const hasImages = columns.includes("images");
  if (!hasText && !hasImages) {
    return "The CSV needs 'title' and 'description' columns, or an 'images' column.";
  }
  if (rows === 0) return "The CSV has a header row but no products.";
  if (hasImages && !hasImagesZip)
    return "The CSV has an 'images' column. Add the ZIP file with those images.";
  return undefined;
}

export const isCsvFile = (file: File) =>
  /\.csv$/i.test(file.name) ||
  ["text/csv", "text/plain", "application/vnd.ms-excel"].includes(file.type);

export const isZipFile = (file: File) =>
  /\.zip$/i.test(file.name) ||
  ["application/zip", "application/x-zip-compressed"].includes(file.type);

/** A catalog that works without an images ZIP: products with text, plus optional metadata. */
export const SAMPLE_CSV = `title,short_description,description,metadata
"Vintage Leather Bag","Handcrafted messenger bag","This authentic leather messenger bag features premium craftsmanship with hand-stitched details. It has an adjustable shoulder strap, brass hardware, and several interior compartments.","Material: genuine leather
Color: brown"
"Ceramic Pour-Over Coffee Dripper","Single-cup coffee dripper","A glazed ceramic dripper that brews one cup at a time. Its spiral ribs keep the filter from sticking so water flows evenly.","Fits size 02 filters"
`;
