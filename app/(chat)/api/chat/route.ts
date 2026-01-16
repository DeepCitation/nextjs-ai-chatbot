import { wrapCitationPrompt } from "@deepcitation/deepcitation-js";
import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import { after } from "next/server";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import { auth, type UserType } from "@/app/(auth)/auth";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes("REDIS_URL")) {
        console.log(
          " > Resumable streams are disabled due to missing REDIS_URL"
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      messages,
      selectedChatModel,
      selectedVisibilityType,
      deepCitation,
    } = requestBody;

    // EARLY DEBUG: Log deepCitation immediately after parsing
    console.log("📋 EARLY DEBUG - deepCitation parsed from request:", {
      exists: !!deepCitation,
      enabled: deepCitation?.enabled,
      hasDeepTextPromptPortion: !!deepCitation?.deepTextPromptPortion,
      deepTextPromptPortionLength: deepCitation?.deepTextPromptPortion?.length,
      hasFileDataParts: !!deepCitation?.fileDataParts,
      fileDataPartsLength: deepCitation?.fileDataParts?.length,
    });

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    // Check if this is a tool approval flow (all messages sent)
    const isToolApprovalFlow = Boolean(messages);

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }
      // Only fetch messages if chat already exists and not tool approval
      if (!isToolApprovalFlow) {
        messagesFromDb = await getMessagesByChatId({ id });
      }
    } else if (message?.role === "user") {
      // Save chat immediately with placeholder title
      await saveChat({
        id,
        userId: session.user.id,
        title: "New chat",
        visibility: selectedVisibilityType,
      });

      // Start title generation in parallel (don't await)
      titlePromise = generateTitleFromUserMessage({ message });
    }

    // Use all messages for tool approval, otherwise DB messages + new message
    const uiMessages = isToolApprovalFlow
      ? (messages as ChatMessage[])
      : [...convertToUIMessages(messagesFromDb), message as ChatMessage];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    // Only save user messages to the database (not tool approval responses)
    if (message?.role === "user") {
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });
    }

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    const stream = createUIMessageStream({
      // Pass original messages for tool approval continuation
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        // Handle title generation in parallel
        if (titlePromise) {
          titlePromise.then((title) => {
            updateChatTitleById({ chatId: id, title });
            dataStream.write({ type: "data-chat-title", data: title });
          });
        }

        const isReasoningModel =
          selectedChatModel.includes("reasoning") ||
          selectedChatModel.includes("thinking");

        // Prepare system and user prompts, potentially enhanced with DeepCitation
        let finalSystemPrompt = systemPrompt({ selectedChatModel, requestHints });
        let finalMessages = await convertToModelMessages(uiMessages);

        // Debug: log DeepCitation data
        console.log("📋 DeepCitation data received:", {
          enabled: deepCitation?.enabled,
          hasDeepTextPromptPortion: !!deepCitation?.deepTextPromptPortion,
          deepTextPromptPortionLength: deepCitation?.deepTextPromptPortion?.length,
          deepTextPromptPortionFirstItemLength: deepCitation?.deepTextPromptPortion?.[0]?.length,
          hasFileDataParts: !!deepCitation?.fileDataParts,
          fileDataPartsLength: deepCitation?.fileDataParts?.length,
        });

        if (
          deepCitation?.enabled &&
          deepCitation?.deepTextPromptPortion &&
          deepCitation.deepTextPromptPortion.length > 0
        ) {
          console.log("📋 DeepCitation condition passed, entering block...");

          // Get the last user message text for enhancement
          const lastUserMessage = uiMessages.findLast((m) => m.role === "user");
          const userTextPart = lastUserMessage?.parts?.find(
            (p) => p.type === "text"
          );
          const userPrompt =
            userTextPart && "text" in userTextPart ? userTextPart.text : "";

          console.log("📋 About to call wrapCitationPrompt with:", {
            systemPromptLength: finalSystemPrompt.length,
            userPromptLength: userPrompt.length,
            deepTextPromptPortionCount: deepCitation.deepTextPromptPortion.length,
            deepTextPromptPortionFirstChars: deepCitation.deepTextPromptPortion[0]?.slice(0, 100),
          });

          // Wrap prompts with citation instructions
          const { enhancedSystemPrompt, enhancedUserPrompt } = wrapCitationPrompt(
            {
              systemPrompt: finalSystemPrompt,
              userPrompt,
              deepTextPromptPortion: deepCitation.deepTextPromptPortion,
            }
          );

          console.log("📋 wrapCitationPrompt returned:", {
            originalUserPromptLength: userPrompt.length,
            enhancedUserPromptLength: enhancedUserPrompt.length,
            enhancedSystemPromptLength: enhancedSystemPrompt.length,
            enhancedUserPromptPreview: enhancedUserPrompt.slice(0, 500),
          });

          // DEBUG: Check if system prompt was actually enhanced
          const systemPromptChanged = enhancedSystemPrompt !== finalSystemPrompt;
          const systemPromptLengthDiff = enhancedSystemPrompt.length - finalSystemPrompt.length;
          console.log("📋 CRITICAL DEBUG - system prompt changed:", systemPromptChanged);
          console.log("📋 CRITICAL DEBUG - system prompt length diff:", systemPromptLengthDiff);
          console.log("📋 CRITICAL DEBUG - enhanced system prompt ends with:", enhancedSystemPrompt.slice(-500));

          // Debug: Log the LAST part of system prompt (citation instructions are appended)
          console.log("📋 SYSTEM PROMPT CITATION INSTRUCTIONS (last 2000 chars):\n", enhancedSystemPrompt.slice(-2000));

          // Debug: Check if citation instructions are present
          const hasCitationInstructions = enhancedSystemPrompt.includes("<cite attachment_id=");
          console.log("📋 System prompt contains citation syntax example:", hasCitationInstructions);

          // Debug: Log user prompt structure
          console.log("📋 USER PROMPT STRUCTURE - starts with attachment?:", enhancedUserPrompt.startsWith("\n<attachment"));
          console.log("📋 USER PROMPT - original question at end:", enhancedUserPrompt.slice(-200));

          finalSystemPrompt = enhancedSystemPrompt;

          // Update the last user message with enhanced prompt
          // IMPORTANT: When DeepCitation is enabled, we need to REMOVE file parts from the message
          // because the file content is already embedded in the enhanced user prompt text.
          // If we keep file parts, the model sees the raw file content (without citation formatting)
          // AND the formatted DeepCitation text, which can cause confusion and the model may use
          // the raw content instead of the properly formatted content with <attachment> tags.
          const messagesArray = await convertToModelMessages(uiMessages);
          finalMessages = messagesArray.map((msg, idx) => {
            if (idx === messagesArray.length - 1 && msg.role === "user") {
              // Handle both string content and array content (multimodal)
              if (typeof msg.content === "string") {
                return {
                  ...msg,
                  content: enhancedUserPrompt,
                };
              }
              // For array content (multimodal), replace with ONLY the enhanced text prompt
              // Remove file/image parts since their content is in the enhanced text
              if (Array.isArray(msg.content)) {
                console.log("📋 FIX APPLIED: Replacing multimodal content with text-only enhanced prompt");
                console.log("📋 FIX: Original parts count:", msg.content.length);
                console.log("📋 FIX: Parts being removed:", msg.content.filter((p: any) => p.type !== "text").map((p: any) => p.type));
                return {
                  ...msg,
                  content: enhancedUserPrompt, // Use string content, not array
                };
              }
            }
            return msg;
          });

          console.log("📋 Final messages last user content type:", typeof finalMessages[finalMessages.length - 1]?.content, Array.isArray(finalMessages[finalMessages.length - 1]?.content) ? "array" : "not array");

          // DEBUG: Verify fix was applied - content should now be a string, not array
          const lastMsg = finalMessages[finalMessages.length - 1];
          if (typeof lastMsg?.content === "string") {
            console.log("📋 FIX VERIFIED: Message content is now string (file parts removed)");
            console.log("📋 FIX VERIFIED: Content starts with:", lastMsg.content.slice(0, 100));
            console.log("📋 FIX VERIFIED: Content contains <attachment tags:", lastMsg.content.includes("<attachment"));
          } else if (Array.isArray(lastMsg?.content)) {
            console.log("📋 WARNING: Final message still has", lastMsg.content.length, "content parts (fix may not have applied):");
            lastMsg.content.forEach((part: any, i: number) => {
              console.log(`📋   Part ${i}: type=${part.type}, hasText=${!!part.text}, hasImage=${!!part.image}, hasFile=${!!part.file}`);
              if (part.type === "text") {
                console.log(`📋   Part ${i} text preview:`, part.text?.slice(0, 200));
              }
            });
          }

          // Send fileDataParts back to client for verification later
          if (deepCitation.fileDataParts) {
            dataStream.write({
              type: "data-deepcitation-fileparts",
              data: deepCitation.fileDataParts,
            } as any);
          }
        }

        // Debug: Log what we're actually sending to the LLM
        console.log("📋 SENDING TO LLM - system prompt length:", finalSystemPrompt.length);
        console.log("📋 SENDING TO LLM - system prompt has citation instructions:", finalSystemPrompt.includes("Citation syntax to use within Markdown"));
        console.log("📋 SENDING TO LLM - system prompt LAST 1500 chars:\n", finalSystemPrompt.slice(-1500));

        // Debug: Log the full streamText call parameters
        console.log("📋 STREAMTEXT CALL - model:", selectedChatModel);
        console.log("📋 STREAMTEXT CALL - system prompt first 500 chars:", finalSystemPrompt.slice(0, 500));
        console.log("📋 STREAMTEXT CALL - messages count:", finalMessages.length);
        console.log("📋 STREAMTEXT CALL - last message role:", finalMessages[finalMessages.length - 1]?.role);
        console.log("📋 STREAMTEXT CALL - last message content preview:", JSON.stringify(finalMessages[finalMessages.length - 1]?.content)?.slice(0, 1000));

        const result = streamText({
          model: getLanguageModel(selectedChatModel),
          system: finalSystemPrompt,
          messages: finalMessages,
          stopWhen: stepCountIs(5),
          experimental_activeTools: isReasoningModel
            ? []
            : [
                "getWeather",
                "createDocument",
                "updateDocument",
                "requestSuggestions",
              ],
          experimental_transform: isReasoningModel
            ? undefined
            : smoothStream({ chunking: "word" }),
          providerOptions: isReasoningModel
            ? {
                anthropic: {
                  thinking: { type: "enabled", budgetTokens: 10_000 },
                },
              }
            : undefined,
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          })
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        // Debug: Log finished messages to see LLM response
        console.log("📋 onFinish called with", finishedMessages.length, "messages");
        for (const msg of finishedMessages) {
          console.log("📋 Finished message role:", msg.role);
          if (msg.parts) {
            for (const part of msg.parts) {
              if (part.type === "text") {
                console.log("📋 LLM Response text:", (part as any).text?.slice(0, 1000));
                // Check for citations
                const citationMatch = (part as any).text?.match(/<cite\s+[^>]*(?:\/>|>)/g);
                if (citationMatch) {
                  console.log("📋 Found", citationMatch.length, "citation(s) in response!");
                } else {
                  console.log("📋 No citations found in response");
                }
              }
            }
          }
        }

        if (isToolApprovalFlow) {
          // For tool approval, update existing messages (tool state changed) and save new ones
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              // Update existing message with new parts (tool state changed)
              await updateMessage({
                id: finishedMsg.id,
                parts: finishedMsg.parts,
              });
            } else {
              // Save new message
              await saveMessages({
                messages: [
                  {
                    id: finishedMsg.id,
                    role: finishedMsg.role,
                    parts: finishedMsg.parts,
                    createdAt: new Date(),
                    attachments: [],
                    chatId: id,
                  },
                ],
              });
            }
          }
        } else if (finishedMessages.length > 0) {
          // Normal flow - save all finished messages
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => ({
              id: currentMessage.id,
              role: currentMessage.role,
              parts: currentMessage.parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id,
            })),
          });
        }
      },
      onError: () => {
        return "Oops, an error occurred!";
      },
    });

    const streamContext = getStreamContext();

    if (streamContext) {
      try {
        const resumableStream = await streamContext.resumableStream(
          streamId,
          () => stream.pipeThrough(new JsonToSseTransformStream())
        );
        if (resumableStream) {
          return new Response(resumableStream);
        }
      } catch (error) {
        console.error("Failed to create resumable stream:", error);
      }
    }

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Check for Vercel AI Gateway credit card error
    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatSDKError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
