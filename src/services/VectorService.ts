import { Pinecone } from '@pinecone-database/pinecone';
import { extractTextFromPDF } from './PdfProcessingService';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

// Add this polyfill at the top of your file to handle the 'global is not defined' error
if (typeof window !== 'undefined' && typeof window.global === 'undefined') {
  window.global = window;
}

// Environment variables
export const PINECONE_INDEX_NAME = import.meta.env.VITE_PINECONE_INDEX || 'pdf-chatter';
export const PINECONE_ENVIRONMENT = import.meta.env.VITE_PINECONE_ENVIRONMENT || 'us-east-1';
export const PINECONE_API_KEY = import.meta.env.VITE_PINECONE_API_KEY;

// IMPORTANT: This should match your Pinecone index dimension
export const EMBEDDING_DIMENSION = 1536; 

// Initialize Pinecone
export const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY,
});

// Create a zero vector utility function
export const createZeroVector = async () => {
  return new Array(EMBEDDING_DIMENSION).fill(0);
};

// FIXED: Use the original fileId as-is, don't normalize during storage
export function normalizeFileId(fileId: string): string {
  // Don't normalize - use the full fileId as provided
  if (!fileId) return '';
  return fileId;
}

// Fixed getEmbedding function
export const getEmbedding = async (text: string) => {
  try {
    const endpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
    const deployment = import.meta.env.VITE_AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT;
    const apiVersion = import.meta.env.VITE_AZURE_OPENAI_API_VERSION || '2023-05-15';
    
    const embeddingsUrl = `${endpoint}/openai/deployments/${deployment}/embeddings?api-version=${apiVersion}`;
    const apiKey = import.meta.env.VITE_AZURE_OPENAI_KEY;
    
    console.log('Requesting embeddings from:', embeddingsUrl);
    
    const response = await fetch(embeddingsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        input: text,
        model: "text-embedding-ada-002",
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Error getting embedding:', {
        status: response.status,
        statusText: response.statusText,
        body: errorBody
      });
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const embedding = result.data[0].embedding;
    
    console.log(`Embedding dimension: ${embedding.length}, expected: ${EMBEDDING_DIMENSION}`);
    
    if (embedding.length !== EMBEDDING_DIMENSION) {
      throw new Error(`Embedding dimension mismatch: got ${embedding.length}, expected ${EMBEDDING_DIMENSION}`);
    }
    
    return embedding;
  } catch (error) {
    console.error('Error in getEmbedding:', error);
    throw error;
  }
};

// FIXED: Store embeddings using the exact fileId without normalization
export async function storeEmbeddings(chunks: { 
  text: string; 
  metadata: { 
    fileId: string; 
    page: number;
    userId?: string;
    folderId?: string | null;
  } 
}[], documentId?: string): Promise<void> {
  try {
    console.log(`Storing ${chunks.length} chunks in Pinecone`);
    
    const index = pinecone.Index(PINECONE_INDEX_NAME);
    const batchSize = 10;
    const batches = [];
    
    // Use documentId if provided, otherwise use the fileId from chunks
    const id = documentId || chunks[0].metadata.fileId;
    console.log(`Using ID for vector storage: ${id}`);
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      batches.push(batch);
    }
    
    for (const [batchIndex, batch] of batches.entries()) {
      console.log(`Processing batch ${batchIndex + 1}/${batches.length}`);
      
      // When storing vectors, include more metadata
      const vectors = await Promise.all(
        batch.map(async (chunk, idx) => {
          const embedding = await getEmbedding(chunk.text);
          const vectorId = `${id}-${chunk.metadata.page}-${idx}`;
          
          // Process metadata to ensure no null values for Pinecone
          const metadata: {
            fileId: string;
            page: number;
            text: string;
            userId: string;
            folderId?: string;
          } = {
            fileId: id,
            page: chunk.metadata.page,
            text: chunk.text.slice(0, 1000),
            userId: chunk.metadata.userId || ""  // Use empty string instead of null
          };
          
          // Only add folderId if it's not null or undefined
          if (chunk.metadata.folderId) {
            metadata.folderId = chunk.metadata.folderId;
          }
          
          return {
            id: vectorId,
            values: embedding,
            metadata: metadata
          };
        })
      );
      
      console.log("Upserting vectors with ID:", id);
      console.log("Vector sample:", vectors[0] ? { 
        id: vectors[0].id, 
        dimension: vectors[0].values.length,
        metadata: vectors[0].metadata 
      } : "No vectors");
      
      await index.upsert(vectors);
    }
    
    console.log('Successfully stored all embeddings in Pinecone');
  } catch (error) {
    console.error('Error storing embeddings:', error);
    throw error;
  }
}

