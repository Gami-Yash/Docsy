import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Send, RefreshCw } from "lucide-react";
import { ChatMessage, sendChatRequest } from "@/services/AiService";
import { getFilesByFolderId } from "@/lib/appwrite/databases";
import { useIsMobile } from "@/hooks/use-mobile";
import { createConversation, addMessage, getConversationMessages, getConversations } from "@/services/ChatServices";

const FolderChat = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { folderId } = useParams();
  const { toast } = useToast();
  const state = location.state as { folderName?: string };
  const folderName = state?.folderName || "Folder";

  // Files in folder
  const [files, setFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Chat state
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const userId = JSON.parse(localStorage.getItem('appwrite-session') || '{}')?.userId;

  // Fetch files in the folder
  useEffect(() => {
    const fetchFiles = async () => {
      if (!folderId) {
        setInitError("Missing folder ID");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await getFilesByFolderId(folderId);
        setFiles(response.documents || []);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching files:", error);
        setInitError("Failed to fetch files in this folder");
        setIsLoading(false);
      }
    };

    fetchFiles();
  }, [folderId]);

  // Initialize chat
  const initializeChat = async () => {
    if (!folderId || !userId) {
      setInitError("Missing folder ID or user session. Please try logging in again.");
      setInitializing(false);
      return;
    }

    if (files.length === 0) {
      setInitError("This folder does not contain any files to chat with.");
      setInitializing(false);
      return;
    }

    setInitializing(true);
    setInitError(null);

    try {
      // Use folder ID as the conversation ID prefix
      const existingConversations = await getConversations(userId, `folder_${folderId}`);

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
        const newConversationId = await createConversation(`folder_${folderId}`, userId, folderName);
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
    if (files.length > 0) {
      initializeChat();
    }
  }, [files, userId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, chatLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || chatLoading || !conversationId || files.length === 0) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: userInput,
    };

    setMessages((prev) => [...prev, userMessage]);
    setUserInput("");
    setChatLoading(true);

    try {
      // Get all actual fileIds from the folder's files
      const fileIds = files.map(file => file.fileID || file.$id);
      console.log("Sending chat with files:", fileIds);
      
      // For storing in messages - use folder ID
      await addMessage(conversationId, `folder_${folderId}`, userId, userMessage, messages.length);
      const allMessages = [...messages, userMessage];
      
      // Send request with ALL file IDs in the folder and pass folder context
      const response = await sendChatRequest(
        allMessages, 
        fileIds, 
        userId, 
        true, 
        folderId
      );
      
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response,
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
      
      // Also store the assistant's response
      await addMessage(conversationId, `folder_${folderId}`, userId, assistantMessage, allMessages.length);
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to get a response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-white p-4 md:p-8">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.6))] pointer-events-none"></div>

      <div className="relative max-w-7xl mx-auto z-10">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-800">Folder: {folderName}</h1>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left sidebar for files */}
          <div>
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Files in This Folder</CardTitle>
                <CardDescription>
                  {files.length} {files.length === 1 ? 'file' : 'files'} available for chat
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Loading files...</span>
                  </div>
                ) : files.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    <p>No files found in this folder.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {files.map((file) => (
                      <div key={file.$id} className="flex items-center p-2 rounded-md bg-gray-50">
                        <span className="text-sm font-medium">{file.fileName}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Chat area */}
          <div className="md:col-span-2">
            <Card className="h-[calc(100vh-12rem)]">
              <CardHeader>
                <CardTitle>Chat with Folder</CardTitle>
                <CardDescription>
                  Ask questions about any document in this folder
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow overflow-auto">
                {initializing ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Loading conversation...</span>
                  </div>
                ) : initError ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <p className="text-red-500 mb-4">{initError}</p>
                    <Button onClick={initializeChat} className="flex items-center gap-2" variant="outline">
                      <RefreshCw className="h-4 w-4" /> Retry
                    </Button>
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
                          msg.role === "user"
                            ? "bg-purple-100 ml-12"
                            : msg.role === "assistant"
                            ? "bg-gray-100 mr-12"
                            : "bg-blue-50 text-sm"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="p-3 rounded-lg bg-gray-100 mr-12 flex items-center">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <p>Thinking...</p>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t p-4">
                <form onSubmit={handleSubmit} className="flex gap-2 w-full">
                  <Textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Type your message here..."
                    className="flex-1 resize-none"
                    rows={2}
                    disabled={initializing || !conversationId || !!initError || files.length === 0}
                  />
                  <Button
                    type="submit"
                    disabled={!userInput.trim() || chatLoading || initializing || !conversationId || !!initError || files.length === 0}
                    className="bg-purple-600 hover:bg-purple-700 self-end"
                  >
                    {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
              </CardFooter>
            </Card>
          </div>
        </div>

        <Separator className="my-8" />
        <footer className="text-center text-xs text-gray-500">
          <p>© 2025 PDF Chat App. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
};

export default FolderChat;