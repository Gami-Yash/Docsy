import { Client, Account, ID } from "node-appwrite";

const client = new Client();
const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT!;
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID!;

if (!endpoint || !projectId) {
    console.error("Appwrite endpoint or project ID is not set.");
    throw new Error("Invalid Appwrite configuration.");
}

console.log("Appwrite client initialized with endpoint:", endpoint, "and project ID:", projectId);
client.setEndpoint(endpoint).setProject(projectId);

export const account = new Account(client);

export const sendEmailOTP = async (email: string) => {
    try {
        const response = await account.createEmailToken(ID.unique(), email);
        return response;
    } catch (error: any) {
        throw new Error(error.message || "Failed to send email OTP.");
    }
};

export const verifyEmailOTP = async (email: string, otp: string) => {
    try {
        const session = await account.createSession(email, otp);
        return session;
    } catch (error: any) {
        throw new Error(error.message || "Failed to verify OTP.");
    }
};

export const getCurrentUser = async () => {
  try {
    const user = await account.get(); // Fetch the current user's session
    return user; // Return the user details
  } catch (error) {
    console.error("Error fetching current user:", error);
    return null; // Return null if no user is authenticated
  }
};
