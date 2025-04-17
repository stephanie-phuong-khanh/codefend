// components/repositories/RepositoryUpgradeDetails.tsx
import { Button, Spinner } from "@/components/ui";
import { useEffect, useRef, useState } from "react";

// Define types for a log entry (replaces the fixed step structure)
interface LogEntry {
  id: string;
  timestamp: string;
  type: "info" | "success" | "error" | "warning";
  message: string;
  details?: string;
}

interface UpgradeStatus {
  jobId: string;
  status: "pending" | "running" | "completed" | "failed";
  logs: LogEntry[];
  completedAt?: string;
  error?: string;
}

interface RepositoryUpgradeDetailsProps {
  repositoryId: string;
  repositoryName: string;
  packageName: string;
  newVersion: string;
  onClose?: () => void;
}

export default function RepositoryUpgradeDetails({
  repositoryId,
  repositoryName = "router-example",
  packageName = "react-router-dom",
  newVersion = "6.22.3",
  onClose,
}: RepositoryUpgradeDetailsProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [upgradeStatus, setUpgradeStatus] = useState<UpgradeStatus | null>(
    null
  );
  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Add a state to control auto-scrolling
  const [autoScroll, setAutoScroll] = useState(true);

  // Scroll to bottom of logs only when autoScroll is enabled
  useEffect(() => {
    if (autoScroll && logContainerRef.current && upgradeStatus?.logs?.length) {
      // Scroll the container instead of the whole page
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [upgradeStatus?.logs, autoScroll]);

  // Clean up event source on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Start SSE connection when jobId is available
  useEffect(() => {
    if (!jobId) return;

    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Create a new SSE connection
    const eventSource = new EventSource(
      `/api/repositories/${repositoryId}/upgrade?jobId=${jobId}&stream=true`
    );
    eventSourceRef.current = eventSource;

    // Handle incoming messages
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setUpgradeStatus(data);

        // Check if process is complete
        if (data.status === "completed" || data.status === "failed") {
          setIsRunning(false);
          eventSource.close();
          eventSourceRef.current = null;
        }
      } catch (err) {
        console.error("Error parsing SSE data:", err);
      }
    };

    // Handle errors
    eventSource.onerror = (err) => {
      console.error("SSE connection error:", err);
      setError("Lost connection to the server. Please try again.");
      setIsRunning(false);
      eventSource.close();
      eventSourceRef.current = null;
    };

    // Initial fetch to get current status
    fetchStatus(jobId);

    return () => {
      eventSource.close();
    };
  }, [jobId, repositoryId]);

  // Start upgrade process
  const startUpgrade = async () => {
    setIsRunning(true);
    setError(null);
    setJobId(null);
    setUpgradeStatus(null);

    try {
      const response = await fetch(
        `/api/repositories/${repositoryId}/upgrade`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            packageName,
            newVersion,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start upgrade process");
      }

      const data = await response.json();
      setJobId(data.jobId);
    } catch (error) {
      console.error("Error starting upgrade:", error);
      setError(
        error instanceof Error ? error.message : "Unknown error occurred"
      );
      setIsRunning(false);
    }
  };

  // Fetch current status (non-streaming)
  const fetchStatus = async (jobId: string) => {
    try {
      const response = await fetch(
        `/api/repositories/${repositoryId}/upgrade?jobId=${jobId}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch status");
      }

      const data = await response.json();
      setUpgradeStatus(data);
    } catch (error) {
      console.error("Error fetching status:", error);
    }
  };

  // Helper to get icon for log entry type
  const getIconForLogType = (type: string) => {
    switch (type) {
      case "success":
        return (
          <svg
            className="w-5 h-5 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        );
      case "error":
        return (
          <svg
            className="w-5 h-5 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        );
      case "warning":
        return (
          <svg
            className="w-5 h-5 text-yellow-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        );
      default:
        return (
          <svg
            className="w-5 h-5 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  // Dynamic log entries or fallback to empty array
  const logs = upgradeStatus?.logs || [];

  // Determine if upgrade is successful
  const isSuccessful = !isRunning && upgradeStatus?.status === "completed";

  // Add states for PR creation
  const [isCreatingPR, setIsCreatingPR] = useState(false);
  const [prUrl, setPrUrl] = useState<string | null>(null);

  return (
    <div className="space-y-6 px-4">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="border border-gray-200 rounded-md overflow-hidden">
        <div className="bg-gray-100 p-3 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-medium">Upgrade Process Log</h3>
          <div className="flex items-center space-x-4">
            {/* Auto-scroll toggle button */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`text-xs flex items-center ${
                autoScroll ? "text-blue-600" : "text-gray-500"
              }`}
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
              {autoScroll ? "Auto-scroll: On" : "Auto-scroll: Off"}
            </button>
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            )}

            {isRunning && (
              <span className="flex items-center text-sm text-gray-600">
                <Spinner size="sm" className="mr-2" /> Running...
              </span>
            )}
            {isSuccessful && (
              <span className="flex items-center text-sm text-green-600">
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Completed
              </span>
            )}
            {!isRunning && upgradeStatus?.status === "failed" && (
              <span className="flex items-center text-sm text-red-600">
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Failed
              </span>
            )}
          </div>
        </div>

        <div className="bg-white p-0">
          <div ref={logContainerRef} className="max-h-96 overflow-y-auto p-4">
            {logs.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                {isRunning
                  ? "Waiting for logs..."
                  : "No logs available. Click 'Start Upgrade Process' to begin."}
              </div>
            ) : (
              <div className="space-y-4">
                {logs.map((log) => (
                  <div key={log.id} className="flex">
                    <div className="mr-3 flex-shrink-0 mt-1">
                      {getIconForLogType(log.type)}
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-baseline mb-1">
                        <h4 className="font-medium">{log.message}</h4>
                        <span className="ml-2 text-xs text-gray-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {log.details &&
                        (log.message === "CLI Output" ? (
                          <pre
                            className="text-sm bg-gray-50 p-3 rounded font-mono overflow-x-auto whitespace-pre-wrap mt-2 text-gray-800"
                            style={{ maxHeight: "60vh" }}
                          >
                            {log.details}
                          </pre>
                        ) : (
                          <pre className="text-sm bg-gray-50 p-3 rounded font-mono overflow-x-auto whitespace-pre-wrap mt-2 text-gray-800">
                            {log.details}
                          </pre>
                        ))}
                    </div>
                  </div>
                ))}
                {/* This empty div serves as a marker for the latest content */}
                <div ref={logEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-between p-4">
        <Button
          onClick={
            isSuccessful
              ? async () => {
                  try {
                    setIsCreatingPR(true);
                    setError(null);

                    // Call our new API endpoint to create a PR
                    const response = await fetch(
                      `/api/repositories/${repositoryId}/pull-request`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          jobId: upgradeStatus?.jobId,
                          packageName,
                          newVersion,
                          title: `Upgrade ${packageName} to version ${newVersion}`,
                          description: `This PR upgrades ${packageName} to version ${newVersion}.\n\nAll breaking changes have been automatically fixed by codefend-ai.`,
                        }),
                      }
                    );

                    const data = await response.json();

                    if (!response.ok) {
                      throw new Error(
                        data.error || "Failed to create pull request"
                      );
                    }

                    // Store the PR URL and potentially open it
                    setPrUrl(data.prUrl);

                    // Open the PR in a new tab
                    window.open(data.prUrl, "_blank");
                  } catch (error: any) {
                    console.error("Error creating PR:", error);
                    setError(`Failed to create pull request: ${error.message}`);
                  } finally {
                    setIsCreatingPR(false);
                  }
                }
              : startUpgrade
          }
          disabled={isRunning || isCreatingPR}
          className={`w-full ${
            isSuccessful ? "bg-green-600 hover:bg-green-700 text-white" : ""
          }`}
        >
          {isRunning ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Running Upgrade Process...
            </>
          ) : isCreatingPR ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Creating Pull Request...
            </>
          ) : isSuccessful ? (
            "Open Pull Request"
          ) : upgradeStatus?.status === "failed" ? (
            "Retry Upgrade"
          ) : (
            "Start Upgrade Process"
          )}
        </Button>
      </div>

      {/* Display error message if PR creation fails */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mt-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Display PR URL if successful */}
      {prUrl && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 mt-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">
                Pull Request Created
              </h3>
              <div className="mt-2 text-sm text-green-700">
                <p>Your pull request has been created successfully.</p>
                <a
                  href={prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center text-sm font-medium text-green-600 hover:text-green-500"
                >
                  View Pull Request
                  <svg
                    className="ml-1 h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
