import { Client, Account } from "appwrite"; // Make sure you're using the browser SDK
import { appwriteConfig } from "../config/appwriteConfig";

// Initialize the Appwrite client
const client = new Client();

client
  .setEndpoint(appwriteConfig.endpointUrl) 
  .setProject(appwriteConfig.projectId);   

// Initialize the Account service
const account = new Account(client);

// Restore session from localStorage if available
if (typeof window !== "undefined") {
  try {
    const sessionData = localStorage.getItem("appwrite-session");
    if (sessionData) {
      const session = JSON.parse(sessionData);
      if (session && session.secret) {
        // Set the JWT token for authenticated requests
        client.setJWT(session.secret);
      }
    }
  } catch (error) {
    console.error("Failed to restore session:", error);
    // Clear the invalid session data
    localStorage.removeItem("appwrite-session");
  }
}





export { client, account };