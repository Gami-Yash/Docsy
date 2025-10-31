import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Send, RefreshCw } from "lucide-react";
import { ChatMessage, sendChatRequest } from "@/services/AiService";
import { createConversation, addMessage, getConversationMessages, getConversations } from "@/services/ChatServices";
import { getFileById } from "@/lib/appwrite/databases";
import { useIsMobile } from "@/hooks/use-mobile";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

const PdfChat = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { fileId } = useParams();
  const { toast } = useToast();

  const { pdfUrl: statePdfUrl, fileName: stateFileName } = location.state || {};

  const [pdfUrl, setPdfUrl] = useState(statePdfUrl || "");
  const [fileName, setFileName] = useState(stateFileName || "PDF Document");
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const getCurrentUserId = () => {
    try {
      const session = JSON.parse(localStorage.getItem("appwrite-session") || "{}");
      return session.userId || null;
    } catch {
      return null;
    }
  };
  const userId = getCurrentUserId();

  useEffect(() => {
    const fetchPdf = async () => {
      if (!pdfUrl && fileId) {
        try {
          const file = await getFileById(fileId);
          if (file && file.url) {
            setPdfUrl(file.url);
            setFileName(file.fileName || "PDF Document");
          } else {
            throw new Error("File not found");
          }
        } catch {
          setPdfError("Failed to load PDF");
        } finally {
          setIsLoading(false);
        }
      }
    };
    fetchPdf();
  }, [fileId, pdfUrl]);

  const initializeChat = async () => {
    if (!fileId || !userId) {
      setInitError("Missing file ID or user session.");
      setInitializing(false);
      return;
    }
    try {
      const existing = await getConversations(userId, fileId);
      if (existing.length > 0) {
        const convo = existing[0];
        setConversationId(convo.$id);
        const msgs = await getConversationMessages(convo.$id);
        setMessages(msgs.map((m) => ({ role: m.role, content: m.content })));
      } else {
        const newId = await createConversation(fileId, userId, fileName);
        setConversationId(newId);
      }
    } catch {
      setInitError("Failed to initialize chat.");
    } finally {
      setInitializing(false);
    }
  };

  useEffect(() => {
    initializeChat();
  }, [fileId, userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || !conversationId) return;
    const userMsg: ChatMessage = { role: "user", content: userInput };
    setMessages((p) => [...p, userMsg]);
    setUserInput("");
    setChatLoading(true);
    try {
      await addMessage(conversationId, fileId!, userId!, userMsg, messages.length);
      const allMsgs = [...messages, userMsg];
      const response = await sendChatRequest(allMsgs, fileId!, userId, false, undefined);
      const aiMsg: ChatMessage = { role: "assistant", content: response };
      setMessages((p) => [...p, aiMsg]);
      await addMessage(conversationId, fileId!, userId!, aiMsg, messages.length + 1);
    } catch {
      toast({ title: "Error", description: "Failed to get AI response", variant: "destructive" });
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center p-4 border-b bg-white">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="mr-2">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold text-gray-800">{fileName}</h1>
      </div>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        {/* PDF Viewer */}
        <div className="flex flex-col overflow-auto border-r bg-white">
          <div className="p-4 flex-1 flex flex-col items-center overflow-y-auto">
            {isLoading && <Loader2 className="animate-spin h-8 w-8 text-primary" />}
            {pdfError && <p className="text-red-500">{pdfError}</p>}
            {pdfUrl && (
              <Document
                file={pdfUrl}
                onLoadSuccess={({ numPages }) => {
                  setNumPages(numPages);
                  setIsLoading(false);
                }}
                onLoadError={(e) => {
                  console.error(e);
                  setPdfError("Error loading PDF");
                }}
              >
                <Page
                  pageNumber={pageNumber}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  width={isMobile ? window.innerWidth - 40 : undefined}
                />
              </Document>
            )}
          </div>
          {numPages && (
            <div className="flex justify-between items-center p-4 border-t bg-gray-50">
              <Button variant="outline" disabled={pageNumber <= 1} onClick={() => setPageNumber((p) => p - 1)}>
                Previous
              </Button>
              <p className="text-sm text-gray-600">
                Page {pageNumber} of {numPages}
              </p>
              <Button variant="outline" disabled={pageNumber >= numPages} onClick={() => setPageNumber((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>

        {/* Chat Section */}
        <div className="flex flex-col h-full overflow-hidden bg-white">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-800">Chat with AI</h2>
            <p className="text-sm text-gray-500">Ask questions or discuss your document</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {initializing ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <Loader2 className="animate-spin h-6 w-6 mr-2" />
                Loading conversation...
              </div>
            ) : initError ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <p className="text-red-500 mb-4">{initError}</p>
                <Button onClick={initializeChat} variant="outline" className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" /> Retry
                </Button>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                No messages yet. Start chatting below.
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg max-w-[85%] ${
                      msg.role === "user" ? "bg-green-100 ml-auto" : "bg-gray-100"
                    }`}
                  >
                    <p className="text-xs font-semibold mb-1">{msg.role === "user" ? "You" : "AI Assistant"}</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
                {chatLoading && (
                  <div className="p-3 rounded-lg bg-gray-100 max-w-[70%]">
                    <p className="text-sm text-gray-500">AI is thinking...</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-4 border-t flex gap-2 bg-white">
            <Textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Type your message... (Enter to send)"
              rows={2}
              className="flex-1 resize-none"
            />
            <Button
              type="submit"
              disabled={!userInput.trim() || chatLoading || initializing}
              className="bg-green-600 hover:bg-green-700"
            >
              {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PdfChat;
