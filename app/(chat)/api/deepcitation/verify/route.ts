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

    console.log("📋 Verify API: Received request");
    console.log("📋 Verify API: llmOutput length:", llmOutput.length);
    console.log("📋 Verify API: llmOutput preview:", llmOutput.slice(0, 500));
    console.log("📋 Verify API: fileDataParts count:", fileDataParts?.length);
    console.log("📋 Verify API: fileDataParts:", fileDataParts?.map(f => ({ attachmentId: f.attachmentId, filename: f.filename, deepTextLength: f.deepTextPromptPortion.length })));

    const deepcitation = new DeepCitation({ apiKey });

    // Verify all citations from LLM output
    console.log("📋 Verify API: Calling verifyCitationsFromLlmOutput...");
    const result = await deepcitation.verifyCitationsFromLlmOutput({
      llmOutput,
      fileDataParts,
    });

    console.log("📋 Verify API: Result:", JSON.stringify(result, null, 2));

    return NextResponse.json(result);
  } catch (error) {
    console.error("DeepCitation verify error:", error);
    return NextResponse.json(
      { error: "Failed to verify citations" },
      { status: 500 }
    );
  }
}
