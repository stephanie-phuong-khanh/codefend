
import { FileChange } from './code-change';

export interface AICodeFixRequest {
    errorMessage: string;
    targetDirectory: string;
    packageName: string;
}

export interface AICodeFixResponse {
    explanation: string;
    changes: FileChange[];
}

export interface AIModelClient {
    generateCodeFixes(request: AICodeFixRequest): Promise<AICodeFixResponse>;
}
