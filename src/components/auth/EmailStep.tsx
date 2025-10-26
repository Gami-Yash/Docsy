
import React from "react";
import { Button } from "@/components/ui/button";
import EmailInput from "../EmailInput";
import NameInput from "../NameInput";

interface EmailStepProps {
  email: string;
  name: string;
  isRegistering: boolean;
  emailError: string;
  nameError: string;
  loading: boolean;
  successMessage: string;
  errorMessage: string;
  setEmail: (email: string) => void;
  setName: (name: string) => void;
  toggleAuthMode: () => void;
  handleSubmit: (e: React.FormEvent) => void;
}

const EmailStep: React.FC<EmailStepProps> = ({
  email,
  name,
  isRegistering,
  emailError,
  nameError,
  loading,
  successMessage,
  errorMessage,
  setEmail,
  setName,
  toggleAuthMode,
  handleSubmit,
}) => {
  return (
    <>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">
        {isRegistering ? "Create an account" : "Welcome back"}
      </h2>
      <p className="text-gray-500 mb-6">
        {isRegistering
          ? "Enter your details to get started"
          : "Enter your email to sign in to your account"}
      </p>

      {successMessage && (
        <div className="p-2 mb-4 text-green-700 bg-green-100 rounded">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="p-2 mb-4 text-red-700 bg-red-100 rounded">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <EmailInput
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
        />
        
        {isRegistering && (
          <NameInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={nameError}
          />
        )}
        
        <Button
          type="submit"
          className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
          disabled={loading}
        >
          {loading ? "Processing..." : isRegistering ? "Continue" : "Continue with email"}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={toggleAuthMode}
          className="text-purple-600 hover:text-purple-800 font-medium text-sm"
        >
          {isRegistering
            ? "Already have an account? Sign in"
            : "Don't have an account? Register"}
        </button>
      </div>
    </>
  );
};

export default EmailStep;
