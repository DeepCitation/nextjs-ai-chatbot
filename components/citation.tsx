"use client";

import {
  getAllCitationsFromLlmOutput,
  parseCitation,
  type Citation,
  type Verification,
} from "@deepcitation/deepcitation-js";
import {
  CitationComponent,
  generateCitationKey,
} from "@deepcitation/deepcitation-js/react";
import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import { Response } from "./elements/response";

interface ResponseWithCitationsProps {
  content: string;
  fileDataParts?: Array<{
    attachmentId: string;
    deepTextPromptPortion: string;
    filename?: string;
  }>;
}

/**
 * Renders markdown content with inline CitationComponent elements.
 * Parses the content to find <cite> tags, renders markdown segments with Response,
 * and inserts CitationComponent where citations appear.
 */
function PureResponseWithCitations({
  content,
  fileDataParts,
}: ResponseWithCitationsProps) {
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

  // Parse content into segments of markdown and citations
  const segments = useMemo(() => {
    const citationRegex = /<cite\s+[^>]*(?:\/>|>[^<]*<\/cite>)/g;
    const result: Array<{ type: "markdown" | "citation"; content: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = citationRegex.exec(content)) !== null) {
      // Add markdown before this citation
      if (match.index > lastIndex) {
        result.push({
          type: "markdown",
          content: content.slice(lastIndex, match.index),
        });
      }

      result.push({
        type: "citation",
        content: match[0],
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining markdown
    if (lastIndex < content.length) {
      result.push({ type: "markdown", content: content.slice(lastIndex) });
    }

    return result;
  }, [content]);

  // Render segments
  const elements: ReactNode[] = [];
  const citationKeys = Object.keys(citations);
  let citationIndex = 0;

  segments.forEach((segment, index) => {
    if (segment.type === "markdown") {
      // Only render non-empty markdown
      if (segment.content.trim()) {
        elements.push(
          <Response key={`md-${index}`}>{segment.content}</Response>
        );
      }
    } else {
      // Parse the cite tag and render CitationComponent
      const { citation } = parseCitation(segment.content);
      const citationKey = generateCitationKey(citation);

      // Look up verification - try by generated key first, then by index order
      const matchedCitation = citations[citationKey] || citation;
      let matchedVerification = verifications[citationKey];

      // Fallback: try matching by order if key doesn't match
      if (!matchedVerification && citationKeys[citationIndex]) {
        matchedVerification = verifications[citationKeys[citationIndex]];
      }

      elements.push(
        <CitationComponent
          key={`cite-${index}`}
          citation={matchedCitation}
          verification={matchedVerification}
        />
      );

      citationIndex++;
    }
  });

  return <>{elements}</>;
}

export const ResponseWithCitations = memo(PureResponseWithCitations);

// Helper to check if content has citations
export function hasCitations(content: string): boolean {
  // Match both <cite ... /> self-closing tags AND <cite ...>...</cite> tags
  const citationRegex = /<cite\s+[^>]*(?:\/>|>)/;
  return citationRegex.test(content);
}
