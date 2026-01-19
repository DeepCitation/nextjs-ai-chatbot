"use client";

import {
  getAllCitationsFromLlmOutput,
  type Citation,
  type Verification,
} from "@deepcitation/deepcitation-js";
import {
  CitationComponent,
  generateCitationKey,
} from "@deepcitation/deepcitation-js/react";
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
      console.log("[CitationProvider] Extracted citations:", {
        count: Object.keys(extractedCitations).length,
        keys: Object.keys(extractedCitations),
        citations: extractedCitations,
      });
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
      console.log("[CitationProvider] Starting verification for", Object.keys(citations).length, "citations");

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
          console.log("[CitationProvider] Verification result:", {
            hasVerifications: !!result.verifications,
            verificationCount: Object.keys(result.verifications || {}).length,
            verificationKeys: Object.keys(result.verifications || {}),
            verifications: result.verifications,
          });
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

// Custom cite component for use with markdown renderer (Streamdown)
// Maps to DeepCitation's <cite attachment_id='...' reasoning='...' key_span='...' full_phrase='...' start_page_key='...' line_ids='...' />
interface CiteProps {
  attachment_id?: string;
  reasoning?: string;
  key_span?: string;
  full_phrase?: string;
  start_page_key?: string;
  line_ids?: string;
  timestamps?: string;
  children?: ReactNode;
  node?: unknown; // react-markdown passes this
  [key: string]: unknown;
}

export function Cite({
  attachment_id,
  reasoning,
  key_span,
  full_phrase,
  start_page_key,
  line_ids,
  timestamps,
  children,
}: CiteProps) {
  const { citations, verifications } = useCitationContext();

  // Parse line_ids from string format (e.g., "2-6" or "4")
  let lineIds: number[] | null = null;
  if (line_ids) {
    const parts = line_ids.split("-").map((n) => parseInt(n.trim(), 10));
    if (parts.length === 2) {
      lineIds = [];
      for (let i = parts[0]; i <= parts[1]; i++) {
        lineIds.push(i);
      }
    } else if (parts.length === 1 && !isNaN(parts[0])) {
      lineIds = [parts[0]];
    }
  }

  // Parse timestamps from string format (e.g., "HH:MM:SS.SSS-HH:MM:SS.SSS")
  let parsedTimestamps: { startTime?: string; endTime?: string } | undefined;
  if (timestamps) {
    const [startTime, endTime] = timestamps.split("-");
    parsedTimestamps = { startTime, endTime };
  }

  // Build citation from props (matching DeepCitation's Citation interface)
  const citation: Citation = {
    attachmentId: attachment_id,
    reasoning: reasoning,
    keySpan: key_span,
    fullPhrase: full_phrase || (typeof children === "string" ? children : undefined),
    startPageKey: start_page_key,
    lineIds: lineIds,
    timestamps: parsedTimestamps,
  };

  // Generate the citation key using the same algorithm as the library
  const citationKey = generateCitationKey(citation);

  // Look up the matched citation and verification from context
  // The keys should match since we use the same generateCitationKey function
  const matchedCitation = citations[citationKey] || citation;
  const matchedVerification = verifications[citationKey];

  // Log for debugging
  console.log("[Cite] Rendering citation:", {
    props: { attachment_id, key_span, full_phrase, start_page_key },
    generatedKey: citationKey,
    availableCitationKeys: Object.keys(citations),
    availableVerificationKeys: Object.keys(verifications),
    hasMatchedCitation: !!citations[citationKey],
    hasMatchedVerification: !!matchedVerification,
    matchedVerification,
  });

  return (
    <CitationComponent
      citation={matchedCitation}
      verification={matchedVerification}
    />
  );
}

// Helper to check if content has citations
export function hasCitations(content: string): boolean {
  // Match both <cite ... /> self-closing tags AND <cite ...>...</cite> tags
  const citationRegex = /<cite\s+[^>]*(?:\/>|>)/;
  return citationRegex.test(content);
}
