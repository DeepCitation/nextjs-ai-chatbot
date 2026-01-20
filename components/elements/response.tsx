"use client";

import { type ComponentProps, memo, useMemo } from "react";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { defaultRehypePlugins, Streamdown } from "streamdown";
import { Cite } from "@/components/citation";
import { cn } from "@/lib/utils";

type ResponseProps = ComponentProps<typeof Streamdown>;

// Extend the default sanitize schema to allow cite tags with DeepCitation attributes
const citeSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), "cite"],
  attributes: {
    ...defaultSchema.attributes,
    cite: [
      "attachment_id",
      "reasoning",
      "key_span",
      "full_phrase",
      "start_page_key",
      "line_ids",
      "timestamps",
    ],
  },
};

export const Response = memo(
  ({ className, components, rehypePlugins, ...props }: ResponseProps) => {
    // Build rehype plugins with custom sanitize schema that allows cite tags
    const customRehypePlugins = useMemo(() => [
      defaultRehypePlugins.raw,
      defaultRehypePlugins.katex,
      [rehypeSanitize, citeSanitizeSchema],
      defaultRehypePlugins.harden,
      ...(rehypePlugins || []),
    ], [rehypePlugins]);

    return (
      <Streamdown
        className={cn(
          "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:whitespace-pre-wrap [&_code]:break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto",
          className
        )}
        components={{
          cite: Cite as any,
          ...components,
        }}
        rehypePlugins={customRehypePlugins as any}
        {...props}
      />
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = "Response";
