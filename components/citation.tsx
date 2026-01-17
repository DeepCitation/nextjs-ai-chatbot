"use client";

import {
  getAllCitationsFromLlmOutput,
  parseCitation,
  type Citation,
  type Verification,
} from "@deepcitation/deepcitation-js";
import { CitationComponent } from "@deepcitation/deepcitation-js/react";
import {
  createContext,
  memo,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// Context for sharing citation/verification data
interface CitationContextValue {
  citations: Record<string, Citation>;
  verifications: Record<string, Verification>;
}

const CitationContext = createContext<CitationContextValue>({
  citations: {},
  verifications: {},
});

export function useCitationContext() {
  return useContext(CitationContext);
}

interface CitationProviderProps {
  content: string;
  fileDataParts?: Array<{
    attachmentId: string;
    deepTextPromptPortion: string;
    filename?: string;
  }>;
  children: ReactNode;
}

function PureCitationProvider({
  content,
  fileDataParts,
  children,
}: CitationProviderProps) {
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

  return (
    <CitationContext.Provider value={{ citations, verifications }}>
      {children}
    </CitationContext.Provider>
  );
}

export const CitationProvider = memo(PureCitationProvider);

// Custom cite component for use with markdown renderer
interface CiteProps {
  attachment_id?: string;
  page?: string;
  start_page?: string;
  children?: ReactNode;
  [key: string]: unknown;
}

export function Cite({ attachment_id, page, start_page, children }: CiteProps) {
  const { citations, verifications } = useCitationContext();

  // Build citation from props
  const citation: Citation = {
    attachmentId: attachment_id,
    pageNumber: page ? parseInt(page, 10) : undefined,
    startPageKey: start_page,
    fullPhrase: typeof children === "string" ? children : undefined,
  };

  // Try to find matching citation and verification by attachment_id
  const citationKey = Object.keys(citations).find((key) => {
    const c = citations[key];
    return c.attachmentId === attachment_id;
  });

  const matchedCitation = citationKey ? citations[citationKey] : citation;
  const matchedVerification = citationKey ? verifications[citationKey] : undefined;

  return (
    <CitationComponent
      citation={matchedCitation}
      verification={matchedVerification}
    />
  );
}

// Legacy component for backwards compatibility
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
  }, [content, fileDataParts]);

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
  // Match both <cite ... /> self-closing tags AND <cite ...>...</cite> tags
  const citationRegex = /<cite\s+[^>]*(?:\/>|>(?:.*?)<\/cite>)/g;
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
      content: match[0], // The full cite tag
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
  // Match both <cite ... /> self-closing tags AND <cite ...>...</cite> tags
  const citationRegex = /<cite\s+[^>]*(?:\/>|>)/;
  return citationRegex.test(content);
}
