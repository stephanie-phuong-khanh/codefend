import { OpenAIClient } from "../../../src/ai/openai-client";
import { AICodeFixRequest, AICodeFixResponse } from "../../../src/models/ai";

// Only run these tests when specifically requested
// This prevents them from running in regular CI/CD pipelines
const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

(runIntegrationTests ? describe : describe.skip)('OpenAI API Integration Test', () => {
    let client: OpenAIClient;

    beforeAll(() => {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is not set, cannot initialize OpenAI client');
        }

        client = new OpenAIClient();
    });

    test('API response can be consistently parsed as JSON', async() => {
        const request: AICodeFixRequest = {
            errorMessage: 'Error: Cannot find module "lodash/fp"',
            targetDirectory: './lodash-example',
            packageName: 'lodash'
        };

        const response: AICodeFixResponse = await client.generateCodeFixes(request);

        // Verify response structure
        expect(response.changes).toBeDefined();
        expect(response.explanation).toBeDefined();
        expect(typeof response).toBe('object');

        // Log response for inspection
        console.debug('OpenAI Response:', JSON.stringify(response, null, 2));
    }, 30000); // Increased timeout since AI API calls can take time
});
