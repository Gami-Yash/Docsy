
import React from "react";
import { Button } from "@/components/ui/button";
import OTPInput from "../OTPInput";

interface OTPStepProps {
  email: string;
  otp: string;
  loading: boolean;
  successMessage: string;
  errorMessage: string;
  setOtp: (otp: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  handleResendOtp: () => void;
  handleChangeEmail: () => void;
}

const OTPStep: React.FC<OTPStepProps> = ({
  email,
  otp,
  loading,
  successMessage,
  errorMessage,
  setOtp,
  handleSubmit,
  handleResendOtp,
  handleChangeEmail,
}) => {
  return (
    <>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Check your email</h2>
      <p className="text-gray-500 mb-6">
        We've sent a 6-digit verification code to{" "}
        <span className="font-medium text-gray-700">{email}</span>
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

      <form onSubmit={handleSubmit} className="space-y-5">
        <OTPInput length={6} value={otp} onChange={setOtp} />
        <Button
          type="submit"
          className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
          disabled={loading}
        >
          {loading ? "Verifying..." : "Verify account"}
        </Button>
      </form>

      <div className="mt-6 flex flex-col items-center text-sm text-gray-500 space-y-4">
        <button
          onClick={handleResendOtp}
          className="text-purple-600 hover:text-purple-800 font-medium"
          disabled={loading}
        >
          Resend code
        </button>

        <button
          onClick={handleChangeEmail}
          className="text-gray-500 hover:text-gray-700"
        >
          Use a different email address
        </button>
      </div>
    </>
  );
};

export default OTPStep;
