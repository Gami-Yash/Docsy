import { account, client } from "./client";
import { ID } from "appwrite";
import { storeUserData, getUserByEmail } from "./databases";

export const sendEmailOTP = async (email: string) => {
  try {
    console.log("Sending OTP to email:", email);
    // Use createEmailToken instead of createSession for the first step
    const response = await account.createEmailToken(ID.unique(), email);
    console.log("Email token created:", response);
    return response;
  } catch (error: any) {
    console.error("Error in sendEmailOTP:", error);
    throw new Error(error.message || "Failed to send OTP");
  }
};

export const verifyEmailOTP = async (userId: string, secret: string) => {
  try {
    console.log("Verifying OTP with userId:", userId, "and secret:", secret);

    // Check if a session already exists
    const currentSession = await account.getSession("current").catch(() => null);

    if (currentSession) {
      console.log("Session already active:", currentSession);
      return { session: currentSession, redirect: true }; // Indicate that the user should be redirected
    }

    // Create a new session if no active session exists
    const session = await account.createSession(userId, secret);
    console.log("Session created:", session);

    // Store session in localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "appwrite-session",
        JSON.stringify({
          $id: session.$id,
          userId: session.userId,
          secret: session.secret, // This is the JWT
          expire: session.expire,
        })
      );
    }

    return { session, redirect: false }; // Indicate that a new session was created
  } catch (error: any) {
    console.error("Error in verifyEmailOTP:", error);
    throw new Error(error.message || "Failed to verify OTP");
  }
};

export const registerUser = async (email: string, name: string) => {
  try {
    // Check if user already exists in the database
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      console.log("User already exists in database, sending OTP instead");
      return await sendEmailOTP(email);
    }

    console.log("Creating account with email:", email, "and name:", name);
    
    // Instead of creating a user with account.create(), use email token directly
    // This will automatically create the user if they don't exist
    const response = await account.createEmailToken(ID.unique(), email);
    console.log("Email token created for new user:", response);
    
    // Store additional user data in the database
    try {
      await storeUserData(response.userId, email, name);
    } catch (dbError) {
      console.error("Error storing user data in database:", dbError);
      // Continue with the flow even if database storage fails
    }
    
    return response;
  } catch (error: any) {
    console.error("Error in registerUser:", error);
    // If there's any other issue, just propagate the error
    throw new Error(error.message || "Failed to register user");
  }
};

export const getCurrentUser = async () => {
  try {
    const authUser = await account.get();
    // Get the extended user data from the database
    const dbUser = await getUserByEmail(authUser.email);
    return { ...authUser, ...dbUser };
  } catch (error) {
    return null;
  }
};

export const logout = async () => {
  try {
    await account.deleteSession("current");
    if (typeof window !== "undefined") {
      localStorage.removeItem("appwrite-session");
    }
    return { success: true };
  } catch (error) {
    console.error("Logout error:", error);
    return { success: false };
  }
};



