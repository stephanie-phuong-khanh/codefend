import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { AIModelClient, AICodeFixRequest, AICodeFixResponse } from '../models/ai';
import { generateCodeFixPrompt } from './prompts/code-fix';
import { openaiCodeFix } from './schemas/openai-code-fix';
import { analyzeProjectStructure, findPackageUsageInDirectory } from '../utils/code-analysis';

dotenv.config();

export class OpenAIClient implements AIModelClient {
    private apiKey: string;
    private model: string;
    private aiClient: OpenAI;

    // Structured Outputs with response_format: {type: "json_schema", ...} is only supported with the
    // gpt-4o-mini, gpt-4o-mini-2024-07-18, and gpt-4o-2024-08-06 model snapshots and later.
    constructor(model = 'gpt-4o-mini-2024-07-18') {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is not set, cannot initialize OpenAI client');
        }

        this.apiKey = process.env.OPENAI_API_KEY;
        this.model = model;
        this.aiClient = new OpenAI({ apiKey: this.apiKey });
    }

    async generateCodeFixes(request: AICodeFixRequest): Promise<AICodeFixResponse> {
        // Get project structure and package usage analysis
        const projectStructureSummary = JSON.stringify(await analyzeProjectStructure(request.targetDirectory), null, 0);

        const packageUsageResult = await findPackageUsageInDirectory(request.targetDirectory, request.packageName);
        const packageUsageAnalysis = JSON.stringify({
            totalFilesWithUsage: packageUsageResult.fileCount,
            usageDetails: packageUsageResult.usageLocations.map(location => ({
                path: location.filePath,
                importCount: location.imports.length,
                methodCalls: location.methodCalls.length,
                variableNames: location.variableNames
            }))
        }, null, 0);

        const prompt = generateCodeFixPrompt(
            request.errorMessage,
            request.packageName,
            projectStructureSummary,
            packageUsageAnalysis
        );

        const completion = await this.aiClient.beta.chat.completions.parse({
            model: this.model,
            messages: [
                { role: "system", content: "You are a code fix assistant. Your task is to fix the provided code." },
                { role: "user", content: prompt }
            ],
            response_format: openaiCodeFix
        });

        if (completion.choices.length !== 1) {
            throw new Error('Expected exactly one code fix response from OpenAI');
        }

        const codeFixes = completion.choices[0].message.parsed;
        console.debug('Code fixes:', JSON.stringify(codeFixes, null, 2));

        if (!codeFixes) {
            throw new Error('Received null code fix response from OpenAI');
        }

        return {
            explanation: codeFixes.explanation,
            changes: codeFixes.changes.map((change) => ({
                filePath: request.targetDirectory + '/' + change.filePath,
                codeChanges: change.codeChanges.map((codeChange) => ({
                    type: 'replace',
                    lineStart: codeChange.lineStart,
                    lineEnd: codeChange.lineEnd,
                    originalCode: codeChange.originalCode,
                    newCode: codeChange.newCode
                }))
            }))
        };
    }
}
