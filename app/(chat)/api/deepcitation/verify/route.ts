import { DeepCitation } from "@deepcitation/deepcitation-js";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";

const requestSchema = z.object({
  llmOutput: z.string(),
  fileDataParts: z
    .array(
      z.object({
        attachmentId: z.string(),
        deepTextPromptPortion: z.string(),
        filename: z.string().optional(),
      })
    )
    .optional(),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.DEEPCITATION_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "DeepCitation API key not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { llmOutput, fileDataParts } = requestSchema.parse(body);

    // Log the verification request
    console.log("\n========== DeepCitation Verify Request ==========");
    console.log("LLM Output (first 500 chars):");
    console.log(llmOutput.substring(0, 500) + (llmOutput.length > 500 ? "..." : ""));
    console.log("\nFile Data Parts:");
    console.log(JSON.stringify(fileDataParts?.map(f => ({
      attachmentId: f.attachmentId,
      filename: f.filename,
      promptLength: f.deepTextPromptPortion?.length,
    })), null, 2));
    console.log("=================================================\n");

    const deepcitation = new DeepCitation({ apiKey });

    // Note: In deepcitation-js 1.1.39, the method was renamed from verifyAll to verify
    // verifyAttachment is also available for per-attachment verification with pre-parsed citations
    const result = await deepcitation.verify({
      llmOutput,
      fileDataParts,
    });

    // Log the verification result
    console.log("\n========== DeepCitation Verify Result ==========");
    console.log("Verifications count:", Object.keys(result.verifications || {}).length);
    console.log("Verifications:");
    console.log(JSON.stringify(result.verifications, null, 2));
    console.log("================================================\n");

    return NextResponse.json(result);
  } catch (error) {
    console.error("DeepCitation verify error:", error);
    return NextResponse.json(
      { error: "Failed to verify citations" },
      { status: 500 }
    );
  }
}
