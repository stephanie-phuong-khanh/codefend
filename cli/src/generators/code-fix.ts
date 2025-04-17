import { FileChange } from "../models/code-change";
import { AIModelClient } from "../models/ai";
import { OpenAIClient } from "../ai/openai-client";
import { GeminiClient } from "../ai/gemini-client";
import * as ora from 'ora';

// Maintain singleton instances of AI clients
const aiClients: Record<string, AIModelClient> = {};

/**
 * Get or create an AI client instance
 * @param provider The AI provider to use ('openai' or 'gemini')
 * @returns A singleton instance of the AI client
 */
function getAIClient(provider: 'openai' | 'gemini' = 'openai'): AIModelClient {
    if (!aiClients[provider]) {
        // Initialize the client if it doesn't exist yet
        if (provider === 'openai') {
            aiClients[provider] = new OpenAIClient();
        } else {
            aiClients[provider] = new GeminiClient();
        }
        console.debug(`Initialized ${provider} AI client`);
    }
    
    return aiClients[provider];
}

/**
 * Generate code fixes for package upgrades using AI
 * @param errorMessage Error message that occurred after upgrading
 * @param targetDirectory Directory of the project to fix
 * @param packageName Package that was upgraded
 * @param aiProvider AI provider to use ('openai' or 'gemini')
 * @returns Array of file changes to apply
 */
export async function generateCodeFixes(
    errorMessage: string,
    targetDirectory: string,
    packageName: string,
    aiProvider: 'openai' | 'gemini' = 'openai'
): Promise<FileChange[]> {
    const spinner = ora.default(`Generating code fixes with ${aiProvider}...`).start();

    try {
        // Get the AI client (singleton pattern)
        const aiClient = getAIClient(aiProvider);
        
        // Generate code fixes using the AI client
        const result = await aiClient.generateCodeFixes({
            errorMessage,
            targetDirectory,
            packageName
        });

        // sum up all the code changes across all the files
        const totalCodeChanges = result.changes.map(change => change.codeChanges).flat().length;

        spinner.succeed(`Generated ${totalCodeChanges} code changes across ${result.changes.length} files`);
        console.log(`💡 Reasoning: ${result.explanation}`);

        return result.changes;
    } catch (error) {
        spinner.fail(`Error generating fix: ${error}`);
        return [];
    }
}
