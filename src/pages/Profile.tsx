import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { logout, getCurrentUser } from "@/lib/appwrite/auth";
import { ArrowLeft, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState(null); // State to store the logged-in user's data

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser); // Set the logged-in user's data
        } else {
          navigate("/sign-in"); // Redirect to sign-in if no user is logged in
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        navigate("/sign-in"); // Redirect to sign-in on error
      }
    };

    fetchUser();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged out successfully",
      });
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Logout failed",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return <div>Loading...</div>; // Show a loading state while fetching user data
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-white p-4 md:p-8">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.6))] pointer-events-none"></div>

      <div className="relative max-w-xl mx-auto z-10">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card className="shadow-sm border-gray-100">
          <CardHeader className="flex flex-row items-center gap-4 pb-8">
            <Avatar className="h-20 w-20 border border-purple-100">
              <AvatarImage src={user.avatar || ""} alt={user.name} />
              <AvatarFallback className="bg-purple-100 text-purple-800 text-2xl">
                {user.name.split(" ").map((part) => part[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-2xl">{user.name}</CardTitle>
              <p className="text-gray-500 mt-1">
                Member since {new Date(user.registration).toLocaleDateString()}
              </p>
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-6">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-500">Email</p>
                <p className="text-base">{user.email}</p>
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <Button variant="outline" className="justify-start">
                  <User className="mr-2 h-4 w-4" />
                  Edit Profile
                </Button>
                <Button variant="destructive" onClick={handleLogout}>
                  Log Out
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
