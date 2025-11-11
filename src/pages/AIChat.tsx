import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, Loader2, MessageSquare } from "lucide-react";
import { ChatMessage, sendChatRequest } from "@/services/AiService";
import { getCurrentUser } from "@/lib/appwrite/auth";
import { getFoldersByUserId } from "@/lib/appwrite/databases";
import FolderManager from "@/components/FolderManager";

const AIChat = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Fetch user and folders
  useEffect(() => {
    const fetchUserAndFolders = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          
          // Fetch user's folders
          const foldersData = await getFoldersByUserId(currentUser.$id);
          setFolders(foldersData.documents || []);
        } else {
          navigate("/sign-in");
        }
      } catch (error) {
        console.error("Error fetching user or folders:", error);
        navigate("/sign-in");
      }
    };

    fetchUserAndFolders();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || loading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: userInput
    };

    setMessages([...messages, userMessage]);
    setUserInput("");
    setLoading(true);

    try {
      const allMessages = [...messages, userMessage];
      const response = await sendChatRequest(allMessages);
      
      setMessages([
        ...allMessages,
        {
          role: "assistant",
          content: response
        }
      ]);
    } catch (error) {
      console.error("Error getting AI response:", error);
      toast({
        title: "Error",
        description: "Failed to get a response from the AI. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!userInput.trim() || loading) return;
      handleSubmit(e as any);
    }
  };

  // Handle folder selection
  const handleFolderSelect = (folderId: string, folderName: string) => {
    setSelectedFolderId(folderId);
    toast({
      title: "Folder Selected",
      description: `Selected folder: ${folderName}`,
    });
  };

  // Handle chat with folder - make sure this function is working
  const handleChatWithFolder = (folderId: string, folderName: string) => {
    console.log("Navigating to folder chat:", folderId, folderName); // Add this for debugging
    navigate(`/folder-chat/${folderId}`, {
      state: { 
        folderId: folderId,
        folderName: folderName
      }
    });
  };

  return (
    <div className="min-h-screen w-full bg-gray-50 p-4 md:p-8">
      <div className="relative max-w-6xl mx-auto z-10">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/dashboard")} 
            className="mr-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-800">AI Assistant</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Folders Sidebar */}
          <div className="lg:col-span-1">
            {user && (
              <FolderManager
                onFolderSelect={handleFolderSelect}
                selectedFolderId={selectedFolderId}
                onCreateNewFolder={() => navigate("/dashboard")}
                folders={folders}
                isLoading={false}
                onChatWithFolder={handleChatWithFolder} // Make sure this is being passed
              />
            )}
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-2">
            <Card className="mb-6 shadow-sm border-gray-100">
              <CardHeader>
                <CardTitle className="text-gray-800">Chat with Gemma 3</CardTitle>
                <CardDescription>
                  Ask questions about anything you need help with, or select a folder to chat with your documents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-[400px] overflow-y-auto p-4 bg-white rounded-md border">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <MessageSquare className="h-12 w-12 mb-4 text-gray-300" />
                      <p className="text-center">
                        No messages yet. Start by sending a message below, or select a folder to chat with your documents.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg, index) => (
                        <div 
                          key={index} 
                          className={`p-3 rounded-lg animate-in slide-in-from-bottom-2 duration-300 ${
                            msg.role === "user" 
                              ? "bg-green-100 ml-12" 
                              : "bg-gray-100 mr-12"
                          }`}
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <p className="text-sm font-semibold mb-1">
                            {msg.role === "user" ? "You" : "AI Assistant"}
                          </p>
                          <div className="text-gray-700 whitespace-pre-wrap">
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {loading && (
                        <div className="p-3 rounded-lg bg-gray-100 mr-12 flex items-center animate-in slide-in-from-bottom-2 duration-300">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          <span className="text-sm ml-3">AI is thinking...</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="flex gap-2">
                  <Input
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message here... (Press Enter to send)"
                    className="flex-1"
                  />
                  <Button 
                    type="submit" 
                    disabled={!userInput.trim() || loading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
              </CardContent>
              <CardFooter className="text-xs text-gray-500 flex justify-between">
                <span>Powered by Gemma 3 27B via OpenRouter</span>
              </CardFooter>
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

export default AIChat;