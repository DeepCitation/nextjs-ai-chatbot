"use client";

import { type ComponentProps, memo } from "react";
import rehypeRaw from "rehype-raw";
import { Streamdown } from "streamdown";
import { Cite } from "@/components/citation";
import { cn } from "@/lib/utils";

type ResponseProps = ComponentProps<typeof Streamdown>;

export const Response = memo(
  ({ className, components, rehypePlugins, ...props }: ResponseProps) => (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:whitespace-pre-wrap [&_code]:break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto",
        className
      )}
      components={{
        cite: Cite as any,
        ...components,
      }}
      rehypePlugins={[rehypeRaw, ...(rehypePlugins || [])]}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = "Response";
