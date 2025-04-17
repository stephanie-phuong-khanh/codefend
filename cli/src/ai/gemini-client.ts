import { GenerateContentResponse, GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";
import { generateCodeFixPrompt } from "../ai/prompts/code-fix";
import {
  AICodeFixRequest,
  AICodeFixResponse,
  AIModelClient,
} from "../models/ai";
import {
  analyzeProjectStructure,
  findPackageUsageInDirectory,
} from "../utils/code-analysis";
import { geminiCodeFix } from "./schemas/gemini-code-fix";

dotenv.config();

// Try 2.5e experimental first, then 2.0-flash which is free

export class GeminiClient implements AIModelClient {
  private apiKey: string;
  private model: string;
  private aiClient: GoogleGenAI;

  // Gemini 2.5 Pro Preview  (gemini-2.5-pro-exp-03-25) is experimental.
  // Found to return extraneous information in response.text that breaks JSON parsing.
  constructor(model = "gemini-2.5-pro-exp-03-25") {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error(
        "GOOGLE_API_KEY is not set, cannot initialize Gemini client"
      );
    }

    this.apiKey = process.env.GOOGLE_API_KEY;
    this.model = model;
    this.aiClient = new GoogleGenAI({ apiKey: this.apiKey });
  }

  async generateCodeFixes(
    request: AICodeFixRequest
  ): Promise<AICodeFixResponse> {
    // TODO: selectively filtering the data to only include what's relevant to the error and package being upgraded,
    // as too much information can dilute the prompt and lead to less focused responses
    const projectStructureSummary = JSON.stringify(
      await analyzeProjectStructure(request.targetDirectory),
      null,
      0
    );

    const packageUsageResult = await findPackageUsageInDirectory(
      request.targetDirectory,
      request.packageName
    );
    const packageUsageAnalysis = JSON.stringify(
      {
        totalFilesWithUsage: packageUsageResult.fileCount,
        usageDetails: packageUsageResult.usageLocations.map((location) => ({
          path: location.filePath,
          importCount: location.imports.length,
          methodCalls: location.methodCalls.length,
          variableNames: location.variableNames,
        })),
      },
      null,
      0
    );

    const prompt = generateCodeFixPrompt(
      request.errorMessage,
      request.packageName,
      projectStructureSummary,
      packageUsageAnalysis
    );

    // https://ai.google.dev/gemini-api/docs/structured-output?lang=node
    const response: GenerateContentResponse =
      await this.aiClient.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: geminiCodeFix,
        },
      });

    // https://ai.google.dev/gemini-api/docs/structured-output?lang=node
    // https://ai.google.dev/api/generate-content#v1beta.GenerateContentResponse
    console.debug("Gemini response:", response.text);

    try {
      // Extract JSON content from between code fences if present
      let jsonContent = response.text || "{}";

      // Check if response contains code fences
      const jsonRegex = /```(?:json)?\s*([\s\S]*?)```/;
      const match = jsonRegex.exec(jsonContent);

      if (match && match[1]) {
        // Use the content between code fences
        jsonContent = match[1].trim();
        console.debug("Extracted JSON from code fences");
      } else {
        console.debug("No code fences found, treating whole response as JSON");
      }

      const responseData = JSON.parse(jsonContent);

      // Filter out changes that don't have codeChanges
      const validChanges = responseData.changes
        ? responseData.changes.filter(
            (change: any) =>
              change.codeChanges && Array.isArray(change.codeChanges)
          )
        : [];

      return {
        explanation: responseData.explanation || "No explanation provided",
        changes: validChanges.map((change: any) => ({
          filePath: request.targetDirectory + "/" + change.filePath,
          codeChanges: change.codeChanges.map((codeChange: any) => ({
            lineStart: codeChange.lineStart || 0,
            lineEnd: codeChange.lineEnd || 0,
            originalCode: codeChange.originalCode || "",
            newCode: codeChange.newCode || "",
            type: "replace",
          })),
        })),
      };
    } catch (error) {
      console.error("Error parsing Gemini response:", response.text);

      return {
        explanation: `Failed to parse Gemini response: ${error}`,
        changes: [],
      };
    }
  }
}
