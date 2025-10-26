import { OpenAI } from 'openai';

// Environment variables for Azure OpenAI
const AZURE_OPENAI_KEY = import.meta.env.VITE_AZURE_OPENAI_KEY;
const AZURE_OPENAI_ENDPOINT = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_DEPLOYMENT = import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT;
const AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT = import.meta.env.VITE_AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT;
const AZURE_OPENAI_API_VERSION = import.meta.env.VITE_AZURE_OPENAI_API_VERSION || '2024-02-15-preview';

// Initialize Azure OpenAI client
export const azureOpenAI = new OpenAI({
  apiKey: AZURE_OPENAI_KEY,
  baseURL: `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}`,
  defaultQuery: { 'api-version': AZURE_OPENAI_API_VERSION },
  defaultHeaders: {
    'api-key': AZURE_OPENAI_KEY,
  },
});

// Initialize Azure OpenAI client specifically for embeddings
export const azureOpenAIEmbeddings = new OpenAI({
  apiKey: AZURE_OPENAI_KEY,
  baseURL: `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT}`,
  defaultQuery: { 'api-version': AZURE_OPENAI_API_VERSION },
  defaultHeaders: {
    'api-key': AZURE_OPENAI_KEY,
  },
});

// Generate embeddings using Azure OpenAI
export async function getEmbeddings(text: string): Promise<number[]> {
  try {
    const response = await azureOpenAIEmbeddings.embeddings.create({
      input: text,
      model: AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT, // This is actually ignored with Azure, as the model is specified in the URL
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embeddings with Azure OpenAI:', error);
    throw error;
  }
}

// Generate chat completions using Azure OpenAI
export async function generateChatCompletion(messages: any[]): Promise<string> {
  try {
    const response = await azureOpenAI.chat.completions.create({
      messages,
      model: AZURE_OPENAI_DEPLOYMENT, // This is actually ignored with Azure, as the model is specified in the URL
    });
    
    return response.choices[0].message.content || '';
  } catch (error) {
    console.error('Error generating chat completion with Azure OpenAI:', error);
    throw error;
  }
}