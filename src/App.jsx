import React, { Suspense } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Orb } from "@/components/Orb";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Landing from "@/landing/Landing";
import AppShell from "@/app/AppShell";
import Home from "@/app/Home";
import Chat from "@/app/Chat";
import Knowledge from "@/app/Knowledge";
import Documents from "@/app/Documents";
import History from "@/app/History";
import Settings from "@/app/Settings";
import SystemStatus from "@/app/SystemStatus";
import RuralMaps from "@/app/RuralMaps";
import AutoFormFiller from "@/app/AutoFormFiller";
import NLPStudio from "@/app/NLPStudio";

function Loader() {
  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <Orb state="thinking" size={90} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <div className="App">
        <BrowserRouter>
          <Suspense fallback={<Loader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/app" element={<AppShell />}>
                <Route index element={<Home />} />
                <Route path="chat" element={<Chat />} />
                <Route path="chat/:id" element={<Chat />} />
                <Route path="knowledge" element={<Knowledge />} />
                <Route path="documents" element={<Documents />} />
                <Route path="forms" element={<AutoFormFiller />} />
                <Route path="nlp" element={<NLPStudio />} />
                <Route path="maps" element={<RuralMaps />} />
                <Route path="history" element={<History />} />
                <Route path="status" element={<SystemStatus />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </div>
    </ErrorBoundary>
  );
}
