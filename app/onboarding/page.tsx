// dashboard/app/onboarding/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ConnectionStatus {
  isConnected: boolean;
  organizationId?: number;
}

interface GithubOrg {
  id: number;
  login: string;
  avatar_url: string;
  connectionStatus: ConnectionStatus;
}

export default function OnboardingPage() {
  const [orgs, setOrgs] = useState<GithubOrg[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchOrgs() {
      try {
        const response = await fetch('/api/github/organizations');
        const data = await response.json();
        setOrgs(data.organizations);
      } catch (error) {
        console.error('Error fetching organizations:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchOrgs();
  }, []);
  
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
    </div>;
  }
  
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Connect Organizations</h1>
      
      <p className="mb-8">
        Select GitHub organizations to connect:
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {orgs.map(org => (
          <div key={org.id} className="border rounded-lg p-4">
            <div className="flex items-center mb-4">
              <img src={org.avatar_url} alt={org.login} className="w-10 h-10 rounded-full mr-3" />
              <h2 className="text-xl font-semibold">{org.login}</h2>
            </div>
            {org.connectionStatus.isConnected ? (
              <div>
                <div className="flex items-center mb-2">
                  <span className="text-green-600 mr-2">✓</span>
                  <span className="text-sm text-green-600">Already connected</span>
                </div>
                <Link
                  href="/dashboard"
                  className="block w-full text-center bg-green-600 text-white py-2 rounded hover:bg-green-700"
                >
                  Go to Dashboard
                </Link>
              </div>
            ) : (
              <Link
                href={`https://github.com/apps/${process.env.NEXT_PUBLIC_GITHUB_APP_NAME || 'codefend-ai'}/installations/new?state=${org.id}`}
                className="block w-full text-center bg-black text-white py-2 rounded hover:bg-gray-800"
              >
                Connect
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
