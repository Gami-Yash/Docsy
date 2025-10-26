import { ID, Query } from "appwrite";
import { databases } from "@/lib/appwrite/databases";
import { appwriteConfig } from "@/lib/config/appwriteConfig";
import { ChatMessage } from "./AiService";

// Define database and collection IDs
const DATABASE_ID = appwriteConfig.databaseId;
// Make sure this exactly matches your collection ID in Appwrite
const MESSAGES_COLLECTION_ID = import.meta.env.VITE_APPWRITE_MESSAGES_COLLECTION || "messages";

// Max retry attempts for creating documents
const MAX_RETRIES = 3;

/**
 * Creates a document with retry logic for handling ID conflicts
 */
async function createDocumentWithRetry(
  databaseId: string,
  collectionId: string,
  data: any,
  retriesLeft = MAX_RETRIES
): Promise<any> {
  try {
    // Generate a truly unique ID with timestamp to avoid collisions
    const documentId = `${ID.unique()}-${Date.now()}`;

    // Create the document
    const result = await databases.createDocument(
      databaseId,
      collectionId,
      documentId,
      data
    );

    return result;
  } catch (error) {
    // If we have retries left and hit a document exists error, try again
    if (retriesLeft > 0 && error instanceof Error &&
      (error.message.includes('Document with the requested ID already exists') ||
        error.toString().includes('409'))) {
      console.warn(`Document creation conflict, retrying... (${retriesLeft} attempts left)`);
      // Wait a small random time before retrying to reduce collision probability
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      return createDocumentWithRetry(databaseId, collectionId, data, retriesLeft - 1);
    }

    // If we're out of retries or it's a different error, throw it
    console.error("Error creating document:", error);
    throw error;
  }
}

/**
 * Creates a new conversation and returns the conversationId
 */
export const createConversation = async (
  fileId: string,
  userId: string,
  fileName: string // Changed from title to fileName
): Promise<string> => {
  try {
    const conversationId = `conv-${ID.unique()}-${Date.now()}`;
    
    // Create conversation starter message
    await createDocumentWithRetry(
      DATABASE_ID,
      MESSAGES_COLLECTION_ID,
      {
        conversationId,
        fileId,
        userId,
        content: `Chat started for ${fileName}`,
        role: "system",
        timestamp: new Date().toISOString(),
        sequence: 0,
        // hasProcessedPdf: true // Track if the PDF has been processed for vectors
      }
    );
    
    return conversationId;
  } catch (error) {
    console.error("Failed to create conversation:", error);
    throw new Error("Failed to initialize chat. Please try again.");
  }
};

/**
 * Adds a message to a conversation
 */
export const addMessage = async (
  conversationId: string,
  fileId: string,
  userId: string,
  message: ChatMessage,
  sequence: number
): Promise<string> => {
  try {
    const result = await createDocumentWithRetry(
      DATABASE_ID,
      MESSAGES_COLLECTION_ID, // Updated collection name
      {
        conversationId,
        fileId,
        userId,
        content: message.content,
        role: message.role,
        timestamp: new Date().toISOString(),
        sequence
      }
    );

    return result.$id;
  } catch (error) {
    console.error("Error adding message:", error);
    throw error;
  }
};

/**
 * Gets conversation details for a file and user
 */
export const getConversationIdForFile = async (
  userId: string,
  fileId: string
): Promise<string | null> => {
  try {
    // Get the first message of any conversation for this file and user
    const response = await databases.listDocuments(
      DATABASE_ID,
      MESSAGES_COLLECTION_ID,
      [
        Query.equal("userId", userId),
        Query.equal("fileId", fileId),
        Query.orderAsc("timestamp"),
        Query.limit(1)
      ]
    );

    if (response.documents.length > 0) {
      return response.documents[0].conversationId;
    }

    return null;
  } catch (error) {
    console.error("Error getting conversation:", error);
    return null;
  }
};

/**
 * Gets all messages for a conversation in sequence order
 */
export const getConversationMessages = async (
  conversationId: string
): Promise<ChatMessage[]> => {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      MESSAGES_COLLECTION_ID,
      [
        Query.equal("conversationId", conversationId),
        Query.orderAsc("sequence")
      ]
    );

    // Filter out system messages and map to ChatMessage format
    const messages: ChatMessage[] = response.documents
      .filter(doc => doc.role !== "system")
      .map(doc => ({
        role: doc.role,
        content: doc.content,
        timestamp: doc.timestamp,
        sequence: doc.sequence
      }));

    return messages;
  } catch (error) {
    console.error("Error fetching conversation messages:", error);
    return [];
  }
};

/**
 * Gets all conversations for a user
 */
export const getConversations = async (
  userId: string,
  fileId?: string
): Promise<any[]> => {
  try {
    // Build query
    const queries = [
      Query.equal("userId", userId),
      Query.equal("role", "system")  // Get only system messages which mark conversation starts
    ];

    if (fileId) {
      queries.push(Query.equal("fileId", fileId));
    }

    // Get all conversation starter messages
    const response = await databases.listDocuments(
      DATABASE_ID,
      MESSAGES_COLLECTION_ID,
      queries
    );

    // Group and format conversations
    const conversationMap = new Map();

    for (const doc of response.documents) {
      const { conversationId, fileId, content, timestamp } = doc;
      
      // Extract filename from the content
      const fileName = content.replace("Chat started for ", "");

      if (!conversationMap.has(conversationId)) {
        conversationMap.set(conversationId, {
          $id: conversationId,
          fileId,
          title: fileName, // Use extracted filename as title
          createdAt: timestamp,
          updatedAt: timestamp
        });
      }
    }

    // Convert to array and sort by timestamp (newest first)
    const conversations = Array.from(conversationMap.values());
    conversations.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return conversations;
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return [];
  }
};

/**
 * Deletes a conversation and its messages
 */
export const deleteConversation = async (conversationId: string): Promise<void> => {
  try {
    // Get all messages for this conversation
    const response = await databases.listDocuments(
      DATABASE_ID,
      MESSAGES_COLLECTION_ID,
      [Query.equal("conversationId", conversationId)]
    );

    // Delete all messages
    const deletePromises = response.documents.map(doc =>
      databases.deleteDocument(DATABASE_ID, MESSAGES_COLLECTION_ID, doc.$id)
    );

    await Promise.all(deletePromises);
    console.log("Conversation deleted successfully");
  } catch (error) {
    console.error("Error deleting conversation:", error);
    throw error;
  }
};

// Add to ChatServices.ts

export const getFileContextForConversation = async (conversationId: string, fileId: string) => {
  // This function would retrieve relevant context for a conversation
  // Either from your vector store or from cached results
  
  // 1. Get conversation metadata from database
  // 2. Use that to query vector store for relevant chunks
  // 3. Return formatted context
};