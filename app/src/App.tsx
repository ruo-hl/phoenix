import { Suspense } from "react";
import { RelayEnvironmentProvider } from "react-relay";

import { FloatingChatbox } from "./components/chat";
import { CredentialsProvider } from "./contexts/CredentialsContext";
import { FeatureFlagsProvider } from "./contexts/FeatureFlagsContext";
import { FunctionalityProvider } from "./contexts/FunctionalityContext";
import { PreferencesProvider } from "./contexts/PreferencesContext";
import { ThemeProvider } from "./contexts";
import { GlobalStyles } from "./GlobalStyles";
import { useObsAgentChat } from "./hooks";
import RelayEnvironment from "./RelayEnvironment";
import { AppRoutes } from "./Routes";

import "react-resizable/css/styles.css";

export function App() {
  return (
    <FunctionalityProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </FunctionalityProvider>
  );
}

export function AppContent() {
  const { sendMessage } = useObsAgentChat();

  return (
    <RelayEnvironmentProvider environment={RelayEnvironment}>
      <GlobalStyles />
      <FeatureFlagsProvider>
        <PreferencesProvider>
          <CredentialsProvider>
            <Suspense>
              <AppRoutes />
            </Suspense>
            <FloatingChatbox
              onSendMessage={sendMessage}
              placeholder="Ask about observability issues..."
            />
          </CredentialsProvider>
        </PreferencesProvider>
      </FeatureFlagsProvider>
    </RelayEnvironmentProvider>
  );
}
