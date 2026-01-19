import { DeepCitation } from "@deepcitation/deepcitation-js";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";

const requestSchema = z.object({
  files: z.array(
    z.object({
      url: z.string().url(),
      filename: z.string(),
    })
  ),
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
    const { files } = requestSchema.parse(body);

    const deepcitation = new DeepCitation({ apiKey });

    // Fetch files from URLs and convert to buffers
    const fileInputs = await Promise.all(
      files.map(async ({ url, filename }) => {
        const response = await fetch(url, { cache: "no-store" });
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return { file: buffer, filename };
      })
    );

    // Prepare files with DeepCitation
    const result = await deepcitation.prepareFiles(fileInputs);
    const { fileDataParts, deepTextPromptPortion } = result;

    return NextResponse.json({
      fileDataParts,
      deepTextPromptPortion,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("DeepCitation prepare error:", error);
    return NextResponse.json(
      { error: "Failed to prepare files for citation" },
      { status: 500 }
    );
  }
}
