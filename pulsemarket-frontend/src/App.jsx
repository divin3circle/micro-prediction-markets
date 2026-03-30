import { AutoSignSessionProvider } from "./context/AutoSignSessionContext";
import { AppShell } from "./AppShell";

function App() {
  return (
    <AutoSignSessionProvider>
      <AppShell />
    </AutoSignSessionProvider>
  );
}

export default App;
