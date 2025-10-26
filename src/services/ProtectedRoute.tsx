
import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getCurrentUser } from "@/lib/appwrite/auth";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { AlertCircle, Loader2 } from "lucide-react";

const ProtectedRoute = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const user = await getCurrentUser();
        setIsAuthenticated(!!user);
        
        if (!user) {
          toast.error("Authentication required", {
            description: "Please sign in to access this page"
          });
        }
      } catch (error) {
        console.error("Error checking session:", error);
        setIsAuthenticated(false);
        toast.error("Authentication error", {
          description: "There was a problem verifying your session"
        });
      }
    };

    checkSession();
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="mb-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Loading your experience</h3>
          <p className="text-sm text-muted-foreground">Please wait while we prepare everything for you</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <div className="w-full max-w-md">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="ml-2">Authentication Required</AlertTitle>
            <AlertDescription>
              You need to be signed in to access this page. Please sign in with your credentials to continue.
            </AlertDescription>
          </Alert>
          
          <div className="flex justify-center">
            <Button onClick={() => window.location.href = "/sign-in"} className="bg-primary text-primary-foreground">
              Go to Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
