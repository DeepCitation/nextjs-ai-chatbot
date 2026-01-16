"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "framer-motion";
import { FileTextIcon, ImageIcon, Loader2Icon } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { memo, useState } from "react";
import type { Attachment, ChatMessage, DeepCitationData } from "@/lib/types";
import { Suggestion } from "./elements/suggestion";
import type { VisibilityType } from "./visibility-selector";

const SAMPLE_FILE_ACTIONS = [
  {
    name: "PPT1.pdf",
    url: "/samples/PPT1.pdf",
    contentType: "application/pdf",
    icon: FileTextIcon,
    question: "What are the key findings in this Oral DNA Labs report?",
  },
  {
    name: "john-doe-50-m-chart.jpg",
    url: "/samples/john-doe-50-m-chart.jpg",
    contentType: "image/jpeg",
    icon: ImageIcon,
    question: "What patient information is shown in this medical chart?",
  },
];

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: VisibilityType;
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  setDeepCitation: Dispatch<SetStateAction<DeepCitationData>>;
};

function PureSuggestedActions({
  chatId,
  sendMessage,
  setAttachments,
  setDeepCitation,
}: SuggestedActionsProps) {
  const [loadingFile, setLoadingFile] = useState<string | null>(null);

  const handleSampleAction = async (sample: (typeof SAMPLE_FILE_ACTIONS)[number]) => {
    if (loadingFile) return;

    setLoadingFile(sample.name);

    try {
      // Fetch the file locally
      const response = await fetch(sample.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${sample.name}`);
      }

      const blob = await response.blob();

      // Upload to our API
      const formData = new FormData();
      formData.append("file", new File([blob], sample.name, { type: sample.contentType }));

      const uploadResponse = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      const { url, contentType } = await uploadResponse.json();

      const attachment: Attachment = {
        name: sample.name,
        contentType: contentType,
        url: url,
      };

      // Prepare file with DeepCitation
      setDeepCitation((prev) => ({ ...prev, enabled: true, isPreparing: true }));

      const prepareResponse = await fetch("/api/deepcitation/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [{ url, filename: sample.name }],
        }),
      });

      if (!prepareResponse.ok) {
        throw new Error("Failed to prepare file for citation");
      }

      const prepareData = await prepareResponse.json();

      // Send message with file and DeepCitation data
      window.history.pushState({}, "", `/chat/${chatId}`);
      sendMessage(
        {
          role: "user",
          parts: [
            {
              type: "file",
              url: attachment.url,
              mediaType: attachment.contentType,
            } as any,
            {
              type: "text",
              text: sample.question,
            },
          ],
        },
        {
          body: {
            deepCitation: {
              enabled: true,
              deepTextPromptPortion: prepareData.deepTextPromptPortion,
              fileDataParts: prepareData.fileDataParts,
            },
          },
        }
      );

      // Reset state
      setAttachments([]);
      setDeepCitation({ enabled: true });
    } catch (error) {
      console.error("Error with sample action:", error);
      setDeepCitation((prev) => ({ ...prev, isPreparing: false }));
    } finally {
      setLoadingFile(null);
    }
  };

  return (
    <div
      className="grid w-full gap-2 sm:grid-cols-2"
      data-testid="suggested-actions"
    >
      {SAMPLE_FILE_ACTIONS.map((sample, index) => {
        const Icon = sample.icon;
        const isLoading = loadingFile === sample.name;

        return (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            initial={{ opacity: 0, y: 20 }}
            key={sample.name}
            transition={{ delay: 0.05 * index }}
          >
            <Suggestion
              className="h-auto w-full whitespace-normal p-3 text-left"
              disabled={!!loadingFile}
              onClick={() => handleSampleAction(sample)}
              suggestion={sample.question}
            >
              <span className="flex items-center gap-2">
                <span className="flex-1">{sample.question}</span>
                {isLoading ? (
                  <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                )}
              </span>
            </Suggestion>
          </motion.div>
        );
      })}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }

    return true;
  }
);
