import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, File, User, MessageSquare, RefreshCw } from "lucide-react";
import FileUploader from "@/components/FileUploader";
import { getCurrentUser, logout } from "@/lib/appwrite/auth";
import { getFilesByUserId, getFoldersByUserId, getFilesByFolderId } from "@/lib/appwrite/databases";
import FolderManager from "@/components/FolderManager";
import CreateFolderDialog from "@/components/CreateFolderDialog";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showUploader, setShowUploader] = useState(false);
  const [user, setUser] = useState(null); // State to store the logged-in user's data
  const [files, setFiles] = useState([]); // State to store the user's files
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFolderName, setSelectedFolderName] = useState<string>("");
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [folderNameMap, setFolderNameMap] = useState<{[key: string]: string}>({});

  // Fetch the logged-in user's data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser); // Set the logged-in user's data
          fetchUserFiles(currentUser.$id); // Fetch files for the user
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

  // Fetch files for the logged-in user
  const fetchUserFiles = async (userId) => {
    try {
      const userFiles = await getFilesByUserId(userId); // Fetch files from Appwrite
      const formattedFiles = userFiles.map((file) => ({
        id: file.$id,
        name: file.fileName,
        size: formatFileSize(file.size), // Format the size properly
        lastOpened: new Date(file.$createdAt).toISOString().split("T")[0], // Use $createdAt for the date
        status: "Unread",
        url: file.url,
      }));
      setFiles(formattedFiles); // Update the files state
    } catch (error) {
      console.error("Error fetching user files:", error);
      toast({
        title: "Error",
        description: "Failed to fetch your files. Please try again later.",
        variant: "destructive",
      });
    }
  };

  // Add this helper function
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    // Convert to appropriate unit and format with 1 decimal place
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Handle new file upload - modified to handle batch uploads
  const handleNewFile = (fileData) => {
    // Add the new file to the existing files array
    const newFile = {
      id: fileData.$id, 
      name: fileData.name,
      size: formatFileSize(fileData.size),
      lastOpened: new Date().toISOString().split("T")[0],
      status: "Unread",
      url: fileData.url,
    };

    // Add the file to the existing files
    setFiles(prevFiles => [...prevFiles, newFile]);

    // Don't close the uploader immediately for batch uploads
    // The uploader will close itself after all files are processed
  };

  const handleLogout = async () => {
    try {
      await logout(); 
      setUser(null); 
      setFiles([]); 
      navigate("/sign-in"); 
    } catch (error) {
      console.error("Error logging out:", error);
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Update the loadFilesByFolder function:
  const loadFilesByFolder = async (folderId: string) => {
    setIsLoading(true);
    try {
      const response = await getFilesByFolderId(folderId);
      // Apply the same formatting to ensure consistent structure with id property
      const formattedFiles = response.documents.map((file) => ({
        id: file.$id,  // Use $id as the id for the key
        name: file.fileName,
        size: formatFileSize(file.size),
        lastOpened: new Date(file.$createdAt).toISOString().split("T")[0],
        status: "Unread",
        url: file.url,
        folderId: file.folders || null // Add folder ID to the file data
      }));
      
      setFiles(formattedFiles);
    } catch (error) {
      console.error("Failed to load files by folder:", error);
      toast({
        title: "Error",
        description: "Failed to load files in this folder",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Add this function to handle folder selection
  const handleFolderSelect = (folderId: string, folderName: string) => {
    setSelectedFolderId(folderId);
    setSelectedFolderName(folderName);
    loadFilesByFolder(folderId);
  };
  
  // Add this function to handle folder creation
  const handleFolderCreated = (newFolder: any) => {
    console.log("New folder created:", newFolder);
    // Immediately update the folders state with the new folder
    setFolders(prevFolders => [...prevFolders, newFolder]);
    
    // Optionally, select the newly created folder
    setSelectedFolderId(newFolder.$id);
    setSelectedFolderName(newFolder.name);
    
    // Since it's a new folder, it will have no files yet
    setFiles([]);
  };
  
  // Update your fetchFiles function to correctly handle the response
  const fetchFiles = async () => {
    if (!user?.$id) return;
    
    setIsLoading(true);
    setSelectedFolderId(null);
    setSelectedFolderName("");
    
    try {
      const response = await getFilesByUserId(user.$id);
      const filesData = Array.isArray(response) ? response : (response as { documents: any[] }).documents || [];
      
      // Format files as you do in fetchUserFiles
      const formattedFiles = filesData.map((file) => ({
        id: file.$id,
        name: file.fileName,
        size: formatFileSize(file.size),
        lastOpened: new Date(file.$createdAt).toISOString().split("T")[0],
        status: "Unread",
        url: file.url,
        folderId: file.folders || null // Add folder ID to the file data
      }));
      
      setFiles(formattedFiles);
    } catch (error) {
      console.error("Failed to fetch files:", error);
      toast({
        title: "Error",
        description: "Failed to load your files",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Add this to your existing useEffect
  useEffect(() => {
    const loadFolders = async () => {
      setIsLoading(true);
      try {
        const foldersData = await getFoldersByUserId(user.$id);
        setFolders(foldersData.documents || []);
        
        // Create a mapping of folder IDs to folder names
        const mapping = mapFolderIdsToNames(foldersData.documents || []);
        setFolderNameMap(mapping);
      } catch (error) {
        console.error("Failed to load folders:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (user?.$id) {
      loadFolders();
      fetchFiles();
    }
  }, [user]);

  // Add this function to your Dashboard component
  const mapFolderIdsToNames = (foldersList: any[]) => {
    const mapping: {[key: string]: string} = {};
    foldersList.forEach(folder => {
      if (folder.$id) {
        mapping[folder.$id] = folder.name;
      }
    });
    return mapping;
  };

  // Add this function before the return statement in your Dashboard component

  const handleChatWithPdf = (file: any) => {
    // Navigate to the chat page with the selected file
    navigate(`/chat/${file.id}`, {
      state: { 
        pdfUrl: file.url, 
        fileName: file.name 
      }
    });
  };

  // Add this new function to handle "Chat with Folder"
  const handleChatWithFolder = (folderId: string, folderName: string) => {
    // Navigate to a new route for folder chat
    navigate(`/folder-chat/${folderId}`, {
      state: { 
        folderId: folderId,
        folderName: folderName
      }
    });
  };

  if (!user) {
    return <div>Loading...</div>; 
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-8">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.6))] pointer-events-none"></div>

      <div className="relative max-w-7xl mx-auto z-10">
        {/* Header section with profile summary */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border border-purple-100">
              <AvatarImage src={user.avatar || ""} alt={user.name} />
              <AvatarFallback className="bg-purple-100 text-purple-800 text-xl">
                {user.name.split(" ").map((part) => part[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Welcome, {user.name}</h1>
              <p className="text-gray-500">{user.email}</p>
            </div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <Button
              variant="outline"
              className="flex-1 md:flex-none"
              onClick={handleLogout}
            >
              <User className="mr-2 h-4 w-4" />
              Logout
            </Button>
            <Button
              className="flex-1 md:flex-none bg-purple-600 hover:bg-purple-700"
              onClick={() => setShowUploader(true)}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload PDF
            </Button>
            <Button
              className="flex-1 md:flex-none bg-purple-600 hover:bg-purple-700 ml-2"
              onClick={() => navigate("/ai")}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              AI Chat
            </Button>
          </div>
        </div>

        {/* File uploader dialog */}
        {showUploader && (
          <FileUploader 
            onFileUpload={handleNewFile} 
            onCancel={() => setShowUploader(false)}
            selectedFolderId={selectedFolderId}
            onFolderCreated={handleFolderCreated} // Add this line
          />
        )}

        {/* Folder creation dialog - new */}
        <CreateFolderDialog
          open={showFolderDialog}
          onOpenChange={setShowFolderDialog}
          onFolderCreated={handleFolderCreated}
          selectedFolderId={selectedFolderId}
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {/* Folder sidebar - new */}
          <div className="md:col-span-1">
            <FolderManager 
              onFolderSelect={handleFolderSelect} 
              selectedFolderId={selectedFolderId}
              onCreateNewFolder={() => setShowFolderDialog(true)}
              folders={folders}
              isLoading={isLoading}
              onChatWithFolder={handleChatWithFolder} // Add this prop
            />
            
            <Button 
              variant="outline" 
              className="w-full mb-4"
              onClick={fetchFiles}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Show All Files
            </Button>
          </div>
          
          {/* Main content area */}
          <div className="md:col-span-3">
            <Card className="mb-8 shadow-sm border-gray-100">
              <CardHeader>
                <CardTitle className="text-gray-800">
                  {selectedFolderId 
                    ? `Folder: ${selectedFolderName}` 
                    : "Your PDF Library"}
                </CardTitle>
                <CardDescription>
                  {selectedFolderId
                    ? "Files in this folder"
                    : "Access and chat with your uploaded PDF documents"}
                </CardDescription>
                <Button
                  onClick={() => setShowUploader(true)}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload PDF {selectedFolderId ? "to this folder" : ""}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="bg-white shadow-sm border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-5 border-b p-4 bg-gray-50 font-medium text-sm text-gray-600">
                    <div>Name</div>
                    <div>Size</div>
                    <div>Folder</div> {/* Added Folder column */}
                    <div>Last Opened</div>
                    <div>Actions</div>
                  </div>

                  {isLoading ? (
                    <div className="p-8 text-center text-gray-500">Loading files...</div>
                  ) : files.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <p>No files found.</p>
                      <p className="mt-2 text-sm">Upload your first PDF to get started.</p>
                    </div>
                  ) : (
                    files.map((file) => (
                      <div key={file.id} className="grid grid-cols-5 border-b p-4 items-center text-sm">
                        <div className="flex items-center">
                          <File className="h-4 w-4 text-purple-500 mr-2" />
                          <Link
                            to={`/chat/${file.id}`}
                            className="text-blue-600 hover:underline"
                            state={{ pdfUrl: file.url, fileName: file.name }}
                          >
                            {file.name}
                          </Link>
                          {file.status === "Unread" && (
                            <span className="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full ml-2">
                              New
                            </span>
                          )}
                        </div>
                        <div>{file.size}</div>
                        <div>
                          {file.folderId && folderNameMap[file.folderId] ? (
                            <Badge variant="outline" className="font-normal">
                              {folderNameMap[file.folderId]}
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </div>
                        <div>{file.lastOpened}</div>
                        <div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                            onClick={() => handleChatWithPdf(file)}
                          >
                            Chat
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
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

export default Dashboard;