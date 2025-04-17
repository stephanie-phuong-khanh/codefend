export const generateCodeFixPrompt = (
    errorMessage: string,
    packageName: string,
    projectStructure: string,
    packageUsageAnalysis: string
): string => `
I'm working on a JavaScript/Node.js project and encountered the following error after upgrading the package '${packageName}':

ERROR LOG:
${errorMessage}

PROJECT STRUCTURE:
${projectStructure}

PACKAGE USAGE ANALYSIS (AST-based):
${packageUsageAnalysis}

Please analyze this error and generate code changes to fix it. Focus on:
1. Understanding what changed causing this error between the package versions
2. Identifying the specific code that needs to be updated, including import statements and ALL code changes necessary
3. Providing a complete solution that maintains the original functionality
4. Never change code that doesn't need to be changed. Our goal is to make the package upgrade successful by modifying the least amount of code possible to preserve existing business logic + functionality

When suggesting changes to component usage (like replacing a component with a newer version), always check and update the corresponding import statements as well.

When determining the code changes, make sure to suggest all the necessary code changes. You should never leave comments saying what changes need to be made, just make them.
`;
