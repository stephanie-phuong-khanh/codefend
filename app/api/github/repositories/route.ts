// app/api/github/repositories/route.ts
import { getAuthenticatedOctokit } from "@/lib/github";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const includeAll = searchParams.get("includeAll") === "true";

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
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

    // Fetch repositories for the installation
    const { data: githubRepos } = await octokit.rest.repos.listForOrg({
      org: organization.name,
      per_page: 100,
    });

    // Get repositories from our database for this organization
    const dbRepos = await prisma.repository.findMany({
      where: { organizationId: parseInt(orgId) },
    });

    if (includeAll) {
      // Create a map of existing repositories for quick lookup
      const existingRepoMap = new Map();
      dbRepos.forEach((repo) => {
        existingRepoMap.set(repo.githubRepoId, repo);
      });

      // Combine GitHub and database repositories
      const combinedRepos = githubRepos.map((githubRepo) => {
        const dbRepo = existingRepoMap.get(githubRepo.id.toString());

        return {
          id: dbRepo?.id || null,
          name: githubRepo.name,
          githubRepoId: githubRepo.id.toString(),
          organizationId: parseInt(orgId),
          isConfigured: !!dbRepo?.isConfigured,
          inDatabase: !!dbRepo,
          githubData: {
            fullName: githubRepo.full_name,
            description: githubRepo.description,
            url: githubRepo.html_url,
            defaultBranch: githubRepo.default_branch,
            stars: githubRepo.stargazers_count,
            forks: githubRepo.forks_count,
            language: githubRepo.language,
            isPrivate: githubRepo.private,
          },
        };
      });

      return NextResponse.json({
        organization: {
          id: organization.id,
          name: organization.name,
        },
        repositories: combinedRepos,
      });
    } else {
      // Filter out repositories that are already in our database (original behavior)
      const existingRepoIds = new Set(dbRepos.map((repo) => repo.githubRepoId));

      const availableRepos = githubRepos.filter(
        (repo) => !existingRepoIds.has(repo.id.toString())
      );

      return NextResponse.json({ repositories: availableRepos });
    }
  } catch (error) {
    console.error("Error fetching repositories:", error);
    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 }
    );
  }
}
