import { CheckIcon, Loader2Icon } from "lucide-react";
import Image from "next/image";
import type { Attachment } from "@/lib/types";
import { Loader } from "./elements/loader";
import { CrossSmallIcon } from "./icons";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./ui/tooltip";

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  isPreparing = false,
  isPrepared = false,
  onRemove,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  isPreparing?: boolean;
  isPrepared?: boolean;
  onRemove?: () => void;
}) => {
  const { name, url, contentType } = attachment;

  return (
    <div
      className="group relative size-16 overflow-hidden rounded-lg border bg-muted"
      data-testid="input-attachment-preview"
    >
      {contentType?.startsWith("image") ? (
        <Image
          alt={name ?? "An image attachment"}
          className="size-full object-cover"
          height={64}
          src={url}
          width={64}
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground text-xs">
          File
        </div>
      )}

      {isUploading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/50"
          data-testid="input-attachment-loader"
        >
          <Loader size={16} />
        </div>
      )}

      {isPreparing && !isUploading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/50"
          data-testid="input-attachment-preparing"
        >
          <Loader2Icon className="size-4 animate-spin text-white" />
        </div>
      )}

      {onRemove && !isUploading && !isPreparing && (
        <Button
          className="absolute top-0.5 right-0.5 size-4 rounded-full p-0 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={onRemove}
          size="sm"
          variant="destructive"
        >
          <CrossSmallIcon size={8} />
        </Button>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-linear-to-t from-black/80 to-transparent px-1 py-0.5">
        <span className="truncate text-[10px] text-white">{name}</span>
        {isPrepared && !isPreparing && (
          <Tooltip>
            <TooltipTrigger asChild>
              <CheckIcon className="size-3 shrink-0 text-emerald-400" />
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Ready for citations</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
};
