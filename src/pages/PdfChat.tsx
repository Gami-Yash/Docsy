import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Send, RefreshCw, ZoomIn, ZoomOut, RotateCcw, RotateCw } from "lucide-react";
import { ChatMessage, sendChatRequest } from "@/services/AiService";
import {
  createConversation,
  addMessage,
  getConversationMessages,
  getConversations,
} from "@/services/ChatServices";
import { getFileById } from "@/lib/appwrite/databases";
import { useIsMobile } from "@/hooks/use-mobile";

// Set the worker source for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const PdfChat = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { fileId } = useParams();
  const { toast } = useToast();

  // PDF state
  const state = location.state as { pdfUrl?: string; fileName?: string };
  const [pdfUrl, setPdfUrl] = useState(state?.pdfUrl || "");
  const [fileName, setFileName] = useState(state?.fileName || "Document");
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [actualFileId, setActualFileId] = useState<string | null>(null); // Store the actual fileId

  // Chat state
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Add this state near your other state declarations
  const [isIOSDevice, setIsIOSDevice] = useState(false);

  useEffect(() => {
    const fetchPdfDetails = async () => {
      if (!pdfUrl && fileId) {
        try {
          setIsLoading(true);
          const fileDetails = await getFileById(fileId);
          if (fileDetails && fileDetails.url) {
            setPdfUrl(fileDetails.url);
            setFileName(fileDetails.$id || "Document");
            // Extract the actual fileId from the document
            setActualFileId(fileDetails.$id || fileDetails.$id);
            console.log("Document details:", {
              documentId: fileId,
              actualFileId: fileDetails.$id || fileDetails.$id,
              fileName: fileDetails.$id || fileDetails.$id
            });
          } else {
            throw new Error("File not found");
          }
        } catch (error) {
          console.error("Error fetching PDF details:", error);
          setPdfError("Failed to load the PDF file. Please try again.");
          toast({
            title: "Error",
            description: "Could not load the requested PDF file.",
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchPdfDetails();
  }, [fileId, pdfUrl, toast]);

  const getCurrentUserId = () => {
    try {
      const userSession = JSON.parse(localStorage.getItem("appwrite-session") || "{}");
      return userSession.userId || null;
    } catch (e) {
      return null;
    }
  };

  const userId = getCurrentUserId();

  const initializeChat = async () => {
    if (!fileId || !userId) {
      setInitError("Missing file ID or user session. Please try logging in again.");
      setInitializing(false);
      return;
    }

    setInitializing(true);
    setInitError(null);

    try {
      const existingConversations = await getConversations(userId, fileId);

      if (existingConversations.length > 0) {
        const conversation = existingConversations[0];
        setConversationId(conversation.$id);
        const chatMessages = await getConversationMessages(conversation.$id);
        setMessages(
          chatMessages.map((msg) => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content,
          }))
        );
      } else {
        const newConversationId = await createConversation(fileId, userId, fileName);
        setConversationId(newConversationId);
      }
      setInitError(null);
    } catch (error) {
      console.error("Error initializing chat:", error);
      setInitError("Failed to initialize chat. You can try refreshing.");
      toast({
        title: "Error",
        description: "Failed to initialize chat. Please try again.",
        variant: "destructive",
      });
    } finally {
      setInitializing(false);
    }
  };

  useEffect(() => {
    initializeChat();
  }, [fileId, userId, fileName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || chatLoading || !conversationId) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: userInput,
    };

    setMessages((prev) => [...prev, userMessage]);
    setUserInput("");
    setChatLoading(true);

    try {
      // First add the message to the conversation
      await addMessage(conversationId, fileId!, userId!, userMessage, messages.length);
      const allMessages = [...messages, userMessage];

      // For single PDF chat, pass fileId directly and specify it's NOT a folder chat
      const response = await sendChatRequest(
        allMessages, 
        fileId!, 
        userId, 
        false, // isFolderChat = false for single PDF
        undefined // no folderId for single PDF
      );

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      await addMessage(conversationId, fileId!, userId!, assistantMessage, messages.length + 1);
    } catch (error) {
      console.error("Error in chat flow:", error);
      toast({
        title: "Error",
        description: "Failed to get a response from the AI. Please try again.",
        variant: "destructive",
      });
    } finally {
      setChatLoading(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    setPdfError(null);
    toast({
      title: "PDF Loaded Successfully",
      description: `${numPages} pages loaded.`,
    });
  };

  const onDocumentLoadError = (error: Error) => {
    console.error("Error loading PDF:", error);
    setIsLoading(false);
    setPdfError("Failed to load the PDF document. Please try again.");
    toast({
      title: "Error",
      description: "Failed to load the PDF document.",
      variant: "destructive",
    });
  };

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5));
  const handleRotateClockwise = () => setRotation((prev) => (prev + 90) % 360);
  const handleRotateCounterClockwise = () => setRotation((prev) => (prev - 90 + 360) % 360);
  const handlePrevPage = () => setPageNumber((prev) => Math.max(prev - 1, 1));
  const handleNextPage = () => setPageNumber((prev) => Math.min(prev + 1, numPages || 1));

  useEffect(() => {
    const checkVectors = async () => {
      // Use actualFileId for vector checking, fallback to fileId
      const vectorFileId = actualFileId || fileId;
      if (vectorFileId) {
        console.log("Checking vectors for fileId:", vectorFileId);
        const hasVectors = await checkVectorsForFile(vectorFileId);
        console.log(`PDF file ${vectorFileId} has vectors: ${hasVectors}`);
        
        if (!hasVectors) {
          console.warn("No vector embeddings found for this PDF. AI responses will be limited.");
          toast({
            title: "Vector Embeddings Not Found",
            description: "No embeddings found for this PDF. AI responses may be limited.",
            variant: "destructive",
          });
        }
      }
    };
    
    // Only check vectors after we have the actualFileId
    if (actualFileId) {
      checkVectors();
    }
  }, [actualFileId, fileId]);

  // Add this function before the component or at the end of the file
  async function getActualFileId(fileId: string): Promise<string | null> {
    try {
      const fileDetails = await getFileById(fileId);
      
      // First try with fileID property
      if (fileDetails?.fileID) {
        return fileDetails.fileID;
      }
      
      // Then try with bucketFileId if it exists
      // if (fileDetails?.bucketFileId) {
      //   return fileDetails.bucketFileId;
      // }
      
      // Return original document ID as fallback
      console.log("Using original fileId as fallback:", fileId);
      return fileId;
    } catch (error) {
      console.error("Error getting actual fileId:", error);
      
      // On error, try to query the vector store directly to see what IDs exist
      try {
        const { pinecone, PINECONE_INDEX_NAME, createZeroVector } = await import("@/services/VectorService");
        const index = pinecone.Index(PINECONE_INDEX_NAME);
        const zeroVector = await createZeroVector();
        
        // Get user ID
        const currentUser = JSON.parse(localStorage.getItem('appwrite-session') || '{}');
        const userId = currentUser?.userId;
        
        if (userId) {
          // Get vectors for this user
          const results = await index.query({
            vector: zeroVector,
            filter: { userId: { $eq: userId } },
            topK: 5,
            includeMetadata: true
          });
          
          if (results.matches.length > 0) {
            const availableIds = results.matches.map(m => m.metadata?.fileId).filter(Boolean);
            console.log("Available file IDs in vector store:", availableIds);
            
            // Use the most recently added vector's fileId as fallback and ensure it's a string
            const firstId = availableIds[0];
            return (firstId !== undefined && firstId !== null) ? String(firstId) : fileId;
          }
        }
      } catch (e) {
        console.error("Error querying vector store for IDs:", e);
      }
      
      return fileId; // Return original ID as fallback
    }
  }

  // Add this function to scroll to bottom whenever messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  // Add this useEffect to scroll to bottom when messages change or chat is loading
  useEffect(() => {
    scrollToBottom();
  }, [messages, chatLoading]);

  // Add this effect to detect iOS
  useEffect(() => {
    const checkIOS = () => {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      setIsIOSDevice(isIOS);
      console.log("Is iOS device:", isIOS);
    };
    
    checkIOS();
  }, []);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-white p-4 md:p-8">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.6))] pointer-events-none"></div>

      <div className="relative max-w-7xl mx-auto z-10">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-800">{fileName}</h1>
          {actualFileId && (
            <p className="ml-4 text-xs text-gray-500">Vector ID: {actualFileId}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* PDF Viewer */}
          <div className="bg-gray-100 p-4 rounded-lg shadow-md max-h-[80vh] overflow-y-auto">
            {pdfError ? (
              <div className="flex flex-col items-center justify-center h-full">
                <p className="text-red-500 mb-4">{pdfError}</p>
                <Button onClick={() => navigate("/dashboard")}>Go Back</Button>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-gray-600">Page {pageNumber} of {numPages || "Loading..."}</p>
                  {!isIOSDevice && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" onClick={handleZoomOut}>
                        <ZoomOut className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={handleZoomIn}>
                        <ZoomIn className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={handleRotateCounterClockwise}>
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={handleRotateClockwise}>
                        <RotateCw className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
                
                {isIOSDevice ? (
                  // iOS-specific viewer
                  <div className="w-full bg-white rounded shadow overflow-hidden">
                    <iframe 
                      src={pdfUrl} 
                      className="w-full h-[70vh]" 
                      title={fileName}
                    />
                  </div>
                ) : (
                  // Regular viewer for other platforms
                  <Document
                    file={pdfUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={<div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>}
                  >
                    <Page
                      pageNumber={pageNumber}
                      scale={scale}
                      rotate={rotation}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      width={isMobile ? window.innerWidth - 40 : undefined}
                    />
                  </Document>
                )}
                
                {!isIOSDevice && (
                  <div className="flex justify-between mt-4">
                    <Button variant="outline" disabled={pageNumber <= 1} onClick={handlePrevPage}>
                      Previous
                    </Button>
                    <Button variant="outline" disabled={pageNumber >= (numPages || 1)} onClick={handleNextPage}>
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Chat Panel */}
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-gray-800">Chat with AI</CardTitle>
              <CardDescription>Ask questions or chat with the assistant</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden pb-0">
              <div 
                className={`overflow-y-auto p-4 bg-gray-50 rounded-md ${
                  isMobile ? "h-[400px]" : "h-[calc(80vh-200px)]"
                }`}
              >
                {initializing ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Loading conversation...</span>
                  </div>
                ) : initError ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <p className="text-red-500 mb-4">{initError}</p>
                    <Button onClick={initializeChat} className="flex items-center gap-2" variant="outline"/>
                      <RefreshCw className="h-4 w-4" /> Retry
                    </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <p>No messages yet. Start by sending a message below.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg ${
                          msg.role === "user" ? "bg-purple-100 ml-12" : "bg-gray-100 mr-12"
                        }`}
                      >
                        <p className="text-sm font-semibold mb-1">{msg.role === "user" ? "You" : "AI Assistant"}</p>
                        <div className="text-gray-700 whitespace-pre-wrap">{msg.content}</div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="p-3 rounded-lg bg-gray-100 mr-12 flex items-center">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span className="text-sm">AI is thinking...</span>
                      </div>
                    )}
                    {/* Add this div as a reference for scrolling */}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="border-t mt-4 p-4">
              <form onSubmit={handleSubmit} className="flex gap-2 w-full">
                <Textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Type your message here..."
                  className="flex-1 resize-none"
                  rows={2}
                  disabled={initializing || !conversationId || !!initError}
                />
                <Button
                  type="submit"
                  disabled={!userInput.trim() || chatLoading || initializing || !conversationId || !!initError}
                  className="bg-purple-600 hover:bg-purple-700 self-end"
                >
                  {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </CardFooter>
          </Card>
        </div>

        <Separator className="my-8" />
        <footer className="text-center text-xs text-gray-500">
          <p>© 2025 PDF Chat App. All rights reserved.</p>
        </footer>
      </div>
    </div>
    
  );
};

export default PdfChat;

// Updated checkVectorsForFile function - now works with the correct fileId
async function checkVectorsForFile(fileId: string): Promise<boolean> {
  try {
    const { pinecone, PINECONE_INDEX_NAME, createZeroVector } = await import("@/services/VectorService");
    
    const index = pinecone.Index(PINECONE_INDEX_NAME);
    const zeroVector = await createZeroVector();
    
    console.log(`Checking for vectors with fileId: ${fileId}`);
    
    // Get user ID for filtering
    const currentUser = JSON.parse(localStorage.getItem('appwrite-session') || '{}');
    const userId = currentUser?.userId;
    
    if (!userId) {
      console.error("User ID not found in session");
      return false;
    }
    
    // Try exact match first with user filter
    let results = await index.query({
      vector: zeroVector,
      filter: { 
        $and: [
          { fileId: { $eq: fileId } },
          { userId: { $eq: userId } }
        ]
      },
      topK: 1,
      includeMetadata: true
    });
    
    console.log(`Found ${results.matches.length} exact matches for fileId: ${fileId} with userId: ${userId}`);
    
    // If no exact matches, try querying without userId filter as fallback
    if (results.matches.length === 0) {
      results = await index.query({
        vector: zeroVector,
        filter: { fileId: { $eq: fileId } },
        topK: 1,
        includeMetadata: true
      });
      
      console.log(`Found ${results.matches.length} exact matches for fileId without userId filter`);
    }
    
    // If still no matches, get a list of all fileIds associated with user
    if (results.matches.length === 0) {
      console.log("No exact matches found, checking all user's vectors...");
      
      const userResults = await index.query({
        vector: zeroVector,
        filter: { userId: { $eq: userId } },
        topK: 20,
        includeMetadata: true
      });
      
      const userFileIds = [...new Set(userResults.matches
        .map(m => m.metadata?.fileId)
        .filter(Boolean))];
        
      console.log("File IDs available for this user:", userFileIds);
      
      // If we find fileIds for the user, try the closest match
      if (userFileIds.length > 0) {
        return true; // At least we have some vectors for this user
      }
    }
    
    const hasVectors = results.matches.length > 0;
    console.log(`Vector check result for ${fileId}: ${hasVectors}`);
    
    return hasVectors;
    
  } catch (error) {
    console.error("Error checking vectors for file:", error);
    return false;
  }
}