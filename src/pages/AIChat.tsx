import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { ChatMessage, sendChatRequest } from "@/services/AiService";

const AIChat = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || loading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: userInput
    };

    // Add user message to chat
    setMessages([...messages, userMessage]);
    setUserInput("");
    setLoading(true);

    try {
      // Send to AI and get response
      const allMessages = [...messages, userMessage];
      const response = await sendChatRequest(allMessages);
      
      // Add AI response to chat
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

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-white p-4 md:p-8">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.6))] pointer-events-none"></div>

      <div className="relative max-w-4xl mx-auto z-10">
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

        <Card className="mb-6 shadow-sm border-gray-100">
          <CardHeader>
            <CardTitle className="text-gray-800">Chat with Gemma 3</CardTitle>
            <CardDescription>Ask questions about anything you need help with</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-[400px] overflow-y-auto p-4 bg-gray-50 rounded-md">
              {messages.length === 0 ? (
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
                          : "bg-gray-100 mr-12"
                      }`}
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
                    <div className="p-3 rounded-lg bg-gray-100 mr-12 flex items-center">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-sm">AI is thinking...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Type your message here..."
                className="flex-1"
              />
              <Button 
                type="submit" 
                disabled={!userInput.trim() || loading}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="text-xs text-gray-500 flex justify-between">
            <span>Powered by Gemma 3 27B via OpenRouter</span>
          </CardFooter>
        </Card>

        <Separator className="my-8" />

        <footer className="text-center text-xs text-gray-500">
          <p>© 2025 PDF Chat App. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
};

export default AIChat;