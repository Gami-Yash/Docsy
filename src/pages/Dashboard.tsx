import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, File, User, MessageSquare, RefreshCw, Loader2 , Plus, 
  Folder  } from "lucide-react";
import FileUploader from "@/components/FileUploader";
import { getCurrentUser, logout } from "@/lib/appwrite/auth";
import { getFilesByUserId, getFoldersByUserId, getFilesByFolderId } from "@/lib/appwrite/databases";
import FolderManager from "@/components/FolderManager";
import CreateFolderDialog from "@/components/CreateFolderDialog";


const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showUploader, setShowUploader] = useState(false);
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFolderName, setSelectedFolderName] = useState<string>("");
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [folderNameMap, setFolderNameMap] = useState<{[key: string]: string}>({});

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
        ease: "easeOut"
      }
    }
  };

  const cardVariants = {
    hidden: { scale: 0.95, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    }
  };

  // Fetch the logged-in user's data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          fetchUserFiles(currentUser.$id);
        } else {
          navigate("/sign-in");
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        navigate("/sign-in");
      }
    };

    fetchUser();
  }, [navigate]);

  // Fetch files for the logged-in user
  const fetchUserFiles = async (userId) => {
    try {
      const userFiles = await getFilesByUserId(userId);
      const formattedFiles = userFiles.map((file) => ({
        id: file.$id,
        name: file.fileName,
        size: formatFileSize(file.size),
        lastOpened: new Date(file.$createdAt).toISOString().split("T")[0],
        status: "Unread",
        url: file.url,
      }));
      setFiles(formattedFiles);
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

  // Handle new file upload - modified to handle batch uploads and folder creation
  const handleNewFile = async (data) => {
    console.log("handleNewFile called with:", data);
    
    // Check if this is a folder creation
    if (data.name && !data.fileName) {
      // This is a folder, add it to the folders list
      setFolders(prevFolders => {
        const updatedFolders = [...prevFolders, data];
        
        // Update folder name mapping
        const newMapping = { ...folderNameMap };
        newMapping[data.$id] = data.name;
        setFolderNameMap(newMapping);
        
        return updatedFolders;
      });
      
      console.log("Added new folder to state:", data.name);
      return;
    }
    
    // This is a file upload
    if (Array.isArray(data)) {
      // Handle multiple files
      const formattedFiles = data.map((file) => ({
        id: file.$id || file.id,
        name: file.fileName || file.name,
        size: formatFileSize(file.size),
        lastOpened: new Date().toISOString().split("T")[0],
        status: "New",
        url: file.url,
        folderId: file.folders
      }));
      
      setFiles(prevFiles => [...prevFiles, ...formattedFiles]);
    } else {
      // Handle single file
      const formattedFile = {
        id: data.$id || data.id,
        name: data.fileName || data.name,
        size: formatFileSize(data.size),
        lastOpened: new Date().toISOString().split("T")[0],
        status: "New",
        url: data.url,
        folderId: data.folders
      };
      
      setFiles(prevFiles => [...prevFiles, formattedFile]);
    }
  };

  const handleCloseUploader = () => {
    setShowUploader(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Error during logout:", error);
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
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-800 mb-2">Loading Dashboard</h3>
          <p className="text-sm text-gray-500">Preparing your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div 
          className="bg-white border-b border-gray-200 px-6 py-4"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={user.avatar || ""} alt={user.name} />
                <AvatarFallback className="bg-green-100 text-green-700">
                  {user.name.split(" ").map((part) => part[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Welcome, {user.name}</h1>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleLogout}>
                <User className="mr-2 h-4 w-4" />
                Logout
              </Button>
              <Button onClick={() => setShowUploader(true)} className="bg-green-600 hover:bg-green-700">
                <Upload className="mr-2 h-4 w-4" />
                Upload PDF
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="flex h-[calc(100vh-5rem)]">
          {/* Sidebar */}
          <motion.div 
            className="w-80 bg-white border-r border-gray-200 flex flex-col"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            {/* Use FolderManager instead of manual folder rendering */}
            <div className="p-6">
              <FolderManager
                onFolderSelect={handleFolderSelect}
                selectedFolderId={selectedFolderId}
                onCreateNewFolder={() => setShowFolderDialog(true)}
                folders={folders}
                isLoading={isLoading}
                onChatWithFolder={handleChatWithFolder} // This is the key prop!
              />
            </div>
          </motion.div>

          {/* Main Content Area */}
          <motion.div 
            className="flex-1 flex flex-col bg-gray-50"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            {/* Content Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedFolderId ? selectedFolderName : "Your PDF Library"}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedFolderId 
                      ? `Files in the ${selectedFolderName} folder`
                      : "Access and chat with your uploaded PDF documents"
                    }
                  </p>
                </div>
                {!selectedFolderId && (
                  <Button
                    onClick={() => setShowUploader(true)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload PDF
                  </Button>
                )}
              </div>
            </div>

            {/* Files List */}
            <div className="flex-1 overflow-hidden">
              {files.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <File className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No files found</h3>
                    <p className="text-gray-500 mb-6">Upload your first PDF to get started.</p>
                    <Button
                      onClick={() => setShowUploader(true)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload PDF
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="h-full overflow-y-auto">
                  <div className="p-6 space-y-3">
                    {files.map((file, index) => (
                      <motion.div
                        key={file.id}
                        className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-200"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        whileHover={{ y: -2 }}
                      >
                        <div className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="p-3 bg-red-50 rounded-lg">
                              <File className="h-6 w-6 text-red-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Link
                                to={`/chat/${file.id}`}
                                state={{ pdfUrl: file.url, fileName: file.name }}
                                className="block"
                              >
                                <h3 className="font-medium text-gray-900 hover:text-blue-600 transition-colors truncate">
                                  {file.name}
                                </h3>
                                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                                  <span>{file.size}</span>
                                  <span>•</span>
                                  <span>{file.lastOpened}</span>
                                  {file.status === "New" && (
                                    <>
                                      <span>•</span>
                                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
                                        New
                                      </span>
                                    </>
                                  )}
                                </div>
                              </Link>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleChatWithPdf(file)}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50 ml-4"
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Chat
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* File Uploader Dialog */}
        <FileUploader
          isOpen={showUploader}
          onClose={handleCloseUploader}
          onFileUploaded={handleNewFile}
          userId={user.$id}
          selectedFolderId={selectedFolderId}
        />

        {/* Create Folder Dialog */}
        <CreateFolderDialog
          open={showFolderDialog}
          onOpenChange={setShowFolderDialog}
          userId={user.$id}
          onFolderCreated={(newFolder) => {
            setFolders(prevFolders => [...prevFolders, newFolder]);
            const newMapping = { ...folderNameMap };
            newMapping[newFolder.$id] = newFolder.name;
            setFolderNameMap(newMapping);
          }}
        />
      </div>
    </div>
  );
};

export default Dashboard;