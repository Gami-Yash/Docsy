import { Client, Databases, Query,Storage,ID } from "appwrite";
import { client } from "./client";
import { appwriteConfig } from "../config/appwriteConfig";
import { FileDocument } from '../types';

// Initialize the Databases service
const databases = new Databases(client);

// Initialize the Storage service
const storage = new Storage(client);

// Function to store user data
export const storeUserData = async (userId: string, email: string, name: string) => {
  try {
    console.log("Storing user data in collection:", {
      userId,
      email,
      name,
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.usersCollectionId
    });
    
    // Create a document in the users collection
    // Note: Changed "name" to "fullName" to match the collection schema
    const userData = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId, 
      userId, // Use the same ID as the Appwrite account
      {
        fullName: name, // Changed from "name" to "fullName"
        email,
        accountId: userId, // Also provide the field as accountId to match your schema
      }
    );
    
    console.log("User data stored successfully:", userData);
    return userData;
  } catch (error) {
    console.error("Error storing user data:", error);
    throw error;
  }
};

// Function to get user by ID
export const getUserById = async (userId: string) => {
  try {
    return await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId,
      userId
    );
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
};

// Function to get user by email
export const getUserByEmail = async (email: string) => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId,
      [Query.equal("email", [email])] // Ensure the query matches the email field
    );

    return response.documents.length > 0 ? response.documents[0] : null;
  } catch (error) {
    console.error("Error finding user by email:", error);
    return null;
  }
};



export const getFileType = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  let type = 'document';
  
  if (extension === 'pdf') {
    type = 'pdf';
  }
  
  return { type, extension };
};

export const constructFileUrl = (bucketFileId: string) => {
  return `${import.meta.env.VITE_APPWRITE_ENDPOINT}/storage/buckets/${import.meta.env.VITE_APPWRITE_BUCKET}/files/${bucketFileId}/view?project=${import.meta.env.VITE_APPWRITE_PROJECT_ID}`;
};

export const uploadFile = async (file: File, userId: string) => {
  try {
    // 1. Upload file to bucket
    const fileId = ID.unique();
    const bucketFile = await storage.createFile(
      import.meta.env.NEXT_PUBLIC_APPWRITE_BUCKET,
      fileId,
      file
    );
    
    // 2. Store metadata in Files_Collection
    const fileDocument = {
      type: getFileType(file.name).type,
      name: file.name,
      url: constructFileUrl(bucketFile.$id),
      extension: getFileType(file.name).extension,
      size: file.size,
      owner: userId,
      bucketFileId: bucketFile.$id,
      uploadDate: new Date().toISOString(),
      status: "Unread"
    };
    
    // Create document in the Files_Collection
    const newFileDoc = await databases.createDocument(
      appwriteConfig.databaseId,
      import.meta.env.VITE_APPWRITE_FILES_COLLECTION,
      ID.unique(),
      fileDocument
    );
    
    // Add bucketFile data to the response
    return {
      ...bucketFile,
      ...newFileDoc,
      url: fileDocument.url
    };
  } catch (error) {
    console.error("File upload failed:", error);
    throw error;
  }
};

export const getFilesByUserId = async (userId: string) => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      import.meta.env.VITE_APPWRITE_FILES_COLLECTION,
      [Query.equal("users", userId)] // Query the "users" attribute with the userId
    );

    console.log("Files response:", response); // Debugging log
    return response.documents;
  } catch (error) {
    console.error("Error fetching files:", error);
    return []; // Return an empty array if there's an error
  }
};

export const getFileById = async (fileId: string): Promise<FileDocument | null> => {
  try {
    const response = await databases.getDocument(
      appwriteConfig.databaseId,
      import.meta.env.VITE_APPWRITE_FILES_COLLECTION,
      fileId
    ) as FileDocument;
    
    // Construct the file URL
    const fileUrl = constructFileUrl(response.fileID);
    
    return {
      ...response,
      url: fileUrl,
    };
  } catch (error) {
    console.error("Error fetching file details:", error);
    return null;
  }
};

// Create a new folder
export const createFolder = async (name: string, description: string, userId: string) => {
  try {
    const newFolder = await databases.createDocument(
      appwriteConfig.databaseId,
      import.meta.env.VITE_APPWRITE_FOLDERS_COLLECTION,
      ID.unique(),
      {
        name,
        description,
        userId,
      }
    );
    
    return newFolder;
  } catch (error) {
    console.error("Error creating folder:", error);
    throw error;
  }
};

// Get folders by user ID
export const getFoldersByUserId = async (userId: string) => {
  try {
    return await databases.listDocuments(
      appwriteConfig.databaseId,
      import.meta.env.VITE_APPWRITE_FOLDERS_COLLECTION,
      [
        Query.equal("userId", userId)
      ]
    );
  } catch (error) {
    console.error("Error fetching folders:", error);
    throw error;
  }
};

// Add file to folder
export const addFileToFolder = async (fileId: string, folderId: string) => {
  try {
    // Update file document to add folder reference
    const updatedFile = await databases.updateDocument(
      appwriteConfig.databaseId,
      import.meta.env.VITE_APPWRITE_FILES_COLLECTION,
      fileId,
      {
        folders: folderId
      }
    );
    
    return updatedFile;
  } catch (error) {
    console.error("Error adding file to folder:", error);
    throw error;
  }
};

// Get files by folder ID
export const getFilesByFolderId = async (folderId: string) => {
  try {
    return await databases.listDocuments(
      appwriteConfig.databaseId,
      import.meta.env.VITE_APPWRITE_FILES_COLLECTION,
      [
        Query.equal("folders", folderId)
      ]
    );
  } catch (error) {
    console.error("Error fetching files by folder ID:", error);
    throw error;
  }
};

// Add this function to get the actual fileID used by the vector database
export const getActualFileId = (file: any): string => {
  // Try all possible locations where the fileID might be stored
  if (file.fileID) return file.fileID;  
  if (file.fileId) return file.fileId;
  if (file.$id) return file.$id;
  
  // If we can't find a specific identifier, just return the object
  return typeof file === 'string' ? file : JSON.stringify(file);
};
export { databases, Query };