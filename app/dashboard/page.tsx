// app/dashboard/page.tsx
"use client";

import RepositoryConfigForm from "@/components/repositories/RepositoryConfigForm";
import { Button } from "@/components/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Repository = {
  id: number | null;
  name: string;
  githubRepoId: string;
  organizationId: number;
  isConfigured?: boolean;
  inDatabase?: boolean;
  githubData?: {
    fullName: string;
    description: string | null;
    url: string;
    defaultBranch: string;
    language: string | null;
    isPrivate: boolean;
  };
};

type Organization = {
  id: number;
  name: string;
  repositories: Repository[];
};

export default function Dashboard() {
  const router = useRouter();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configRepo, setConfigRepo] = useState<Repository | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        // Fetch organizations
        const orgResponse = await fetch("/api/organizations");
        if (!orgResponse.ok) {
          throw new Error("Failed to fetch organizations");
        }

        const orgData = await orgResponse.json();
        const orgs = orgData.organizations || [];

        if (orgs.length === 0) {
          setLoading(false);
          return;
        }

        // Use the first organization
        const primaryOrg = orgs[0];
        setOrganization(primaryOrg);

        // Fetch repositories for this organization
        try {
          const repoResponse = await fetch(
            `/api/github/repositories?orgId=${primaryOrg.id}&includeAll=true`
          );

          if (!repoResponse.ok) {
            throw new Error(
              `Failed to fetch repositories for ${primaryOrg.name}`
            );
          }

          const repoData = await repoResponse.json();
          setRepositories(repoData.repositories || []);
        } catch (repoError) {
          console.error(`Error fetching repositories:`, repoError);
          setError("Failed to load repositories. Please try again later.");
          setRepositories([]);
        }
      } catch (error) {
        setError("Failed to load organization. Please try again later.");
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Keep your existing functions for analysis, etc.

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      ) : !organization ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg p-8">
          <h2 className="text-xl font-semibold mb-2">
            No Organization Connected
          </h2>
          <p className="mb-4 text-gray-600">
            Install the GitHub App to get started with Codefend.
          </p>
          <Link href="/dashboard/setup" className="inline-block">
            <Button>Set Up GitHub App</Button>
          </Link>
        </div>
      ) : repositories.length === 0 ? (
        <div className="border rounded-lg p-6 bg-white shadow-sm">
          <div className="bg-gray-50 rounded p-4 text-center">
            <p className="text-gray-600 mb-3">No repositories connected yet.</p>
            <Link href="/dashboard/repositories/add" className="inline-block">
              <Button size="sm" variant="outline">
                Add Repository
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg p-4 bg-white shadow-sm overflow-hidden">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Repository</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Language</TableHead>
                <TableHead className="w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repositories.map((repo) => (
                <TableRow key={repo.githubRepoId} className="cursor-pointer hover:bg-gray-50 border-b last:border-b-0">
                  <TableCell
                    className="font-medium py-2"
                    onClick={() => {
                      if (repo.id) {
                        router.push(`/dashboard/repositories/${repo.id}`);
                      }
                    }}
                  >
                    <div className="flex flex-col">
                      <span>{repo.name}</span>
                    </div>
                  </TableCell>
                  <TableCell
                    className="py-2"
                    onClick={() => {
                      if (repo.id) {
                        router.push(`/dashboard/repositories/${repo.id}`);
                      }
                    }}
                  >
                    <div className="flex items-center">
                      <span
                        className={`inline-block w-2 h-2 rounded-full mr-2 ${
                          repo.isConfigured ? "bg-green-500" : "bg-yellow-500"
                        }`}
                      ></span>
                      <span className="text-sm">
                        {repo.isConfigured ? "Configured" : "Not configured"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell
                    className="py-2"
                    onClick={() => {
                      if (repo.id) {
                        router.push(`/dashboard/repositories/${repo.id}`);
                      }
                    }}
                  >
                    {repo.githubData?.language || "–"}
                  </TableCell>
                  <TableCell className="py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfigRepo(repo);
                      }}
                      title="Configure Repository"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {/* Repository Configuration Modal */}

      {/* Repository Configuration Modal */}
      {configRepo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-xl font-semibold mb-4">
              Configure Repository: {configRepo.name}
            </h2>
            <RepositoryConfigForm
              repository={{
                id: configRepo.id || configRepo.githubRepoId,
                name: configRepo.name,
              }}
              organizationId={configRepo.organizationId}
              onComplete={(updatedRepo) => {
                // Update the repositories list with the newly configured repo
                setRepositories((prevRepos) => {
                  return prevRepos.map((repo) =>
                    repo.githubRepoId === configRepo.githubRepoId
                      ? { ...repo, ...updatedRepo, isConfigured: true }
                      : repo
                  );
                });
                setConfigRepo(null);
              }}
            />
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setConfigRepo(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
