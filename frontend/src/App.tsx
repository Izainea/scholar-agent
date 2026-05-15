import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "@/components/RequireAuth";
import { Sidebar } from "@/components/Sidebar";
import { DocsPage } from "@/pages/DocsPage";
import { BrauerPage } from "@/pages/BrauerPage";
import { ComparePage } from "@/pages/ComparePage";
import { ScientiPage } from "@/pages/ScientiPage";

function App() {
  return (
    <RequireAuth>
      <div className="flex h-screen bg-background text-foreground">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/docs" replace />} />
            <Route path="/docs" element={<DocsPage />} />
            {/* Legacy /chat URL → redirect to /docs. */}
            <Route path="/chat" element={<Navigate to="/docs" replace />} />
            <Route path="/brauer" element={<BrauerPage />} />
            <Route path="/brauer/:authorKey" element={<BrauerPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/scienti" element={<ScientiPage />} />
            <Route path="*" element={<Navigate to="/docs" replace />} />
          </Routes>
        </main>
      </div>
    </RequireAuth>
  );
}

export default App;
