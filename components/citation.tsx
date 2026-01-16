"use client";

import {
  getAllCitationsFromLlmOutput,
  parseCitation,
  type Citation,
  type Verification,
} from "@deepcitation/deepcitation-js";
import { CitationComponent } from "@deepcitation/deepcitation-js/react";
import "@deepcitation/deepcitation-js/react/styles.css";
import { memo, useEffect, useState, type ReactNode } from "react";

interface CitationDisplayProps {
  content: string;
  fileDataParts?: Array<{
    attachmentId: string;
    deepTextPromptPortion: string;
    filename?: string;
  }>;
}

function PureCitationDisplay({ content, fileDataParts }: CitationDisplayProps) {
  const [citations, setCitations] = useState<Record<string, Citation>>({});
  const [verifications, setVerifications] = useState<
    Record<string, Verification>
  >({});
  const [isVerifying, setIsVerifying] = useState(false);
  const [hasVerified, setHasVerified] = useState(false);

  // Extract citations from content
  useEffect(() => {
    try {
      const extractedCitations = getAllCitationsFromLlmOutput(content);
      setCitations(extractedCitations);
    } catch (error) {
      console.error("Error extracting citations:", error);
    }
  }, [content]);

  // Verify citations when they are extracted
  useEffect(() => {
    if (
      Object.keys(citations).length > 0 &&
      !isVerifying &&
      !hasVerified
    ) {
      setIsVerifying(true);

      fetch("/api/deepcitation/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          llmOutput: content,
          fileDataParts,
        }),
      })
        .then((res) => res.json())
        .then((result) => {
          if (result.verifications) {
            setVerifications(result.verifications);
          }
          setHasVerified(true);
        })
        .catch((error) => {
          console.error("Error verifying citations:", error);
        })
        .finally(() => {
          setIsVerifying(false);
        });
    }
  }, [citations, content, fileDataParts, isVerifying, hasVerified]);

  // If no citations in content, return simple text
  if (Object.keys(citations).length === 0) {
    return null;
  }

  return (
    <ProcessedContent
      citations={citations}
      content={content}
      verifications={verifications}
    />
  );
}

export const CitationDisplay = memo(PureCitationDisplay);

interface ProcessedContentProps {
  content: string;
  citations: Record<string, Citation>;
  verifications: Record<string, Verification>;
}

function ProcessedContent({
  content,
  citations,
  verifications,
}: ProcessedContentProps) {
  // Match <cite ... /> tags
  const citationRegex = /<cite\s+[^>]*\/>/g;
  const parts: Array<{ type: "text" | "citation"; content: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const contentCopy = content;
  while ((match = citationRegex.exec(contentCopy)) !== null) {
    // Add text before this citation
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: content.slice(lastIndex, match.index),
      });
    }

    parts.push({
      type: "citation",
      content: match[0], // The full <cite ... /> tag
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.slice(lastIndex) });
  }

  // Get citations and verifications as arrays (preserving order)
  const citationEntries = Object.entries(citations);
  const verificationEntries = Object.entries(verifications);

  let citationIndex = 0;

  // Build the rendered content
  const elements: ReactNode[] = [];

  parts.forEach((part, index) => {
    if (part.type === "text") {
      elements.push(<span key={`text-${index}`}>{part.content}</span>);
    } else if (part.type === "citation") {
      // Match by index - citations and verifications should be in same order
      const citationEntry = citationEntries[citationIndex];
      const verificationEntry = verificationEntries[citationIndex];
      citationIndex++;

      if (citationEntry) {
        const [, citation] = citationEntry;
        const verification = verificationEntry ? verificationEntry[1] : undefined;

        elements.push(
          <CitationComponent
            citation={citation}
            key={`citation-${index}`}
            verification={verification}
          />
        );
      } else {
        // Fallback: parse the citation without verification
        const { citation } = parseCitation(part.content);
        elements.push(
          <CitationComponent
            citation={citation}
            key={`citation-${index}`}
            verification={undefined}
          />
        );
      }
    }
  });

  return <>{elements}</>;
}

// Helper to check if content has citations
export function hasCitations(content: string): boolean {
  const citationRegex = /<cite\s+[^>]*\/>/;
  return citationRegex.test(content);
}
