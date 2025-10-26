import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { sendEmailOTP, verifyEmailOTP, registerUser } from "../../lib/appwrite/auth";
import { getUserByEmail, storeUserData } from "@/lib/appwrite/databases";

enum AuthStep {
  EMAIL = "email",
  REGISTRATION = "registration",
  OTP = "otp",
}

export const useAuthForm = () => {
  const [step, setStep] = useState<AuthStep>(AuthStep.EMAIL);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [emailError, setEmailError] = useState("");
  const [nameError, setNameError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [userId, setUserId] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setEmailError("");
    setSuccessMessage("");
    setErrorMessage("");

    if (!email || !email.includes("@")) {
      setEmailError("Please enter a valid email address");
      setLoading(false);
      return;
    }

    try {
      // Check if the user exists in the database
      const existingUser = await getUserByEmail(email);
      console.log("Existing user check:", existingUser);

      if (!existingUser) {
        // If the user does not exist, redirect them to the registration step
        setIsRegistering(true);
        setStep(AuthStep.REGISTRATION);
        setLoading(false);
        return;
      }

      // If the user exists, proceed with sending the OTP for login
      const response = await sendEmailOTP(email);
      console.log("Email token response:", response);

      setUserId(response.userId);
      setSuccessMessage("OTP sent to your email! Please check your inbox.");
      setStep(AuthStep.OTP);
      toast({
        title: "Verification code sent!",
        description: `We've sent a code to ${email}`,
      });
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      setErrorMessage(error.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNameError("");
    setSuccessMessage("");
    setErrorMessage("");

    if (!name.trim()) {
      setNameError("Please enter your name");
      setLoading(false);
      return;
    }

    try {
      // Register the user with email and name
      const response = await registerUser(email, name);
      console.log("Registration response:", response);

      setUserId(response.userId);
      setSuccessMessage("Account created! OTP sent to your email.");
      setStep(AuthStep.OTP);
      toast({
        title: "Account created!",
        description: `We've sent a verification code to ${email}`,
      });
    } catch (error: any) {
      console.error("Error during registration:", error);
      setErrorMessage(error.message || "Failed to register. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    if (otp.length !== 6) {
      toast({
        variant: "destructive",
        title: "Invalid code",
        description: "Please enter all 6 digits of your verification code",
      });
      setLoading(false);
      return;
    }

    if (!userId) {
      setErrorMessage("Session ID is missing. Please try again.");
      setLoading(false);
      return;
    }

    try {
      const { session, redirect } = await verifyEmailOTP(userId, otp);

      if (redirect) {
        console.log("Redirecting to dashboard due to active session");
        navigate("/dashboard");
        return;
      }

      console.log("Session created successfully:", session);

      // Store session in localStorage for future use
      localStorage.setItem("appwrite-session", JSON.stringify(session));

      setSuccessMessage("OTP verified successfully! Redirecting to dashboard...");
      toast({
        title: "Success!",
        description: "You have been authenticated successfully",
      });

      // Redirect to dashboard
      setTimeout(() => {
        navigate("/dashboard");
      }, 1000);
    } catch (error: any) {
      console.error("Error during verification:", error);
      setErrorMessage(error.message || "Failed to verify OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      // Resend the email token
      const response = await sendEmailOTP(email);
      console.log("Resend token response:", response);

      // Update the userId
      setUserId(response.userId);

      setSuccessMessage("A new OTP has been sent to your email.");
      toast({
        title: "Code resent",
        description: `We've sent a new verification code to ${email}`,
      });
    } catch (error: any) {
      console.error("Error resending OTP:", error);
      setErrorMessage(error.message || "Failed to resend OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = () => {
    setStep(AuthStep.EMAIL);
    setOtp("");
    setEmailError("");
    setSuccessMessage("");
    setErrorMessage("");
  };

  const toggleAuthMode = () => {
    setIsRegistering(!isRegistering);
    setEmailError("");
    setNameError("");
    setErrorMessage("");
    setSuccessMessage("");
  };

  return {
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
  };
};
