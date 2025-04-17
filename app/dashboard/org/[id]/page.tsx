// app/dashboard/org/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type Repository = {
  id: number;
  name: string;
  githubRepoId: string;
};

type Organization = {
  id: number;
  name: string;
  repositories: Repository[];
};

export default function OrganizationDashboard() {
  const params = useParams();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [packageName, setPackageName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);

  useEffect(() => {
    async function fetchOrgDetails() {
      try {
        const response = await fetch(`/api/organizations/${params.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch organization details');
        }
        const data = await response.json();
        setOrganization(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      fetchOrgDetails();
    }
  }, [params.id]);

  const analyzePackage = async () => {
    if (!selectedRepo || !packageName) return;
    
    setAnalyzing(true);
    try {
      const response = await fetch('/api/analyze-package', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repoId: selectedRepo.id,
          packageName,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Analysis failed');
      }
      
      const results = await response.json();
      setAnalysisResults(results);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) return <div className="p-8">Loading organization details...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
  if (!organization) return <div className="p-8">Organization not found</div>;

  return (
    <div className="p-8">
      <div className="mb-4">
        <Link href="/dashboard" className="text-blue-500 hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
      
      <h1 className="text-2xl font-bold mb-6">{organization.name}</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <h2 className="text-xl font-semibold mb-4">Repositories</h2>
          {organization.repositories.length === 0 ? (
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
              No repositories found
            </div>
          ) : (
            <div className="space-y-2">
              {organization.repositories.map((repo) => (
                <div 
                  key={repo.id}
                  className={`p-3 rounded-md cursor-pointer ${
                    selectedRepo?.id === repo.id 
                      ? 'bg-blue-100 border border-blue-300' 
                      : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                  }`}
                  onClick={() => setSelectedRepo(repo)}
                >
                  <div className="font-medium">{repo.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="lg:col-span-2">
          {selectedRepo ? (
            <div>
              <h2 className="text-xl font-semibold mb-4">Package Analysis: {selectedRepo.name}</h2>
              
              <div className="bg-white p-4 rounded-md border border-gray-200 mb-4">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Package Name
                  </label>
                  <div className="flex">
                    <input
                      type="text"
                      value={packageName}
                      onChange={(e) => setPackageName(e.target.value)}
                      placeholder="e.g., lodash"
                      className="flex-1 border border-gray-300 rounded-l-md px-3 py-2"
                    />
                    <button
                      onClick={analyzePackage}
                      disabled={analyzing || !packageName}
                      className="bg-blue-600 text-white px-4 py-2 rounded-r-md disabled:opacity-50"
                    >
                      {analyzing ? 'Analyzing...' : 'Analyze'}
                    </button>
                  </div>
                </div>
              </div>
              
              {analysisResults && (
                <div className="bg-white p-4 rounded-md border border-gray-200">
                  <h3 className="text-lg font-semibold mb-2">Analysis Results</h3>
                  <div className="space-y-3">
                    <div>
                      <span className="font-medium">Current Version:</span> {analysisResults.currentVersion}
                    </div>
                    <div>
                      <span className="font-medium">Latest Version:</span> {analysisResults.latestVersion}
                    </div>
                    <div>
                      <span className="font-medium">Files Using Package:</span> {analysisResults.usageCount}
                    </div>
                    
                    {analysisResults.usageLocations && analysisResults.usageLocations.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-1">Usage Locations:</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {analysisResults.usageLocations.map((location: any, index: number) => (
                            <li key={index} className="text-sm">
                              {location.file}: {location.imports.join(', ')}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <div className="pt-2">
                      <button
                        className="bg-green-600 text-white px-4 py-2 rounded-md disabled:opacity-50 mr-2"
                      >
                        Upgrade Package
                      </button>
                      <button
                        className="bg-gray-600 text-white px-4 py-2 rounded-md disabled:opacity-50"
                      >
                        Test Upgrade
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 p-8 rounded-md border border-gray-200 flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                Select a repository to analyze package dependencies
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
