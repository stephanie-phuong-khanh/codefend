"use client";

import RepositoryUpgradeDetails from "@/components/repositories/RepositoryUpgradeDetails";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { AlertCircle, ExternalLink, Package } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Define the repository type based on your Prisma schema
type Repository = {
  id: number;
  name: string;
  githubRepoId: string;
  organizationId: number;
  dependenciesPath: string | null;
  setupCommand: string | null;
  compileCommand: string | null;
  testCommand: string | null;
  isConfigured: boolean;
  organization?: {
    id: number;
    name: string;
  };
};

// Define the package.json content type
type PackageJsonContent = {
  name: string;
  version: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  packageJsonUrl: string;
};

// Define a type for dependency items
type DependencyItem = {
  name: string;
  version: string;
  type: "dependency" | "devDependency" | "peerDependency";
  latestVersion?: string;
  hasUpdate?: boolean;
  checkingUpdate?: boolean;
  updateError?: boolean;
};

export default function RepositoryDetailPage() {
  const params = useParams();
  const router = useRouter();

  const [repository, setRepository] = useState<Repository | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpgradeDetails, setShowUpgradeDetails] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<{
    name: string;
    version: string;
  } | null>(null);

  // State for package.json content
  const [packageJsonContent, setPackageJsonContent] =
    useState<PackageJsonContent | null>(null);
  const [packageJsonLoading, setPackageJsonLoading] = useState(false);
  const [packageJsonError, setPackageJsonError] = useState<string | null>(null);

  // State for the filtered dependencies
  const [dependencyFilter, setDependencyFilter] = useState<
    "all" | "dependency" | "devDependency" | "peerDependency" | "outdated"
  >("dependency");
  const [searchTerm, setSearchTerm] = useState("");

  // State for tracking dependency updates
  const [dependencies, setDependencies] = useState<DependencyItem[]>([]);
  const [checkingUpdates, setCheckingUpdates] = useState(false);

  // Fetch repository data
  useEffect(() => {
    async function fetchRepository() {
      try {
        setLoading(true);
        const repoId = params.id;
        const response = await fetch(`/api/repositories/${repoId}`);

        if (!response.ok) {
          throw new Error("Failed to fetch repository");
        }

        const data = await response.json();
        setRepository(data);
      } catch (error) {
        setError("Failed to load repository details");
        console.error("Error fetching repository:", error);
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      fetchRepository();
    }
  }, [params.id]);

  // Fetch package.json content when repository is loaded
  useEffect(() => {
    async function fetchPackageJsonContent() {
      if (!repository || !repository.isConfigured) return;

      try {
        setPackageJsonLoading(true);
        setPackageJsonError(null);

        const response = await fetch(
          `/api/github/repositories/package-json/content?repoId=${repository.id}`
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || "Failed to fetch package.json content"
          );
        }

        const data = await response.json();
        setPackageJsonContent(data);
      } catch (error) {
        console.error("Error fetching package.json content:", error);
        setPackageJsonError(
          error instanceof Error ? error.message : "Unknown error"
        );
      } finally {
        setPackageJsonLoading(false);
      }
    }

    fetchPackageJsonContent();
  }, [repository]);

  // Update dependencies list when package.json content changes
  useEffect(() => {
    if (packageJsonContent) {
      const newDependencies = getAllDependencies();
      setDependencies(newDependencies);
    }
  }, [packageJsonContent]);

  // Check for updates when dependencies are loaded
  useEffect(() => {
    if (
      dependencies.length > 0 &&
      !dependencies.some((dep) => dep.hasUpdate !== undefined)
    ) {
      checkForUpdates();
    }
  }, [dependencies]);

  // Helper function to get all dependencies as a flat array
  const getAllDependencies = (): DependencyItem[] => {
    if (!packageJsonContent) return [];

    const newDependencies: DependencyItem[] = [];

    // Add regular dependencies
    Object.entries(packageJsonContent.dependencies || {}).forEach(
      ([name, version]) => {
        newDependencies.push({ name, version, type: "dependency" });
      }
    );

    // Add dev dependencies
    Object.entries(packageJsonContent.devDependencies || {}).forEach(
      ([name, version]) => {
        newDependencies.push({ name, version, type: "devDependency" });
      }
    );

    // Add peer dependencies
    Object.entries(packageJsonContent.peerDependencies || {}).forEach(
      ([name, version]) => {
        newDependencies.push({ name, version, type: "peerDependency" });
      }
    );

    return newDependencies;
  };

  // Filter dependencies based on type and search term
  const getFilteredDependencies = (): DependencyItem[] => {
    return dependencies.filter((dep) => {
      // Filter by type
      if (dependencyFilter === "outdated") {
        if (!dep.hasUpdate) return false;
      } else if (dependencyFilter !== "all" && dep.type !== dependencyFilter) {
        return false;
      }

      // Filter by search term
      if (
        searchTerm &&
        !dep.name.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }

      return true;
    });
  };

  // Define type for package version check result
  type PackageVersionCheckResult = {
    package: string;
    currentVersion: string;
    latestVersion?: string;
    hasUpdate?: boolean;
    error?: string;
  };

  // Check for updates to all dependencies
  const checkForUpdates = async () => {
    if (!packageJsonContent || dependencies.length === 0) return;

    try {
      setCheckingUpdates(true);

      // Prepare the list of packages to check
      const packagesToCheck = dependencies.map((dep) => ({
        name: dep.name,
        version: dep.version,
      }));

      // Send the batch request to check for updates
      const response = await fetch("/api/npm/check-version", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ packages: packagesToCheck }),
      });

      if (!response.ok) {
        throw new Error("Failed to check for updates");
      }

      const data = await response.json();

      // Update the dependencies with the version information
      setDependencies((prevDeps) => {
        return prevDeps.map((dep) => {
          const updateInfo = data.results.find(
            (result: PackageVersionCheckResult) => result.package === dep.name
          );

          if (updateInfo && !updateInfo.error) {
            return {
              ...dep,
              latestVersion: updateInfo.latestVersion,
              hasUpdate: updateInfo.hasUpdate,
              checkingUpdate: false,
              updateError: false,
            };
          } else {
            return {
              ...dep,
              checkingUpdate: false,
              updateError: true,
            };
          }
        });
      });
    } catch (error) {
      console.error("Error checking for updates:", error);
    } finally {
      setCheckingUpdates(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        <p className="ml-2">Loading repository details...</p>
      </div>
    );
  }

  if (error || !repository) {
    return (
      <div className="container mx-auto py-10">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">
          {error || "Repository not found"}
        </div>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{repository.name}</h1>
        </div>
      </div>

      {/* Package.json Dependencies Section */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Package size={20} />
            Dependencies
          </CardTitle>
          {packageJsonContent && (
            <Link
              href={packageJsonContent.packageJsonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              View package.json
              <ExternalLink size={14} />
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {packageJsonLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              <p className="ml-2">Loading dependencies...</p>
            </div>
          ) : packageJsonError ? (
            <div className="bg-red-50 p-4 rounded-md flex items-start gap-3">
              <AlertCircle className="text-red-500 mt-0.5" size={18} />
              <div>
                <h3 className="font-medium text-red-800">
                  Error loading dependencies
                </h3>
                <p className="text-red-700 text-sm mt-1">{packageJsonError}</p>
              </div>
            </div>
          ) : packageJsonContent ? (
            <div>
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Filter:</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setDependencyFilter("all")}
                      className={`px-2 py-1 text-xs rounded ${
                        dependencyFilter === "all"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100"
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setDependencyFilter("dependency")}
                      className={`px-2 py-1 text-xs rounded ${
                        dependencyFilter === "dependency"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100"
                      }`}
                    >
                      Dependencies
                    </button>
                    <button
                      onClick={() => setDependencyFilter("devDependency")}
                      className={`px-2 py-1 text-xs rounded ${
                        dependencyFilter === "devDependency"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100"
                      }`}
                    >
                      Dev
                    </button>
                    <button
                      onClick={() => setDependencyFilter("peerDependency")}
                      className={`px-2 py-1 text-xs rounded ${
                        dependencyFilter === "peerDependency"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100"
                      }`}
                    >
                      Peer
                    </button>
                    <button
                      onClick={() => setDependencyFilter("outdated")}
                      className={`px-2 py-1 text-xs rounded ${
                        dependencyFilter === "outdated"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100"
                      }`}
                    >
                      Outdated
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search dependencies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-3 py-1 text-sm border rounded-md w-full sm:w-64"
                  />
                </div>
              </div>

              {getFilteredDependencies().length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-4 py-2 text-sm font-medium text-gray-600">
                          Package
                        </th>
                        <th className="px-4 py-2 text-sm font-medium text-gray-600">
                          Version
                        </th>
                        <th className="px-4 py-2 text-sm font-medium text-gray-600">
                          Type
                        </th>
                        <th className="px-4 py-2 text-sm font-medium text-gray-600">
                          Latest
                        </th>
                        <th className="px-4 py-2 text-sm font-medium text-gray-600">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {getFilteredDependencies().map((dep) => (
                        <tr
                          key={`${dep.name}-${dep.type}`}
                          className="hover:bg-gray-50"
                        >
                          <td className="px-4 py-3 text-sm">
                            <Link
                              href={`https://www.npmjs.com/package/${dep.name}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {dep.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm font-mono">
                            {dep.version}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`inline-block px-2 py-1 text-xs rounded-full ${
                                dep.type === "dependency"
                                  ? "bg-green-100 text-green-800"
                                  : dep.type === "devDependency"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-purple-100 text-purple-800"
                              }`}
                            >
                              {dep.type === "dependency"
                                ? "Production"
                                : dep.type === "devDependency"
                                ? "Development"
                                : "Peer"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-mono">
                            {dep.checkingUpdate ? (
                              <span className="text-gray-400">Checking...</span>
                            ) : dep.updateError ? (
                              <span className="text-gray-400">Unknown</span>
                            ) : dep.hasUpdate ? (
                              <span className="text-red-600">
                                {dep.latestVersion}
                              </span>
                            ) : (
                              <span className="text-green-600">Up to date</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {dep.hasUpdate && (
                              <button
                                onClick={() => {
                                  // Start upgrade process immediately
                                  console.log(dep.name);
                                  setSelectedPackage({
                                    name: dep.name,
                                    version:
                                      dep.name === "react-router-dom"
                                        ? "6.22.3"
                                        : dep.latestVersion || "",
                                  });
                                  setShowUpgradeDetails(true);
                                }}
                                className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
                              >
                                Upgrade
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">
                    No dependencies found matching your criteria
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500">
                No package.json found for this repository
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade Details Card - Now displayed below the dependencies table */}
      {showUpgradeDetails && selectedPackage && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between pb-2"></CardHeader>
          <CardContent className="p-0">
            <RepositoryUpgradeDetails
              repositoryId={params.id as string}
              repositoryName={repository.name}
              packageName={selectedPackage.name}
              newVersion={selectedPackage.version}
              onClose={() => setShowUpgradeDetails(false)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
