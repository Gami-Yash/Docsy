export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequestBody {
  messages: ChatMessage[];
}

export interface ChatResponse {
  choices: {
    message: ChatMessage;
  }[];
}

// Import for vector search
import { queryEmbeddings, normalizeFileId } from "@/services/VectorService";
import { FileDocument } from '@/lib/types';



const AZURE_OPENAI_KEY = import.meta.env.VITE_AZURE_OPENAI_KEY_AI;
const AZURE_OPENAI_ENDPOINT = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT_AI;


export async function sendChatRequest(
  messages: ChatMessage[], 
  fileId?: string | string[],
  userId?: string,
  isFolderChat: boolean = false,
  folderId?: string
): Promise<string> {
  try {
    console.log(`sendChatRequest called - isFolderChat: ${isFolderChat}, fileId: ${fileId}, folderId: ${folderId}`);
    
    // Get the last user message to use for searching relevant content
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    
    let relevantContext = '';
    let vectorError = false;
    let searchedFiles = 0;
    let successfulFiles = 0;
    
    // If we have fileId(s) and a user message, get relevant context
    if (fileId && lastUserMessage && userId) {
      try {
        // Convert fileId to array if it's a string
        const fileIds = Array.isArray(fileId) ? fileId : [fileId];
        console.log(`Processing ${fileIds.length} files for context search`);
        
        // Create array to hold all relevant chunks
        let allRelevantChunks: any[] = [];
        
        // Process each file ID and collect relevant chunks
        for (const id of fileIds) {
          try {
            searchedFiles++;
            console.log(`Searching for relevant content with query: "${lastUserMessage.content}" in file: ${id}`);
            
            // Call queryEmbeddings with the correct parameters
            let relevantChunks = await queryEmbeddings(
              lastUserMessage.content, 
              id, 
              3, // Get more chunks for better context
              userId,
              isFolderChat, // Pass the folder chat flag
              isFolderChat ? folderId : undefined // Only pass folderId for folder chats
            );
            
            if (relevantChunks && relevantChunks.length > 0) {
              console.log(`Found ${relevantChunks.length} relevant chunks for file ${id}`);
              allRelevantChunks.push(...relevantChunks);
              successfulFiles++;
            } else {
              console.log(`No relevant chunks found for file ${id}`);
            }
          } catch (fileError) {
            console.error(`Error processing file ${id}:`, fileError);
          }
        }
        
        // Format context from all relevant chunks
        if (allRelevantChunks.length > 0) {
          relevantContext = allRelevantChunks
            .map((chunk, index) => {
              const content = chunk.text || chunk.content || chunk.chunk || 'No content';
              return `[Context ${index + 1}]: ${content}`;
            })
            .join('\n\n');
          
          console.log(`Successfully found context from ${successfulFiles}/${searchedFiles} files`);
        } else {
          console.log("No relevant context found across all files");
          vectorError = true;
        }
      } catch (error) {
        console.error("Error during vector search:", error);
        vectorError = true;
      }
    }
    
    // Add a system message with context
    const messagesWithContext = [...messages];
    if (relevantContext) {
      const systemPrompt = isFolderChat 
        ? `You are an assistant helping with multiple PDF documents in a folder. Use the following information from the documents to answer questions:

${relevantContext}

Answer based on this document content. Be specific and reference the information when possible.`
        : `You are an assistant helping with a PDF document. Use the following information from the document to answer questions:

${relevantContext}

Answer based on this document content. Be specific and reference the information when possible.`;
        
      messagesWithContext.unshift({
        role: 'system',
        content: systemPrompt
      });
    } else {
      // Default system message when no context is found
      const systemMessage = isFolderChat 
        ? `You are an assistant helping with PDF documents in a folder. I wasn't able to find specific information from the documents for this question. This could be because the information isn't present or there are processing issues.`
        : `You are an assistant helping with a PDF document. I wasn't able to find specific information from the document for this question. This could be because the information isn't present or there are processing issues.`;
      
      messagesWithContext.unshift({
        role: 'system',
        content: systemMessage
      });
    }

    // Make the API call to Azure OpenAI
    const response = await fetch(AZURE_OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_KEY,
      },
      body: JSON.stringify({
        messages: messagesWithContext,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "I apologize, but I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("Error in sendChatRequest:", error);
    throw error;
  }
}