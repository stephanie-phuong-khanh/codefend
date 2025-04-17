// components/repositories/RepositoryConfigForm.tsx
import { Button, Form } from "@/components/ui";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

// Define TypeScript interfaces for the props
interface Repository {
  id: number | string;
  name: string;
  // Add other properties as needed
}

interface RepositoryConfigFormProps {
  repository: Repository;
  organizationId: string | number;
  onComplete: (repository: any) => void;
}

// Define the form values interface
interface FormValues {
  setupCommand: string;
  compileCommand: string;
  testCommand: string;
}

interface PackageJsonInfo {
  exists: boolean;
  path?: string;
  url?: string;
  message?: string;
}

export default function RepositoryConfigForm({
  repository,
  organizationId,
  onComplete,
}: RepositoryConfigFormProps) {
  const [loading, setLoading] = useState(false);
  const [formValues, setFormValues] = useState<FormValues>({
    setupCommand: "",
    compileCommand: "",
    testCommand: "",
  });
  const [packageJsonInfo, setPackageJsonInfo] = useState<PackageJsonInfo | null>(null);
  const [packageJsonLoading, setPackageJsonLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch package.json information
  useEffect(() => {
    async function fetchPackageJsonInfo() {
      try {
        setPackageJsonLoading(true);
        const response = await fetch(
          `/api/github/repositories/package-json?orgId=${organizationId}&repoName=${repository.name}`
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch package.json information');
        }
        
        const data = await response.json();
        setPackageJsonInfo(data);
      } catch (error) {
        console.error('Error fetching package.json info:', error);
      } finally {
        setPackageJsonLoading(false);
      }
    }
    
    // Only fetch package.json info if we don't already have it
    if (!packageJsonInfo) {
      fetchPackageJsonInfo();
    }
  }, [repository.name, organizationId, packageJsonInfo]);

  // Fetch repository configuration if it exists
  useEffect(() => {
    async function fetchRepositoryConfig() {
      // Only fetch if we have a numeric ID (existing repo in database)
      if (typeof repository.id === "number") {
        try {
          setFetchLoading(true);
          setFetchError(null);

          const response = await fetch(`/api/repositories/${repository.id}`);

          if (!response.ok) {
            throw new Error("Failed to fetch repository configuration");
          }

          const data = await response.json();

          // Update form values with existing configuration
          setFormValues({
            setupCommand: data.setupCommand || "",
            compileCommand: data.compileCommand || "",
            testCommand: data.testCommand || "",
          });
          
          // If there's a dependenciesPath already set, we'll use that info
          if (data.dependenciesPath) {
            setPackageJsonInfo({
              exists: true,
              path: data.dependenciesPath,
              url: `https://github.com/${data.organization?.name}/${repository.name}/blob/main/${data.dependenciesPath}`
            });
          }
        } catch (error) {
          console.error("Error fetching repository configuration:", error);
          setFetchError("Failed to load existing configuration");
        } finally {
          setFetchLoading(false);
        }
      }
    }

    fetchRepositoryConfig();
  }, [repository.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    // Use the current form values
    const values = formValues;

    try {
      // Determine if this is an update (numeric ID) or a new repository
      const isUpdate = typeof repository.id === "number";
      const url = isUpdate
        ? `/api/repositories/${repository.id}`
        : "/api/repositories";
      const method = isUpdate ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(isUpdate
            ? {}
            : {
                name: repository.name,
                githubRepoId: repository.id.toString(),
              }),
          ...(isUpdate ? {} : { organizationId }),
          ...values,
          // Automatically set dependenciesPath to package.json if it exists
          dependenciesPath: packageJsonInfo?.exists ? 'package.json' : null,
          isConfigured: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save repository configuration");
      }

      const data = await response.json();
      onComplete(data.repository);
    } catch (error) {
      console.error("Error saving repository:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form onSubmit={handleSubmit}>
      <h3 className="text-lg font-medium mb-4">
        Configure Build & Test Settings
      </h3>

      {fetchLoading && (
        <div className="mb-4 text-center">
          <div
            className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-blue-600 rounded-full"
            aria-hidden="true"
          ></div>
          <p className="mt-2 text-sm text-gray-500">Loading configuration...</p>
        </div>
      )}

      {fetchError && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
          {fetchError}
        </div>
      )}

      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-medium">
            Dependencies File
          </label>
          {packageJsonLoading && (
            <div className="animate-spin inline-block w-4 h-4 border-[2px] border-current border-t-transparent text-blue-600 rounded-full"></div>
          )}
        </div>
        
        {packageJsonInfo?.exists ? (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span className="text-sm text-green-700">Found package.json</span>
            </div>
            <div className="mt-2">
              <Link 
                href={packageJsonInfo.url || '#'} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                View on GitHub
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </Link>
            </div>
          </div>
        ) : packageJsonInfo?.exists === false ? (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-600">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span className="text-sm text-yellow-700">No package.json found in repository root</span>
            </div>
            <p className="mt-1 text-xs text-yellow-600">The system will still try to use 'package.json' as the default path.</p>
          </div>
        ) : (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
            <span className="text-sm text-gray-500">Checking for package.json...</span>
          </div>
        )}
      </div>

      <div className="space-y-2 mb-4">
        <label htmlFor="setupCommand" className="block text-sm font-medium">
          Setup Command <span className="text-red-500">*</span>
        </label>
        <input
          id="setupCommand"
          name="setupCommand"
          type="text"
          placeholder="e.g., npm install"
          value={formValues.setupCommand}
          onChange={(e) =>
            setFormValues({ ...formValues, setupCommand: e.target.value })
          }
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <p className="text-sm text-gray-500">Command to install dependencies</p>
      </div>

      <div className="space-y-2 mb-4">
        <label htmlFor="compileCommand" className="block text-sm font-medium">
          Compile Command <span className="text-red-500">*</span>
        </label>
        <input
          id="compileCommand"
          name="compileCommand"
          type="text"
          placeholder="e.g., npm run build"
          value={formValues.compileCommand}
          onChange={(e) =>
            setFormValues({ ...formValues, compileCommand: e.target.value })
          }
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <p className="text-sm text-gray-500">Command to compile your project</p>
      </div>

      <div className="space-y-2 mb-4">
        <label htmlFor="testCommand" className="block text-sm font-medium">
          Test Command <span className="text-red-500">*</span>
        </label>
        <input
          id="testCommand"
          name="testCommand"
          type="text"
          placeholder="e.g., npm test"
          value={formValues.testCommand}
          onChange={(e) =>
            setFormValues({ ...formValues, testCommand: e.target.value })
          }
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <p className="text-sm text-gray-500">Command to run your tests</p>
      </div>

      <Button type="submit" loading={loading}>
        Save
      </Button>
    </Form>
  );
}
