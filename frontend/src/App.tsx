import { Navigate, Route, Routes } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { ChatPage } from "@/pages/ChatPage";
import { BrauerPage } from "@/pages/BrauerPage";
import { ComparePage } from "@/pages/ComparePage";
import { ScientiPage } from "@/pages/ScientiPage";

function App() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/brauer" element={<BrauerPage />} />
          <Route path="/brauer/:authorKey" element={<BrauerPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/scienti" element={<ScientiPage />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
