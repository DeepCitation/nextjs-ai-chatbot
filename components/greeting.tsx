"use client";

import { motion } from "framer-motion";
import { DownloadIcon, FileTextIcon, ImageIcon, Loader2Icon, UploadIcon } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import type { Attachment } from "@/lib/types";

interface GreetingProps {
  setAttachments?: Dispatch<SetStateAction<Attachment[]>>;
  setInput?: Dispatch<SetStateAction<string>>;
}

const SAMPLE_FILES = [
  {
    name: "PPT1.pdf",
    url: "/samples/PPT1.pdf",
    contentType: "application/pdf",
    icon: FileTextIcon,
    description: "Oral DNA Labs report",
    prefilledQuestion: "What are the key findings in this Oral DNA Labs report for John Doe?",
  },
  {
    name: "john-doe-50-m-chart.jpg",
    url: "/samples/john-doe-50-m-chart.jpg",
    contentType: "image/jpeg",
    icon: ImageIcon,
    description: "Patient chart",
    prefilledQuestion: "What information can you extract from this patient chart for John Doe?",
  },
];

export const Greeting = ({ setAttachments, setInput }: GreetingProps) => {
  const [loadingFile, setLoadingFile] = useState<string | null>(null);

  const handleSampleFileClick = async (file: (typeof SAMPLE_FILES)[number]) => {
    if (!setAttachments || loadingFile) return;

    setLoadingFile(file.name);

    try {
      // Fetch the file locally
      const response = await fetch(file.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${file.name}`);
      }

      const blob = await response.blob();

      // Upload to our API
      const formData = new FormData();
      formData.append("file", new File([blob], file.name, { type: file.contentType }));

      const uploadResponse = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      const { url, contentType } = await uploadResponse.json();

      // Add to attachments
      setAttachments((prev) => [
        ...prev,
        {
          name: file.name,
          contentType: contentType,
          url: url,
        },
      ]);

      // Pre-fill the input with the question
      if (setInput && file.prefilledQuestion) {
        setInput(file.prefilledQuestion);
      }
    } catch (error) {
      console.error("Error loading sample file:", error);
    } finally {
      setLoadingFile(null);
    }
  };

  const handleDownload = (file: (typeof SAMPLE_FILES)[number]) => {
    const link = document.createElement("a");
    link.href = file.url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="mx-auto mt-4 flex size-full max-w-3xl flex-col justify-center px-4 md:mt-16 md:px-8"
      key="overview"
    >
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="font-semibold text-xl md:text-2xl"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5 }}
      >
        Chat with your documents
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-xl text-zinc-500 md:text-2xl"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.6 }}
      >
        Get trustworthy, cited answers
      </motion.div>

      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 flex flex-col gap-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-900"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.7 }}
      >
        <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
          <UploadIcon className="size-5" />
          <span className="font-medium">Upload a PDF or image to get started</span>
        </div>
        <div className="flex flex-col gap-2 text-sm text-zinc-500">
          <div className="flex items-center gap-2">
            <FileTextIcon className="size-4" />
            <span>Upload documents like reports, papers, or contracts</span>
          </div>
          <div className="flex items-center gap-2">
            <FileTextIcon className="size-4" />
            <span>Ask questions and get answers with verifiable citations</span>
          </div>
          <div className="flex items-center gap-2">
            <FileTextIcon className="size-4" />
            <span>Click citations to see exact source locations</span>
          </div>
        </div>

        {setAttachments && (
          <div className="mt-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <div className="mb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Or try a sample file:
            </div>
            <div className="flex flex-col gap-3">
              {SAMPLE_FILES.map((file) => {
                const Icon = file.icon;
                const isLoading = loadingFile === file.name;

                return (
                  <div
                    key={file.name}
                    className="flex items-center gap-2"
                  >
                    <button
                      onClick={() => handleSampleFileClick(file)}
                      disabled={!!loadingFile}
                      className="flex flex-1 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                      type="button"
                    >
                      {isLoading ? (
                        <Loader2Icon className="size-4 animate-spin" />
                      ) : (
                        <Icon className="size-4 shrink-0" />
                      )}
                      <span className="truncate">{file.name}</span>
                      <span className="ml-auto hidden text-xs text-zinc-400 sm:inline">
                        {file.description}
                      </span>
                    </button>
                    <button
                      onClick={() => handleDownload(file)}
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                      type="button"
                      title={`Download ${file.name}`}
                    >
                      <DownloadIcon className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
