import type { ChangelogEntry } from "@/components/kibo-ui/changelog";

export const entries: ChangelogEntry[] = [
  {
    version: "Version 1.3.1",
    date: "22 November 2026",
    title: "Better match for older Word files",
    description:
      "Documents saved in Word 2010 format now start at the same height on the page as in Word.",
    items: [
      "Fixed text sitting lower on the page when a two-column section ends with a section break",
    ],
  },
  {
    version: "Version 1.3.0",
    date: "22 November 2026",
    title: "New interface",
    description: "The converter has a new look, built with React and Kibo UI.",
    items: [
      "Drag and drop several documents at once",
      "Actions menu on every file: open, download, share, convert again, remove",
      "Converting no longer downloads automatically: download each PDF, or all of them as one .zip",
      "Follows your system's light or dark mode",
    ],
  },
  {
    version: "Version 1.2.0",
    date: "22 November 2026",
    title: "Same layout as Word",
    description:
      "Documents are now converted on the server with LibreOffice, so pages, columns and page breaks match Word's own PDF export.",
    items: [
      "Multi-column layouts, headers, footers and page numbers kept",
      "Text in the PDF can be selected and searched",
      "PDFs are about 20× smaller",
      "Also accepts .doc, .odt and .rtf files",
    ],
  },
  {
    version: "Version 1.1.0",
    date: "22 November 2026",
    title: "Batch conversion",
    description: "Convert many documents in one go.",
    items: [
      "Several files download together as one .zip",
      "Files with the same name no longer overwrite each other",
    ],
  },
  {
    version: "Version 1.0.0",
    date: "22 November 2026",
    title: "First version",
    description: "Convert a Word document to PDF right in the browser.",
  },
];
