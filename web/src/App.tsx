import JSZip from "jszip";
import { AlertCircle, CheckCircle2, Download, FileText, Loader2, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { FileActions } from "@/components/file-actions";
import { Changelog1 } from "@/components/kibo-ui/changelog";
import { Dropzone, DropzoneEmptyState } from "@/components/kibo-ui/dropzone";
import { Button } from "@/components/ui/button";
import { entries } from "@/changelog";

type Status = "ready" | "converting" | "done" | "error";
type Item = { id: string; file: File; status: Status; pdf?: File; error?: string };

const accept = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/msword": [".doc"],
  "application/vnd.oasis.opendocument.text": [".odt"],
  "application/rtf": [".rtf"],
  "text/rtf": [".rtf"],
};
const MAX_BYTES = 50 * 1024 * 1024; // must match server.js

const pdfName = (name: string) => name.replace(/\.[^.]+$/, "") + ".pdf";

function save(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

async function convertOnServer(file: File): Promise<File> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/convert", { method: "POST", body });
  if (!res.ok) throw new Error(await res.text());
  return new File([await res.blob()], pdfName(file.name), { type: "application/pdf" });
}

async function saveZip(pdfs: File[]) {
  const zip = new JSZip();
  const used = new Set<string>();
  for (const pdf of pdfs) {
    let name = pdf.name;
    // Same-named inputs must not overwrite each other inside the zip.
    for (let k = 1; used.has(name); k++) name = pdf.name.replace(/\.pdf$/, ` (${k}).pdf`);
    used.add(name);
    zip.file(name, pdf);
  }
  save(await zip.generateAsync({ type: "blob" }), "converted-pdfs.zip");
}

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [dropError, setDropError] = useState<string>();
  const [online, setOnline] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetch("/health").then((r) => setOnline(r.ok)).catch(() => setOnline(false));
  }, []);

  const update = (id: string, patch: Partial<Item>) =>
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const convertOne = async (item: Item) => {
    update(item.id, { status: "converting", error: undefined });
    try {
      const pdf = await convertOnServer(item.file);
      update(item.id, { status: "done", pdf });
      return pdf;
    } catch (e) {
      const offline = e instanceof TypeError; // fetch network failure
      if (offline) setOnline(false);
      update(item.id, { status: "error", error: offline ? "Server not reachable" : (e as Error).message });
    }
  };

  const convertAll = async () => {
    setRunning(true);
    for (const item of items.filter((it) => it.status === "ready" || it.status === "error")) await convertOne(item);
    setRunning(false);
  };

  const pending = items.filter((it) => it.status === "ready" || it.status === "error").length;
  const done = items.filter((it) => it.pdf);

  return (
    <div className="min-h-svh bg-background font-sans text-foreground antialiased">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <span className="flex items-center gap-2 font-semibold">
            <FileText className="h-5 w-5 text-red-600" aria-hidden />
            Word to PDF
          </span>
          <Button variant="ghost" size="sm" asChild>
            <a href="#changelog">Changelog</a>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-16">
        <h1 className="text-center text-4xl font-bold tracking-tight md:text-5xl">Convert Word to PDF</h1>
        <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground md:text-lg">
          Same pages, columns and fonts as Word's own export. Convert several files at once, then download them one by one or as one .zip.
        </p>

        {!online && (
          <div role="alert" className="mt-8 flex gap-3 rounded-lg border border-destructive/50 p-4 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
            <p>
              <strong>The converter is offline right now.</strong> Please try again later.
            </p>
          </div>
        )}

        <Dropzone
          className="mt-10"
          accept={accept}
          maxFiles={100}
          maxSize={MAX_BYTES}
          onDrop={(files) => {
            setDropError(undefined);
            setItems((list) => [
              ...list,
              ...files.map((file) => ({ id: crypto.randomUUID(), file, status: "ready" as const })),
            ]);
          }}
          onError={(e) =>
            setDropError(
              /type/i.test(e.message) ? "Only .docx, .doc, .odt and .rtf files can be converted."
              : /larger/i.test(e.message) ? "Each file must be 50 MB or smaller."
              : e.message,
            )
          }
        >
          <DropzoneEmptyState>
            <div className="flex flex-col items-center gap-2 py-6">
              <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <FileText className="h-5 w-5" aria-hidden />
              </div>
              <p className="font-medium">Drop Word files here or click to choose</p>
              <p className="text-xs text-muted-foreground">.docx, .doc, .odt or .rtf · up to 50 MB each</p>
            </div>
          </DropzoneEmptyState>
        </Dropzone>
        {dropError && <p className="mt-2 text-sm text-destructive">{dropError}</p>}

        {items.length > 0 && (
          <ul className="mt-6 divide-y rounded-lg border">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 px-4 py-3">
                <StatusIcon status={it.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.file.name}</p>
                  <p className={`truncate text-xs ${it.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                    {it.status === "ready" && "Ready"}
                    {it.status === "converting" && "Converting…"}
                    {it.status === "done" && `Converted · ${(it.pdf!.size / 1024).toFixed(0)} KB`}
                    {it.status === "error" && `Failed: ${it.error}`}
                  </p>
                </div>
                <FileActions
                  name={it.file.name}
                  pdf={it.pdf}
                  busy={it.status === "converting"}
                  onDownload={() => save(it.pdf!, it.pdf!.name)}
                  onRetry={() => convertOne(it)}
                  onRemove={() => setItems((list) => list.filter((x) => x.id !== it.id))}
                />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button size="lg" disabled={!pending || running || !online} onClick={convertAll}>
            {running && <Loader2 className="animate-spin" />}
            {running ? "Converting…" : `Convert to PDF${pending > 1 ? ` (${pending})` : ""}`}
          </Button>
          {done.length === 1 && !running && (
            <Button size="lg" variant="outline" onClick={() => save(done[0].pdf!, done[0].pdf!.name)}>
              <Download />
              Download PDF
            </Button>
          )}
          {done.length > 1 && !running && (
            <Button size="lg" variant="outline" onClick={() => saveZip(done.map((it) => it.pdf!))}>
              <Package />
              Download as .zip ({done.length})
            </Button>
          )}
        </div>
      </main>

      <div id="changelog">
        <Changelog1
          className="px-4"
          description="New updates and improvements to the converter."
          entries={entries}
        />
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "converting") return <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" aria-hidden />;
  if (status === "done") return <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" aria-hidden />;
  if (status === "error") return <AlertCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />;
  return <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />;
}
