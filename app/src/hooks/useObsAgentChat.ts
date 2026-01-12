import { useCallback, useState, useRef } from "react";

/**
 * OBS Agent API URL - defaults to localhost:8080
 * Can be overridden via environment variable
 */
const OBS_AGENT_URL =
  import.meta.env.VITE_OBS_AGENT_URL || "http://localhost:8080";

interface UseObsAgentChatOptions {
  /**
   * Phoenix project name to analyze
   */
  projectName?: string;
  /**
   * Use streaming responses (SSE)
   */
  streaming?: boolean;
}

interface UseObsAgentChatReturn {
  /**
   * Send a message to the OBS agent
   */
  sendMessage: (message: string) => Promise<string>;
  /**
   * Send a message with streaming response
   */
  sendMessageStreaming: (
    message: string,
    onChunk: (chunk: string) => void
  ) => Promise<void>;
  /**
   * Reset the current session
   */
  resetSession: () => Promise<void>;
  /**
   * Current session ID
   */
  sessionId: string | null;
  /**
   * Whether connected to agent
   */
  isConnected: boolean;
  /**
   * Last error message
   */
  error: string | null;
  /**
   * Whether a request is in flight
   */
  isLoading: boolean;
}

/**
 * Hook for communicating with the OBS Agent API.
 *
 * @example
 * ```tsx
 * const { sendMessage, isLoading, error } = useObsAgentChat();
 *
 * const handleSend = async (text: string) => {
 *   const response = await sendMessage(text);
 *   console.log(response);
 * };
 * ```
 */
export function useObsAgentChat(
  options: UseObsAgentChatOptions = {}
): UseObsAgentChatReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Use ref to avoid stale closure issues
  const sessionIdRef = useRef<string | null>(null);
  sessionIdRef.current = sessionId;

  const sendMessage = useCallback(
    async (message: string): Promise<string> => {
      setError(null);
      setIsLoading(true);

      try {
        const response = await fetch(`${OBS_AGENT_URL}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            session_id: sessionIdRef.current,
            project_name: options.projectName,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.detail || `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const data = await response.json();

        if (!sessionIdRef.current && data.session_id) {
          setSessionId(data.session_id);
        }
        setIsConnected(true);

        return data.response;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        setIsConnected(false);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [options.projectName]
  );

  const sendMessageStreaming = useCallback(
    async (
      message: string,
      onChunk: (chunk: string) => void
    ): Promise<void> => {
      setError(null);
      setIsLoading(true);

      try {
        const response = await fetch(`${OBS_AGENT_URL}/api/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            session_id: sessionIdRef.current,
            project_name: options.projectName,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === "session" && data.session_id) {
                  if (!sessionIdRef.current) {
                    setSessionId(data.session_id);
                  }
                } else if (data.type === "content") {
                  onChunk(data.content);
                } else if (data.type === "error") {
                  throw new Error(data.error);
                }
              } catch (parseErr) {
                // Skip invalid JSON lines
              }
            }
          }
        }

        setIsConnected(true);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        setIsConnected(false);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [options.projectName]
  );

  const resetSession = useCallback(async () => {
    if (sessionIdRef.current) {
      try {
        await fetch(`${OBS_AGENT_URL}/api/sessions/${sessionIdRef.current}`, {
          method: "DELETE",
        });
      } catch {
        // Ignore cleanup errors
      }
    }
    setSessionId(null);
    setIsConnected(false);
    setError(null);
  }, []);

  return {
    sendMessage,
    sendMessageStreaming,
    resetSession,
    sessionId,
    isConnected,
    error,
    isLoading,
  };
}
