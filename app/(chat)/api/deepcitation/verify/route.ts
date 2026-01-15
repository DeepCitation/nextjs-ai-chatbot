import { DeepCitation } from "@deepcitation/deepcitation-js";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";

const requestSchema = z.object({
  llmOutput: z.string(),
  fileDataParts: z
    .array(
      z.object({
        fileId: z.string(),
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

    const deepcitation = new DeepCitation({ apiKey });

    // Verify all citations from LLM output
    const result = await deepcitation.verifyCitationsFromLlmOutput({
      llmOutput,
      fileDataParts,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("DeepCitation verify error:", error);
    return NextResponse.json(
      { error: "Failed to verify citations" },
      { status: 500 }
    );
  }
}
