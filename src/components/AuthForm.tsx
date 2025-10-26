"use client";

import React from "react";
import { useAuthForm } from "./auth/useAuthForm";
import EmailStep from "./auth/EmailStep";
import RegistrationStep from "./auth/RegistrationStep";
import OTPStep from "./auth/OTPStep";

const AuthForm = () => {
  const {
    step,
    email,
    name,
    otp,
    emailError,
    nameError,
    loading,
    isRegistering,
    successMessage,
    errorMessage,
    setEmail,
    setName,
    setOtp,
    handleEmailSubmit,
    handleRegistrationSubmit,
    handleOtpSubmit,
    handleResendOtp,
    handleChangeEmail,
    toggleAuthMode,
    AuthStep,
  } = useAuthForm();

  return (
    <div className="w-full max-w-md">
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
        {step === AuthStep.EMAIL && (
          <EmailStep
            email={email}
            name={name}
            isRegistering={isRegistering}
            emailError={emailError}
            nameError={nameError}
            loading={loading}
            successMessage={successMessage}
            errorMessage={errorMessage}
            setEmail={setEmail}
            setName={setName}
            toggleAuthMode={toggleAuthMode}
            handleSubmit={handleEmailSubmit}
          />
        )}

        {step === AuthStep.REGISTRATION && (
          <RegistrationStep
            email={email}
            name={name}
            nameError={nameError}
            loading={loading}
            successMessage={successMessage}
            errorMessage={errorMessage}
            setName={setName}
            handleSubmit={handleRegistrationSubmit}
            handleChangeEmail={handleChangeEmail}
          />
        )}

        {step === AuthStep.OTP && (
          <OTPStep
            email={email}
            otp={otp}
            loading={loading}
            successMessage={successMessage}
            errorMessage={errorMessage}
            setOtp={setOtp}
            handleSubmit={handleOtpSubmit}
            handleResendOtp={handleResendOtp}
            handleChangeEmail={handleChangeEmail}
          />
        )}
      </div>
    </div>
  );
};

export default AuthForm;
