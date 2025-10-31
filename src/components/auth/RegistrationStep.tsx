import React from "react";
import { Button } from "@/components/ui/button";
import NameInput from "../NameInput";
import Logo from "../Logo";

interface RegistrationStepProps {
  email: string;
  name: string;
  nameError: string;
  loading: boolean;
  successMessage: string;
  errorMessage: string;
  setName: (name: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  handleChangeEmail: () => void;
}

const RegistrationStep: React.FC<RegistrationStepProps> = ({
  email,
  name,
  nameError,
  loading,
  successMessage,
  errorMessage,
  setName,
  handleSubmit,
  handleChangeEmail,
}) => {
  return (
    <>
      <Logo />
      <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Complete your profile</h2>
      <p className="text-gray-500 mb-6 text-center">
        Please provide your name to create your account.
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
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-1">Email</p>
          <p className="text-gray-800 font-medium">{email}</p>
        </div>
        <NameInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
        />
        <Button
          type="submit"
          className="w-full h-12 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors"
          disabled={loading}
        >
          {loading ? "Creating account..." : "Create account"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={handleChangeEmail}
          disabled={loading}
        >
          Back
        </Button>
      </form>
    </>
  );
};

export default RegistrationStep;
