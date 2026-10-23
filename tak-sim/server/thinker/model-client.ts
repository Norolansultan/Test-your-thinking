/**
 * The model client the proxy calls (`model.ts`): the one method it uses, `models.generateContent`, and the parts of the reply it
 * reads. The SDK client (`GoogleGenAI`, `@google/genai`) has exactly this shape, so the server passes it as it is; the published demonstration's
 * page-side bridge (`tools/demo-bridge/`, never the study) passes an adapter with the same shape. Types only: no behaviour.
 */

import type { GoogleGenAI } from "@google/genai";

/** A request as the proxy builds it (the SDK's own parameter type). */
export type ThinkerModelParams = Parameters<GoogleGenAI["models"]["generateContent"]>[0];

/** What the proxy reads of a reply: the first candidate's finish reason, the text, the token counts and the build that answered. */
export interface ThinkerModelResponse {
  readonly candidates?: readonly { readonly finishReason?: string | undefined }[] | undefined;
  readonly text?: string | undefined;
  readonly usageMetadata?: { readonly promptTokenCount?: number | undefined; readonly candidatesTokenCount?: number | undefined } | undefined;
  readonly modelVersion?: string | undefined;
}

export interface ThinkerModelClient {
  readonly models: { generateContent(params: ThinkerModelParams): Promise<ThinkerModelResponse> };
}
