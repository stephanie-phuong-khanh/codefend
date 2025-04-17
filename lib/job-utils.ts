// Job utility functions for repository operations

// In-memory store for job status (in production, use Redis or a database)
export const jobStore = new Map();

// Get a job status by ID
export function getJobStatus(jobId: string) {
  return jobStore.get(jobId);
}

// Define types for a log entry
export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  details?: string;
}

export interface UpgradeStatus {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  logs: LogEntry[];
  completedAt?: string;
  error?: string;
  tempDir?: string; // Store the temporary directory for cleanup
}

// Helper function to add a log entry
export function addLogEntry(
  jobId: string, 
  type: 'info' | 'success' | 'error' | 'warning', 
  message: string, 
  details?: string
): void {
  const status = jobStore.get(jobId);
  if (!status) return;

  const logEntry: LogEntry = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
    timestamp: new Date().toISOString(),
    type,
    message,
    details
  };

  status.logs.push(logEntry);
  jobStore.set(jobId, status);
}

// Helper function to update job status
export function updateJobStatus(jobId: string, updates: Partial<UpgradeStatus>): void {
  const currentStatus = jobStore.get(jobId);
  if (!currentStatus) return;
  
  const updatedStatus = {
    ...currentStatus,
    ...updates,
  };
  
  jobStore.set(jobId, updatedStatus);
}

// Helper function to append to CLI output
export function appendToOutput(jobId: string, logId: string, text: string) {
  const status = jobStore.get(jobId);
  if (!status) return;
  
  const cliOutputLog = status.logs.find((log: LogEntry) => log.id === logId);
  if (cliOutputLog && cliOutputLog.details) {
    cliOutputLog.details += text;
    cliOutputLog.timestamp = new Date().toISOString(); // Update timestamp
    jobStore.set(jobId, status);
  }
}
