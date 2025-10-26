import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import AIChat from "./pages/AIChat"; // Import the new component
import ProtectedRoute from "./services/ProtectedRoute";
import AuthGuard from "./services/AuthGuard";
import PdfChat from "./pages/PdfChat";
import FolderChat from '@/pages/FolderChat'; // Import the new component


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={ <AuthGuard> <Index /> </AuthGuard>} />
          <Route path="/sign-in" element={ <AuthGuard> <Index /> </AuthGuard> } />
          <Route path="/sign-up" element={ <AuthGuard> <Index /> </AuthGuard>}/>

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/ai" element={<AIChat />} /> {/* Add this line */}
            <Route path="/chat/:fileId" element={<PdfChat />} />
            <Route path="/folder-chat/:folderId" element={<FolderChat />} /> {/* Add this line */}
          </Route>

          {/* 404 Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
