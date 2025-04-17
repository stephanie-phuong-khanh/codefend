import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";


const OpenAICodeChange = z.object({
    type: z.string(),
    lineStart: z.number(),
    lineEnd: z.number(),
    originalCode: z.string(),
    newCode: z.string()
});

const OpenAIFileChange = z.object({
    filePath: z.string(),
    codeChanges: z.array(OpenAICodeChange)
});

const OpenAICodeFix = z.object({
    explanation: z.string(),
    changes: z.array(OpenAIFileChange)
});

export const openaiCodeFix = zodResponseFormat(OpenAICodeFix, 'openaiCodeFix');
