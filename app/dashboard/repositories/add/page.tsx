// app/dashboard/repositories/add/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui';
import RepositorySelector from '@/components/repositories/RepositorySelector';
import RepositoryConfigForm from '@/components/repositories/RepositoryConfigForm';

type Organization = {
  id: number;
  name: string;
};

// Simple organization selector component
function OrganizationSelector({ onSelect }: { onSelect: (org: Organization) => void }) {
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchOrganizations() {
      try {
        const response = await fetch('/api/organizations');
        if (!response.ok) {
          throw new Error('Failed to fetch organizations');
        }
        const data = await response.json();
        setOrganizations(data.organizations || []);
      } catch (error) {
        setError('Failed to load organizations');
        console.error('Error fetching organizations:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchOrganizations();
  }, []);
  
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg">
        {error}
      </div>
    );
  }
  
  if (organizations.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="mb-4">No organizations found. You need to install the GitHub App first.</p>
        <Button onClick={() => window.location.href = '/dashboard/setup'}>
          Set Up GitHub App
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Select an Organization</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {organizations.map(org => (
          <div
            key={org.id}
            className="border rounded-lg p-4 cursor-pointer hover:border-blue-500 transition-colors"
            onClick={() => onSelect(org)}
          >
            <h4 className="font-medium">{org.name}</h4>
          </div>
        ))}
      </div>
    </div>
  );
}

// Steps enum for better readability
enum Steps {
  SELECT_ORG = 0,
  SELECT_REPO = 1,
  CONFIGURE = 2
}

// This component uses useSearchParams and will be wrapped in Suspense
function RepositoryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Steps>(Steps.SELECT_ORG);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // If orgId is provided in URL, pre-select the organization
  useEffect(() => {
    const orgId = searchParams.get('orgId');
    if (orgId) {
      setLoading(true);
      // Fetch organization details by ID
      fetch(`/api/organizations/${orgId}`)
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to fetch organization');
          }
          return response.json();
        })
        .then(data => {
          if (data.organization) {
            setSelectedOrg(data.organization);
            setStep(Steps.SELECT_REPO);
          }
        })
        .catch(error => {
          setError('Failed to load organization');
          console.error('Error fetching organization:', error);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [searchParams]);
  
  function handleOrgSelect(org: Organization) {
    setSelectedOrg(org);
    setStep(Steps.SELECT_REPO);
  }
  
  function handleRepoSelect(repo: any) {
    setSelectedRepo(repo);
    setStep(Steps.CONFIGURE);
  }
  
  function handleComplete() {
    router.push('/dashboard');
    router.refresh();
  }
  
  function handleBack() {
    if (step === Steps.SELECT_REPO) {
      setStep(Steps.SELECT_ORG);
      setSelectedOrg(null);
    } else if (step === Steps.CONFIGURE) {
      setStep(Steps.SELECT_REPO);
      setSelectedRepo(null);
    }
  }
  
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg m-4">
        {error}
        <Button className="mt-4" onClick={() => router.push('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }
  
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Add Repository to Scan</h1>
          {step > Steps.SELECT_ORG && (
            <Button variant="ghost" onClick={handleBack}>
              Back
            </Button>
          )}
        </div>
        <div className="mt-4">
          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= Steps.SELECT_ORG ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
              1
            </div>
            <div className={`h-1 w-12 ${step > Steps.SELECT_ORG ? 'bg-blue-500' : 'bg-gray-200'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= Steps.SELECT_REPO ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
              2
            </div>
            <div className={`h-1 w-12 ${step > Steps.SELECT_REPO ? 'bg-blue-500' : 'bg-gray-200'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= Steps.CONFIGURE ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
              3
            </div>
          </div>
          <div className="flex text-sm mt-2">
            <div className="flex-1 text-center">Select Organization</div>
            <div className="flex-1 text-center">Select Repository</div>
            <div className="flex-1 text-center">Configure</div>
          </div>
        </div>
      </div>
      
      <div className="bg-white border rounded-lg shadow-sm p-6">
        {step === Steps.SELECT_ORG && (
          <OrganizationSelector onSelect={handleOrgSelect} />
        )}
        
        {step === Steps.SELECT_REPO && selectedOrg && (
          <RepositorySelector 
            organizationId={selectedOrg.id.toString()} 
            onSelect={handleRepoSelect} 
          />
        )}
        
        {step === Steps.CONFIGURE && selectedRepo && selectedOrg && (
          <RepositoryConfigForm 
            repository={selectedRepo}
            organizationId={selectedOrg.id}
            onComplete={handleComplete}
          />
        )}
      </div>
    </div>
  );
}

// Main component that wraps the content with Suspense
export default function AddRepositoryPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    }>
      <RepositoryPageContent />
    </Suspense>
  );
}
