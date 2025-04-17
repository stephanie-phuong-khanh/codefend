// app/api/github/repositories/package-json/content/route.ts
import { getAuthenticatedOctokit } from "@/lib/github";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const repoId = searchParams.get("repoId");

    if (!repoId) {
      return NextResponse.json(
        { error: "Repository ID is required" },
        { status: 400 }
      );
    }

    // Get repository from database
    const repository = await prisma.repository.findUnique({
      where: { id: parseInt(repoId) },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            githubInstallationId: true,
          },
        },
      },
    });

    if (!repository || !repository.organization) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    if (!repository.organization.githubInstallationId) {
      return NextResponse.json(
        { error: "GitHub App not installed for this organization" },
        { status: 400 }
      );
    }

    // Get octokit instance authenticated with the installation
    const octokit = await getAuthenticatedOctokit(
      repository.organization.githubInstallationId
    );

    try {
      // Try to get package.json from the repository
      const { data: packageJsonContent } = await octokit.rest.repos.getContent({
        owner: repository.organization.name,
        repo: repository.name,
        path: repository.dependenciesPath || 'package.json',
      });

      // Handle different response types from GitHub API
      if (Array.isArray(packageJsonContent)) {
        return NextResponse.json(
          { error: "Expected a file but got a directory" },
          { status: 400 }
        );
      }
      
      // Make sure we have a file type response with content
      if (packageJsonContent.type !== 'file' || !('content' in packageJsonContent)) {
        return NextResponse.json(
          { error: "No content found in package.json" },
          { status: 404 }
        );
      }

      // Decode the content (we've already verified content exists above)
      const decodedContent = Buffer.from(
        packageJsonContent.content,
        'base64'
      ).toString('utf-8');

      // Parse the JSON
      const packageJson = JSON.parse(decodedContent);

      // Extract dependencies
      const dependencies = {
        ...(packageJson.dependencies || {}),
      };

      // Extract devDependencies
      const devDependencies = {
        ...(packageJson.devDependencies || {}),
      };

      // Extract peerDependencies
      const peerDependencies = {
        ...(packageJson.peerDependencies || {}),
      };

      // Return the dependencies
      return NextResponse.json({
        name: packageJson.name || repository.name,
        version: packageJson.version || 'N/A',
        dependencies,
        devDependencies,
        peerDependencies,
        packageJsonUrl: (packageJsonContent.html_url as string) || 
          `https://github.com/${repository.organization.name}/${repository.name}/blob/main/${repository.dependenciesPath || 'package.json'}`,
      });
    } catch (error: any) {
      // If we get a 404, package.json doesn't exist
      if (error.status === 404) {
        return NextResponse.json(
          { error: "package.json not found in the repository" },
          { status: 404 }
        );
      }
      
      // For any other error, return a generic error message
      console.error("Error fetching package.json content:", error);
      return NextResponse.json(
        { error: "Failed to fetch package.json content" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in package.json content API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
