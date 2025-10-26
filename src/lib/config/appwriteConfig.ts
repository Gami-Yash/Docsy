export const appwriteConfig = {
    endpointUrl: import.meta.env.VITE_APPWRITE_ENDPOINT!,
    projectId: import.meta.env.VITE_APPWRITE_PROJECT_ID!,
    databaseId: import.meta.env.VITE_APPWRITE_DATABASE || "",
    usersCollectionId: import.meta.env.VITE_APPWRITE_USERS_COLLECTION || "",
    secretKey: import.meta.env.VITE_APPWRITE_SECRET_KEY || ""
};