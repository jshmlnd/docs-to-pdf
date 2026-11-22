// Kibo UI pattern "Dropdown Menu Actions 1 / File Actions Dropdown", MIT,
// wired to real actions for a converted file.
import { Download, Eye, MoreHorizontal, RotateCw, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  name: string;
  pdf?: File;
  busy: boolean;
  onDownload: () => void;
  onRetry: () => void;
  onRemove: () => void;
};

export const FileActions = ({ name, pdf, busy, onDownload, onRetry, onRemove }: Props) => {
  const canShare = !!pdf && typeof navigator.canShare === "function" && navigator.canShare({ files: [pdf] });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" aria-label={`Actions for ${name}`}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          disabled={!pdf}
          onSelect={() => {
            const url = URL.createObjectURL(pdf!);
            window.open(url, "_blank", "noopener");
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
          }}
        >
          <Eye />
          Open PDF
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!pdf} onSelect={onDownload}>
          <Download />
          Download
        </DropdownMenuItem>
        {canShare && (
          <DropdownMenuItem onSelect={() => navigator.share({ files: [pdf!] }).catch(() => {})}>
            <Share2 />
            Share
          </DropdownMenuItem>
        )}
        <DropdownMenuItem disabled={busy} onSelect={onRetry}>
          <RotateCw />
          Convert again
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={busy} onSelect={onRemove}>
          <Trash2 />
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
