// app/api/github/repositories/package-json/route.ts
import { getAuthenticatedOctokit } from "@/lib/github";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const repoName = searchParams.get("repoName");

    if (!orgId || !repoName) {
      return NextResponse.json(
        { error: "Organization ID and repository name are required" },
        { status: 400 }
      );
    }

    // Get organization from database
    const organization = await prisma.organization.findUnique({
      where: { id: parseInt(orgId) },
    });

    if (!organization || !organization.githubInstallationId) {
      return NextResponse.json(
        { error: "Organization not found or GitHub App not installed" },
        { status: 404 }
      );
    }

    // Get octokit instance authenticated with the installation
    const octokit = await getAuthenticatedOctokit(
      organization.githubInstallationId
    );

    try {
      // Try to get package.json from the root of the repository
      const { data: packageJson } = await octokit.rest.repos.getContent({
        owner: organization.name,
        repo: repoName,
        path: 'package.json',
      });

      // If we get here, package.json exists
      // Handle different response types from GitHub API
      let packageJsonUrl = '';
      
      // If packageJson is an array, it's a directory listing
      if (Array.isArray(packageJson)) {
        // This shouldn't happen for a file request, but handle it anyway
        packageJsonUrl = `https://github.com/${organization.name}/${repoName}/blob/main/package.json`;
      } else {
        // It's a single file response
        packageJsonUrl = packageJson.html_url || 
          `https://github.com/${organization.name}/${repoName}/blob/main/package.json`;
      }

      return NextResponse.json({
        exists: true,
        path: 'package.json',
        url: packageJsonUrl
      });
    } catch (error: any) {
      // If we get a 404, package.json doesn't exist at the root
      if (error.status === 404) {
        return NextResponse.json({
          exists: false,
          message: "No package.json found in the repository root"
        });
      }
      
      // For any other error, rethrow
      throw error;
    }
  } catch (error) {
    console.error("Error checking for package.json:", error);
    return NextResponse.json(
      { error: "Failed to check for package.json" },
      { status: 500 }
    );
  }
}
