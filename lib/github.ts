// lib/github.ts
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';

export async function getAuthenticatedOctokit(installationId: string) {
    const octokit = new Octokit({
        authStrategy: createAppAuth,
            auth: {
            appId: process.env.GITHUB_APP_ID!,
            privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
            installationId: Number(installationId)
        }
    });

    return octokit;
};
