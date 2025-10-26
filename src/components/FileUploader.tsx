import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, Loader2, FolderOpen, File as FileIcon, Plus } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Client, Storage, ID, Databases } from 'appwrite';
import { appwriteConfig } from "@/lib/config/appwriteConfig";
import { Progress } from "@/components/ui/progress";
import { extractTextFromPDF } from "@/services/PdfProcessingService";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

// Extend HTMLInputElement to include webkitdirectory and directory attributes
declare module 'react' {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

interface FileUploaderProps {
  onFileUpload: (file: any) => void;
  onCancel: () => void;
  selectedFolderId?: string | null;
  onFolderCreated?: (folder: any) => void; // Add this prop
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileUpload, onCancel, selectedFolderId, onFolderCreated }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [folderName, setFolderName] = useState<string>("");
  const [useExistingFolder, setUseExistingFolder] = useState(true);
  const [showQuickFolderCreate, setShowQuickFolderCreate] = useState(false);
  const [quickFolderName, setQuickFolderName] = useState("");
  const [isCreatingQuickFolder, setIsCreatingQuickFolder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Initialize Appwrite Client
  const client = new Client();
  const storage = new Storage(client);
  const databases = new Databases(client);

  client
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

  // Event handlers for drag and drop
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    // Handle dropped files
    const droppedFiles = Array.from(e.dataTransfer.files);
    validateAndSetFiles(droppedFiles);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      validateAndSetFiles(selectedFiles);
    }
  };

  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      validateAndSetFiles(selectedFiles);
      
      // Extract folder name from the first file's path but don't create a new folder structure
      // when we're uploading into an existing folder
      if (selectedFiles[0].webkitRelativePath && !selectedFolderId) {
        const folderPath = selectedFiles[0].webkitRelativePath.split('/');
        if (folderPath.length > 0) {
          setFolderName(folderPath[0]);
          setUseExistingFolder(false);
        }
      } else if (selectedFolderId) {
        // We're uploading to an existing folder, so just use that
        setUseExistingFolder(true);
      }
    }
  };

  const validateAndSetFiles = (filesToValidate: File[]) => {
    // Filter for PDF files only
    const validFiles = filesToValidate.filter(file => file.type === 'application/pdf');
    
    if (validFiles.length !== filesToValidate.length) {
      toast({
        title: "Some files were skipped",
        description: "Only PDF files are allowed",
        variant: "default",
      });
    }

    if (validFiles.length === 0) {
      toast({
        title: "No valid files",
        description: "Please select PDF files only",
        variant: "destructive",
      });
      return;
    }

    // Check file sizes
    const maxSize = 10 * 1024 * 1024; // 10MB
    const validSizedFiles = validFiles.filter(file => file.size <= maxSize);
    
    if (validSizedFiles.length !== validFiles.length) {
      toast({
        title: "Some files were skipped",
        description: "Files must be less than 10MB",
        variant: "default",
      });
    }

    if (validSizedFiles.length === 0) {
      toast({
        title: "Files too large",
        description: "All files exceed the 10MB limit",
        variant: "destructive",
      });
      return;
    }

    setFiles(validSizedFiles);
  };

  const removeFile = (indexToRemove: number) => {
    setFiles(currentFiles => currentFiles.filter((_, index) => index !== indexToRemove));
  };

  // Construct file URL
  const constructFileUrl = (bucketFileId: string) => {
    return `${import.meta.env.VITE_APPWRITE_ENDPOINT}/storage/buckets/${import.meta.env.VITE_APPWRITE_BUCKET}/files/${bucketFileId}/view?project=${import.meta.env.VITE_APPWRITE_PROJECT_ID}`;
  };

  // Simulate progress updates for individual file
  const simulateProgressUpdates = () => {
    setUploadProgress(0);
    
    setTimeout(() => setUploadProgress(10), 200);
    setTimeout(() => setUploadProgress(20), 500);
    
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return prev;
        }
        return prev + (prev < 50 ? 10 : (prev < 70 ? 5 : 2));
      });
    }, 800);

    return interval;
  };

  // Process a single PDF file for vector database
  async function processPdfForVectorDB(fileUrl: string, fileId: string, documentId: string, userId: string, folderId?: string) {
    try {
      console.log("Processing PDF for vector DB with fileId:", fileId, "documentId:", documentId, "userId:", userId);
      
      // Store raw IDs for debugging
      localStorage.setItem('last_processed_fileId', fileId);
      if (documentId) localStorage.setItem('last_processed_documentId', documentId);
      
      // Extract text from PDF
      const response = await fetch(fileUrl);
      const arrayBuffer = await response.arrayBuffer();
      const pageTexts = await extractTextFromPDF(arrayBuffer);
      
      // Split text into chunks
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200
      });
      
      let allChunks = [];
      
      for (let pageIdx = 0; pageIdx < pageTexts.length; pageIdx++) {
        const chunks = await textSplitter.splitText(pageTexts[pageIdx]);
        
        const chunkObjects = chunks.map((chunk, chunkIdx) => ({
          text: chunk,
          metadata: {
            fileId: fileId,
            page: pageIdx + 1,
            chunk: chunkIdx,
            userId: userId,           // Add owner information
            folderId: folderId || null // Add folder association
          }
        }));
        
        allChunks = [...allChunks, ...chunkObjects];
      }
      
      console.log("Storing embeddings with fileId:", fileId, "documentId:", documentId, "with", allChunks.length, "chunks");
      
      // Store embeddings in vector database
      const { storeEmbeddings } = await import("@/services/VectorService");
      await storeEmbeddings(allChunks, documentId || fileId);
      
      console.log("Successfully processed and stored PDF embeddings");
      return true;
    } catch (error) {
      console.error("Error processing PDF:", error);
      return false;
    }
  }

  // Upload all files to Appwrite
  const uploadFilesToAppwrite = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setTotalFiles(files.length);
    setCurrentFileIndex(0);
    
    // Determine if we need to create a new folder first
    let targetFolderId = selectedFolderId;
    
    // If we're creating a new folder and we're not using an existing folder
    if (!useExistingFolder && folderName && !selectedFolderId) {
      try {
        // Get current user ID
        const currentUser = JSON.parse(localStorage.getItem('appwrite-session') || '{}');
        const userId = currentUser?.userId;
        
        if (!userId) {
          throw new Error("User not authenticated");
        }
        
        // Create a new top-level folder
        const { createFolder } = await import("@/lib/appwrite/databases");
        const newFolder = await createFolder(folderName, `Uploaded folder from local machine`, userId);
        targetFolderId = newFolder.$id;
        
        // Tell the parent component about the new folder
        if (onFolderCreated && typeof onFolderCreated === 'function') {
          onFolderCreated(newFolder);
        }
        
        toast({
          title: "Folder created",
          description: `Created folder: ${folderName}`,
        });
      } catch (error) {
        console.error("Error creating folder:", error);
        toast({
          title: "Folder creation failed",
          description: "Will upload files without folder",
          variant: "destructive",
        });
        targetFolderId = null; // Upload to root if folder creation fails
      }
    }
    
    // Upload files one by one
    for (let i = 0; i < files.length; i++) {
      setCurrentFileIndex(i);
      const file = files[i];
      const progressInterval = simulateProgressUpdates();
      
      try {
        // 1. Upload file to Appwrite bucket
        const fileId = ID.unique();
        const bucketFile = await storage.createFile(
          import.meta.env.VITE_APPWRITE_BUCKET,
          fileId,
          file
        );

        // 2. Get user ID from session
        const currentUser = JSON.parse(localStorage.getItem('appwrite-session') || '{}');
        const userId = currentUser?.userId;

        if (!userId) {
          throw new Error("User not authenticated");
        }

        // 3. Prepare file document data - always use targetFolderId which could be
        // either the selected folder or a newly created one
        const fileDocument = {
          fileID: bucketFile.$id,
          fileName: file.name,
          size: file.size,
          users: userId,
          folders: targetFolderId || null
        };

        // 4. Create document in the Files_Collection
        const newFileDoc = await databases.createDocument(
          import.meta.env.VITE_APPWRITE_DATABASE,
          import.meta.env.VITE_APPWRITE_FILES_COLLECTION,
          ID.unique(),
          fileDocument
        );

        clearInterval(progressInterval);
        setUploadProgress(100);

        const fileUrl = constructFileUrl(bucketFile.$id);
        
        // 5. Process PDF for vector database in the background
        processPdfForVectorDB(
          fileUrl, 
          bucketFile.$id, 
          newFileDoc.$id, 
          userId, 
          targetFolderId || ""  // Use empty string instead of null
        );
        
        // 6. Notify parent component about the uploaded file
        const fileData = {
          ...bucketFile,
          ...newFileDoc,
          size: file.size,
          url: fileUrl,
          name: file.name
        };
        
        onFileUpload(fileData);
        
        // Short pause between files
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);
        toast({
          title: `Failed to upload ${file.name}`,
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      }
    }

    // Upload complete
    toast({
      title: "Upload complete",
      description: `Successfully uploaded ${files.length} file(s)`,
    });
    
    setIsUploading(false);
    
    // Close the uploader after all files are processed
    setTimeout(() => onCancel(), 1000);
  };

  const handleQuickFolderCreate = async () => {
    if (!quickFolderName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a folder name",
        variant: "destructive",
      });
      return;
    }
    
    setIsCreatingQuickFolder(true);
    
    try {
      // Get user ID
      const currentUser = JSON.parse(localStorage.getItem('appwrite-session') || '{}');
      const userId = currentUser?.userId;
      
      if (!userId) {
        throw new Error("User not authenticated");
      }
      
      // Create folder at the top level
      const { createFolder } = await import("@/lib/appwrite/databases");
      const newFolder = await createFolder(quickFolderName, "Created from uploader", userId);
      
      // Always create at top level, don't use selected folder
      setFolderName(quickFolderName);
      setUseExistingFolder(false);
      
      // Tell the parent component about the new folder
      if (onFolderCreated && typeof onFolderCreated === 'function') {
        onFolderCreated(newFolder);
      }
      
      toast({
        title: "Success",
        description: `Folder "${quickFolderName}" created`,
      });
      
      // Close the quick create UI
      setShowQuickFolderCreate(false);
      setQuickFolderName("");
      
      // Return the new folder ID
      return newFolder.$id;
    } catch (error) {
      console.error("Error creating folder:", error);
      toast({
        title: "Error",
        description: "Failed to create folder",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsCreatingQuickFolder(false);
    }
  };

  // Add this function near the top of your component
  const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4 animate-fade-in">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Upload PDFs</CardTitle>
            <Button variant="ghost" size="icon" onClick={onCancel} disabled={isUploading}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="files" className="mb-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="files">Upload Files</TabsTrigger>
              <TabsTrigger value="folder">Upload Folder</TabsTrigger>
            </TabsList>
            <TabsContent value="files" className="mt-4">
              <div
                className={`border-2 border-dashed rounded-lg p-8 transition-colors ${
                  isDragging ? 'border-purple-500 bg-purple-50' : 'border-gray-300'
                }`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <div className="text-center">
                  <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <Upload className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-base font-medium mb-1">Drag & drop PDFs here</p>
                  <p className="text-sm text-gray-500 mb-4">or click to browse files</p>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Select files
                  </Button>
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileInputChange}
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="folder" className="mt-4">
              {isIOS() ? (
                <div className="border-2 border-dashed rounded-lg p-8 border-gray-300 bg-yellow-50">
                  <div className="text-center">
                    <div className="bg-yellow-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                      <FolderOpen className="h-8 w-8 text-yellow-600" />
                    </div>
                    <p className="text-base font-medium mb-1">Folder upload not supported</p>
                    <p className="text-sm text-gray-700 mb-4">
                      Folder upload is not supported on iOS devices. Please upload files individually or use a desktop browser.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-8 border-gray-300">
                  <div className="text-center">
                    <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                      <FolderOpen className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-base font-medium mb-1">Upload an entire folder</p>
                    <p className="text-sm text-gray-500 mb-4">
                      {selectedFolderId 
                        ? "Files will be extracted and uploaded to the selected folder" 
                        : "Select a folder from your computer"}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => folderInputRef.current?.click()}
                    >
                      Select folder
                    </Button>
                    <input
                      type="file"
                      webkitdirectory="true"
                      directory=""
                      multiple
                      className="hidden"
                      ref={folderInputRef}
                      onChange={handleFolderInputChange}
                    />
                  </div>
                </div>
              )}

              {folderName && !selectedFolderId ? (
                <div className="mt-4 p-4 border rounded-md bg-gray-50">
                  <p className="font-medium mb-2">Selected folder: <span className="text-purple-600">{folderName}</span></p>
                  
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="checkbox"
                      id="create-new-folder-option"
                      checked={!useExistingFolder}
                      onChange={(e) => setUseExistingFolder(!e.target.checked)}
                      className="h-4 w-4 border-gray-300 rounded text-purple-600"
                    />
                    <label htmlFor="create-new-folder-option" className="text-sm">
                      Create as a new top-level folder
                    </label>
                  </div>
                </div>
              ) : selectedFolderId ? (
                <div className="mt-4 p-4 border rounded-md bg-gray-50">
                  <p className="font-medium">Files will be uploaded to the selected folder</p>
                </div>
              ) : (
                <div className="flex items-center justify-between mt-4">
                  <div className="h-px bg-gray-200 flex-grow"></div>
                  <span className="px-3 text-xs text-gray-500">or</span>
                  <div className="h-px bg-gray-200 flex-grow"></div>
                </div>
              )}
              
              {/* Only show "Create Empty Folder" when we're not creating a folder already and no folder is selected */}
              {!folderName && !selectedFolderId && (
                <Button
                  variant="outline" 
                  onClick={() => setShowQuickFolderCreate(true)}
                  className="w-full mt-4"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Empty Folder
                </Button>
              )}
              
              {showQuickFolderCreate && !selectedFolderId && (
                <div className="mt-4 border p-4 rounded-md bg-gray-50">
                  <h4 className="text-sm font-medium mb-2">Create New Folder</h4>
                  <div className="flex gap-2">
                    <Input
                      value={quickFolderName}
                      onChange={(e) => setQuickFolderName(e.target.value)}
                      placeholder="Enter folder name"
                      className="flex-1"
                      disabled={isCreatingQuickFolder}
                      autoFocus
                    />
                    <Button 
                      onClick={handleQuickFolderCreate}
                      disabled={isCreatingQuickFolder || !quickFolderName.trim()}
                    >
                      {isCreatingQuickFolder ? 
                        <Loader2 className="h-4 w-4 animate-spin" /> : 
                        'Create'
                      }
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => setShowQuickFolderCreate(false)}
                      disabled={isCreatingQuickFolder}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Selected Files List */}
          {files.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Selected files ({files.length}):</p>
              <div className="max-h-32 overflow-y-auto border rounded-md p-2">
                {files.map((file, index) => (
                  <div 
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between py-1 px-2 text-sm hover:bg-gray-50 rounded"
                  >
                    <div className="flex items-center overflow-hidden">
                      <FileIcon className="h-4 w-4 text-purple-500 flex-shrink-0 mr-2" />
                      <span className="truncate">{file.name}</span>
                    </div>
                    <div className="flex items-center ml-2">
                      <Badge variant="outline" className="text-xs mr-2">
                        {(file.size / (1024 * 1024)).toFixed(1)} MB
                      </Badge>
                      <Button 
                        variant="ghost" 
                        onClick={() => removeFile(index)}
                        className="h-8 w-8 p-0"
                        aria-label="Remove file"
                      >
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload destination and action button */}
          {files.length > 0 && (
            <div className="mt-6 pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Upload destination:</p>
                <Badge variant="outline" className="font-normal">
                  {!useExistingFolder && folderName ? (
                    <>New folder: <span className="font-medium ml-1">{folderName}</span></>
                  ) : selectedFolderId ? (
                    <>Selected folder</>
                  ) : (
                    <>Root folder</>
                  )}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between border-t pt-4">
          <Button 
            variant="outline" 
            onClick={onCancel}
            disabled={isUploading}
          >
            Cancel
          </Button>
          
          {files.length > 0 && (
            <Button 
              onClick={uploadFilesToAppwrite} 
              disabled={isUploading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {isUploading ? `Uploading...` : `Upload`}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default FileUploader;
