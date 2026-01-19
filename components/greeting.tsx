"use client";

import { motion } from "framer-motion";
import { FileTextIcon, UploadIcon } from "lucide-react";

export const Greeting = () => {
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
      </motion.div>
    </div>
  );
};
