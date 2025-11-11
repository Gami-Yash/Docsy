import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Send, RefreshCw } from "lucide-react";
import { ChatMessage, sendChatRequest } from "@/services/AiService";
import { getFilesByFolderId } from "@/lib/appwrite/databases";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  createConversation,
  addMessage,
  getConversationMessages,
  getConversations,
} from "@/services/ChatServices";

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
  const userId = JSON.parse(localStorage.getItem("appwrite-session") || "{}")
    ?.userId;

  // Fetch files in folder
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
      setInitError(
        "Missing folder ID or user session. Please try logging in again."
      );
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
      const existingConversations = await getConversations(
        userId,
        `folder_${folderId}`
      );

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
        const newConversationId = await createConversation(
          `folder_${folderId}`,
          userId,
          folderName
        );
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
    if (!userInput.trim() || chatLoading || !conversationId || files.length === 0)
      return;

    const userMessage: ChatMessage = {
      role: "user",
      content: userInput,
    };

    setMessages((prev) => [...prev, userMessage]);
    setUserInput("");
    setChatLoading(true);

    try {
      const fileIds = files.map((file) => file.fileID || file.$id);
      await addMessage(conversationId, folderId!, userId!, userMessage, messages.length);
      const allMessages = [...messages, userMessage];

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
      await addMessage(conversationId, folderId!, userId!, assistantMessage, messages.length + 1);
    } catch (error) {
      console.error("Error in folder chat:", error);
      toast({
        title: "Error",
        description: "Failed to get a response from the AI. Please try again.",
        variant: "destructive",
      });
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!userInput.trim() || chatLoading || !conversationId || files.length === 0) return;
      handleSubmit(e as any);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gray-50">
      <div className="relative max-w-7xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="mr-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-800">
            Folder: {folderName}
          </h1>
        </div>

        {/* Main Content */}
        <div className="h-[calc(100vh-200px)] grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Sidebar */}
          <div className="md:col-span-1">
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-4 flex-shrink-0">
                <CardTitle className="text-lg">Files in This Folder</CardTitle>
                <CardDescription>
                  {files.length} {files.length === 1 ? "file" : "files"} available for chat
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto p-4">
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
                      <div
                        key={file.$id}
                        className="flex items-center p-3 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="p-2 bg-red-50 rounded-lg mr-3 flex-shrink-0">
                          <svg
                            className="h-4 w-4 text-red-500"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900 truncate block">
                            {file.fileName}
                          </span>
                          <span className="text-xs text-gray-500">
                            PDF Document
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Chat Area */}
          <div className="md:col-span-2">
            <Card className="h-full flex flex-col">
              <CardHeader className="flex-shrink-0 pb-4">
                <CardTitle className="text-lg">Chat with Folder</CardTitle>
                <CardDescription>
                  Ask questions about any document in this folder
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col p-0">
                {/* Scrollable messages */}
                <div className="flex-1 overflow-y-auto px-4 pb-4 border-t bg-white">
                  <div className="p-4 space-y-4">
                    {initializing ? (
                      <div className="flex items-center justify-center h-32 text-gray-500">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        <span>Loading conversation...</span>
                      </div>
                    ) : initError ? (
                      <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                        <p className="text-red-500 mb-4 text-center">
                          {initError}
                        </p>
                        <Button
                          onClick={initializeChat}
                          className="flex items-center gap-2"
                          variant="outline"
                        >
                          <RefreshCw className="h-4 w-4" /> Retry
                        </Button>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                        <div className="text-center">
                          <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4"></div>
                          <p className="text-sm font-medium mb-2">
                            No messages yet
                          </p>
                          <p className="text-xs">
                            Start by sending a message below
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {messages.map((msg, index) => (
                          <div
                            key={index}
                            className={`flex ${
                              msg.role === "user"
                                ? "justify-end"
                                : "justify-start"
                            }`}
                          >
                            <div
                              className={`max-w-[85%] p-3 rounded-lg ${
                                msg.role === "user"
                                  ? "bg-green-500 text-white rounded-br-sm"
                                  : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm"
                              }`}
                            >
                              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                {msg.content}
                              </div>
                              {msg.role === "assistant" && (
                                <div className="text-xs text-gray-400 mt-2 opacity-70">
                                  AI Assistant
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {chatLoading && (
                          <div className="flex justify-start">
                            <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-sm flex items-center">
                              <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150" />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-300" />
                              </div>
                              <span className="text-sm ml-3 text-gray-600">
                                AI is thinking...
                              </span>
                            </div>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </>
                    )}
                  </div>
                </div>

                {/* Fixed input */}
                <div className="border-t bg-gray-50 p-4 sticky bottom-0 shadow-sm">
                  <form onSubmit={handleSubmit} className="flex gap-3 w-full">
                    <Textarea
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type your message here... (Press Enter to send)"
                      className="flex-1 resize-none min-h-[50px] bg-white"
                      rows={2}
                      disabled={
                        initializing ||
                        !conversationId ||
                        !!initError ||
                        files.length === 0
                      }
                    />
                    <Button
                      type="submit"
                      disabled={
                        !userInput.trim() ||
                        chatLoading ||
                        initializing ||
                        !conversationId ||
                        !!initError ||
                        files.length === 0
                      }
                      className="bg-green-600 hover:bg-green-700 self-end px-6 py-3 h-auto min-h-[50px] rounded-lg"
                    >
                      {chatLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Separator className="my-8" />
        <footer className="text-center text-xs text-gray-500">
          {/* <p>© 2025 PDF Chat App. All rights reserved.</p> */}
        </footer>
      </div>
    </div>
  );
};

export default FolderChat;