export async function queryEmbeddings(
  query: string, 
  fileId: string | null, 
  limit: number = 3,
  userId: string,
  isFolderChat: boolean = false,
  folderId?: string
): Promise<{ text: string; score?: number }[]> {
  try {
    // Generate embedding for the query
    const queryEmbedding = await getEmbedding(query);

    // Build the filter based on context
    let filter: Record<string, any> = {};
    
    if (isFolderChat && folderId) {
      // If it's a folder chat, filter by folderId
      filter = { folderId: { $eq: folderId } };
      console.log(`Folder chat: filtering by folder ID ${folderId}`);
    } else if (fileId) {
      // If it's a single file chat, filter by fileId
      filter = { fileId: { $eq: fileId } };
      console.log(`File chat: filtering by file ID ${fileId}`);
    }
    
    // Always filter by userId for access control
    if (filter.folderId || filter.fileId) {
      // If we already have a filter, add userId to it
      filter.$and = [{ userId: { $eq: userId } }];
    } else {
      // If we don't have a filter yet, set it directly
      filter = { userId: { $eq: userId } };
    }
    
    console.log("Using filter:", JSON.stringify(filter));
    
    // Search for similar vectors with the filter
    const index = pinecone.Index(PINECONE_INDEX_NAME);
    const results = await index.query({
      vector: queryEmbedding,
      topK: limit,
      filter: filter,
      includeMetadata: true,
      includeValues: false,
    });
    
    // Map results to the expected format with proper type conversion
    return results.matches.map((match) => {
      const metadataText = match.metadata?.text;
      // Convert metadata text to string, handling all possible types
      const text = typeof metadataText === 'string' 
        ? metadataText 
        : Array.isArray(metadataText)
        ? metadataText.join(' ')
        : String(metadataText || '');
      
      return {
        text,
        score: match.score,
      };
    });
  } catch (error) {
    console.error("Error querying embeddings:", error);
    return [];
  }
}

// Find the queryEmbeddings function and update it to handle single PDF properly:
// Remove this duplicate function - it's already defined above

export async function processPdfForVectorDB(fileUrl: string, fileId: string, documentId: string, userId: string, folderId?: string) {
  try {
    console.log(`Processing PDF for vector database: ${fileUrl} with ID: ${documentId}`);
    
    // Extract text from PDF
    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();
    const pageTexts = await extractTextFromPDF(arrayBuffer);
    
    // Split text into chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200
    });
    
    let allChunks = [];
    
    for (let pageIdx = 0; pageIdx < pageTexts.length; pageIdx++) {
      const chunks = await textSplitter.splitText(pageTexts[pageIdx]);
      
      const chunkObjects = chunks.map((chunk, chunkIdx) => {
        // Create base metadata
        const metadata: any = {
          fileId: documentId,
          page: pageIdx + 1,
          chunk: chunkIdx,
          userId: userId // Add owner information
        };
        
        // Only add folderId if it has a value
        if (folderId && folderId.trim() !== "") {
          metadata.folderId = folderId;
        }
        
        return {
          text: chunk,
          metadata: metadata
        };
      });
      
      allChunks = [...allChunks, ...chunkObjects];
    }
    
    // Store the chunks as embeddings
    await storeEmbeddings(allChunks, documentId);
    
    console.log('Successfully processed and stored PDF embeddings');
  } catch (error) {
    console.error("Error processing PDF:", error);
    throw error;
  }
}