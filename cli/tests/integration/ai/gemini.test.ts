import { GeminiClient } from "../../../src/ai";
import { AICodeFixRequest, AICodeFixResponse } from "../../../src/models/ai";

// Only run these tests when specifically requested
// This prevents them from running in regular CI/CD pipelines
const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

(runIntegrationTests ? describe : describe.skip)('Gemini API Integration Test', () => {
    let client: GeminiClient;

    beforeAll(() => {
        if (!process.env.GOOGLE_API_KEY) {
            throw new Error('GOOGLE_API_KEY is not set, cannot initialize Gemini client');
        }

        client = new GeminiClient();
    });


    test('API response can be consistently parsed as JSON', async() => {
        const request: AICodeFixRequest = {
            errorMessage: 'Error: Cannot find module',
            targetDirectory: './lodash-example',
            packageName: 'lodash'
        };

        const response: AICodeFixResponse = await client.generateCodeFixes(request);

        // Verify response structure
        expect(response.changes).toBeDefined();
        expect(response.explanation).toBeDefined();
        expect(typeof response).toBe('object');

        // TODO: Check contents
        console.debug('Gemini Response:', response);
    }, 30000); // Increased timeout since AI API calls can take time

})
