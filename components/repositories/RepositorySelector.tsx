// components/repositories/RepositorySelector.tsx
import { useState, useEffect } from 'react';
import { Button, Select, Spinner } from '@/components/ui';

interface Repository {
  id: number;
  name: string;
  [key: string]: any; // For any other properties
}

interface RepositorySelectorProps {
  organizationId: string;
  onSelect: (repository: Repository | null) => void;
}

export default function RepositorySelector({ organizationId, onSelect }: RepositorySelectorProps) {
  const [loading, setLoading] = useState(false);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | undefined>(undefined);
  
  useEffect(() => {
    if (organizationId) {
      fetchRepositories();
    }
  }, [organizationId]);
  
  async function fetchRepositories() {
    setLoading(true);
    try {
      const response = await fetch(`/api/github/repositories?orgId=${organizationId}`);
      const data = await response.json();
      setRepositories(data.repositories || []);
    } catch (error) {
      console.error('Error fetching repositories:', error);
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Select a Repository</h3>
      {loading ? (
        <Spinner />
      ) : repositories.length === 0 ? (
        <p>No repositories available to add. Make sure the GitHub App is installed on your repositories.</p>
      ) : (
        <>
          <Select
            options={[
              { label: "Select a repository", value: "" },
              ...repositories.map(repo => ({ label: repo.name, value: repo.id.toString() }))
            ]}
            value={selectedRepo}
            onChange={(e) => setSelectedRepo(e.target.value)}
          />
          <Button 
            disabled={!selectedRepo} 
            onClick={() => onSelect(repositories.find(r => r.id.toString() === selectedRepo) || null)}
          >
            Continue
          </Button>
        </>
      )}
    </div>
  );
}
