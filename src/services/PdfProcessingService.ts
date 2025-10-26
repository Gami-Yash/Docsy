import * as pdfjs from 'pdfjs-dist';
import { storeEmbeddings } from './VectorService';

// Modified worker initialization for better iOS compatibility
function initPdfWorker() {
  const workerUrl = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  
  console.log("PDF.js worker initialized with URL:", workerUrl);
}

// Initialize the worker
initPdfWorker();

// Function to extract text from PDF
export async function extractTextFromPDF(pdfData: ArrayBuffer): Promise<string[]> {
  try {
    // Make sure worker is initialized
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      initPdfWorker();
    }
    
    const loadingTask = pdfjs.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const pageTexts: string[] = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const strings = textContent.items
        .filter((item: any) => 'str' in item)
        .map((item: any) => item.str);
      
      const pageText = strings.join(' ');
      pageTexts.push(pageText);
    }

    return pageTexts;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

// Function to split text into smaller chunks for embedding
export function splitTextIntoChunks(text: string, maxChunkSize: number = 1000): string[] {
  // Simple split by approximate length
  const words = text.split(' ');
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  
  for (const word of words) {
    if (currentChunk.join(' ').length + word.length + 1 > maxChunkSize) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [word];
    } else {
      currentChunk.push(word);
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }
  
  return chunks;
}

// Process a PDF file and store embeddings
export async function processPdfForEmbeddings(fileId: string, pdfData: ArrayBuffer): Promise<void> {
  try {
    // Extract text from all pages
    const pageTexts = await extractTextFromPDF(pdfData);
    const fullText = pageTexts.join(' ');
    
    // Split into smaller chunks for embedding
    const textChunks = splitTextIntoChunks(fullText);
    
    // Prepare chunks with indices
    const indexedChunks = textChunks.map((text, index) => ({
      text,
      metadata: {
        fileId,
        page: index + 1
      }
    }));
    
    // Store embeddings in vector database
    await storeEmbeddings(indexedChunks);
    
    return;
  } catch (error) {
    console.error('Error processing PDF for embeddings:', error);
    throw error;
  }
}