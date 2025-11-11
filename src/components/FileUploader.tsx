import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, X, Loader2, FolderOpen, FileText, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Client, Storage, ID, Databases } from 'appwrite';
import { Progress } from "@/components/ui/progress";
import { extractTextFromPDF } from "@/services/PdfProcessingService";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import mammoth from "mammoth"; // Import mammoth for DOCX processing

// Extend HTMLInputElement to include webkitdirectory and directory attributes
declare module 'react' {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

interface FileUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onFileUploaded: (fileData: any) => void;
  userId: string;
  selectedFolderId?: string | null;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  isOpen,
  onClose,
  onFileUploaded,
  userId,
  selectedFolderId = null,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
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

  // Calculate overall progress
  const overallProgress = totalFiles > 0 
    ? ((currentFileIndex + (uploadProgress / 100)) / totalFiles) * 100 
    : 0;

  // Initialize Appwrite Client
  const client = new Client();
  const storage = new Storage(client);
  const databases = new Databases(client);

  client
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

  const handleTabChange = (value: string) => {
    // Clear files when switching tabs to avoid confusion
    setFiles([]);
    setFolderName("");
    setUseExistingFolder(true);
  };

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
    const validFiles = filesToValidate.filter((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'txt', 'docx'].includes(extension); // Ensure 'txt' is included
    });

    if (validFiles.length !== filesToValidate.length) {
      toast({
        title: "Some files were skipped",
        description: "Only PDF, TXT, and DOCX files are allowed",
        variant: "default",
      });
    }

    if (validFiles.length === 0) {
      toast({
        title: "No valid files",
        description: "Please select PDF, TXT, or DOCX files only",
        variant: "destructive",
      });
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    const validSizedFiles = validFiles.filter((file) => file.size <= maxSize);

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
      console.log("Processing file for vector DB with fileId:", fileId, "documentId:", documentId, "userId:", userId);

      // Fetch the file content
      const response = await fetch(fileUrl);
      const arrayBuffer = await response.arrayBuffer();

      let pageTexts: string[] = [];

      // FIXED: Get file extension from the actual file metadata, not from URL
      // First, try to get the file document to get the real filename
      let extension = '';
      try {
        const { databases } = await import("@/lib/appwrite/databases");
        const fileDoc = await databases.getDocument(
          import.meta.env.VITE_APPWRITE_DATABASE,
          import.meta.env.VITE_APPWRITE_FILES_COLLECTION,
          documentId
        );
        
        // Extract extension from the fileName field
        const fileName = fileDoc.fileName || '';
        extension = fileName.split('.').pop()?.toLowerCase() || '';
        console.log("Got extension from fileName:", extension, "from file:", fileName);
      } catch (error) {
        console.error("Could not get file metadata, will try URL parsing:", error);
        // Fallback: try to extract from URL (remove /view and query params)
        const urlWithoutView = fileUrl.split('/view')[0];
        const urlParts = urlWithoutView.split('/');
        const lastPart = urlParts[urlParts.length - 1];
        extension = lastPart.split('.').pop()?.toLowerCase() || '';
      }
      
      console.log("Processing file with extension:", extension);

      if (!extension || !['pdf', 'txt', 'docx'].includes(extension)) {
        console.error("Unsupported or missing file type:", extension);
        throw new Error(`Unsupported file type: ${extension || 'unknown'}`);
      }

      if (extension === 'pdf') {
        console.log("Extracting text from PDF");
        pageTexts = await extractTextFromPDF(arrayBuffer);
      } else if (extension === 'txt') {
        console.log("Extracting text from TXT file");
        const text = new TextDecoder().decode(arrayBuffer);
        pageTexts = [text];
      } else if (extension === 'docx') {
        console.log("Extracting text from DOCX file");
        const result = await mammoth.extractRawText({ arrayBuffer });
        pageTexts = [result.value];
      }

      // Validate that we have text content
      if (!pageTexts || pageTexts.length === 0 || pageTexts.every(text => !text.trim())) {
        throw new Error("No text content extracted from file");
      }

      console.log(`Extracted ${pageTexts.length} page(s) of text`);

      // Split text into chunks
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      let allChunks = [];
      for (let pageIdx = 0; pageIdx < pageTexts.length; pageIdx++) {
        const pageText = pageTexts[pageIdx];
        if (!pageText || !pageText.trim()) {
          console.log(`Skipping empty page ${pageIdx + 1}`);
          continue;
        }
        
        const chunks = await textSplitter.splitText(pageText);
        const chunkObjects = chunks.map((chunk, chunkIdx) => ({
          text: chunk,
          metadata: {
            fileId: fileId,
            page: pageIdx + 1,
            chunk: chunkIdx,
            userId: userId,
            folderId: folderId || null,
          },
        }));
        allChunks = [...allChunks, ...chunkObjects];
      }

      if (allChunks.length === 0) {
        throw new Error("No text chunks created from file");
      }

      console.log("Storing embeddings with fileId:", fileId, "documentId:", documentId, "with", allChunks.length, "chunks");

      // Store embeddings in vector database
      const { storeEmbeddings } = await import("@/services/VectorService");
      await storeEmbeddings(allChunks, documentId || fileId);

      console.log("Successfully processed and stored file embeddings");
      return true;
    } catch (error) {
      console.error("Error processing file:", error);
      throw error;
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
        if (onFileUploaded && typeof onFileUploaded === 'function') {
          onFileUploaded(newFolder);
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
        targetFolderId = null;
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

        // 3. Prepare file document data
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
        
        // 5. Process file for vector database in the background
        try {
          await processPdfForVectorDB(
            fileUrl, 
            bucketFile.$id, 
            newFileDoc.$id, 
            userId, 
            targetFolderId || ""
          );
          
          toast({
            title: `Successfully uploaded ${file.name}`,
            description: "File is ready for chat",
          });
        } catch (processingError) {
          console.error(`Error processing file ${file.name}:`, processingError);
          toast({
            title: `File uploaded but processing failed`,
            description: `${file.name} was uploaded but couldn't be processed for chat. Please try re-uploading.`,
            variant: "destructive",
          });
        }
        
        // 6. Notify parent component about the uploaded file
        const fileData = {
          ...bucketFile,
          ...newFileDoc,
          size: file.size,
          url: fileUrl,
          name: file.name
        };
        
        onFileUploaded(fileData);
        
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
    setTimeout(() => onClose(), 1000);
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
      if (onFileUploaded && typeof onFileUploaded === 'function') {
        onFileUploaded(newFolder);
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

  // Check if device is iOS
  const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  };

  const handleCancel = () => {
    setFiles([]);
    setUploadProgress(0);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Upload PDFs</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="upload" className="w-full flex-1 min-h-0 flex flex-col" onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload Files</TabsTrigger>
            <TabsTrigger value="folder">Upload Folder</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto p-1">
            <TabsContent value="upload" className="space-y-4 pt-4">
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 transition-colors cursor-pointer ${
                  isDragging ? 'border-primary bg-green-50' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="text-center">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-700 mb-2">
                    Drag & drop PDFs here
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    or click to browse files
                  </p>
                  <Button 
                    variant="outline" 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Select files
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.docx"
                    multiple
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Selected Files Preview */}
              {files.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-700">
                    Selected files ({files.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto space-y-2">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center min-w-0">
                          <FileText className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
                          <span className="text-sm truncate" title={file.name}>{file.name}</span>
                        </div>
                        <div className="flex items-center ml-2">
                          <Badge variant="outline" className="text-xs mr-2">
                            {(file.size / (1024 * 1024)).toFixed(1)} MB
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="text-gray-400 hover:text-red-500 p-1 h-auto"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Progress */}
              {isUploading && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Uploading... ({currentFileIndex + 1}/{totalFiles})
                    </span>
                    <span className="text-sm text-gray-500">
                      {Math.round(overallProgress)}%
                    </span>
                  </div>
                  <Progress value={overallProgress} className="h-2" />
                </div>
              )}
          </TabsContent>

          <TabsContent value="folder" className="space-y-4 pt-4">
            {/* Folder Selection UI - Hide if files are selected */}
            {!useExistingFolder && folderName && files.length === 0 && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FolderOpen className="h-5 w-5 text-blue-600 mr-2" />
                    <span className="text-sm font-medium text-blue-800">
                      Folder detected: {folderName}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUseExistingFolder(true);
                      setFolderName("");
                    }}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  Files will be uploaded to a new "{folderName}" folder
                </p>
              </div>
            )}

            {/* Folder Upload Area - Hide if files are selected */}
            {files.length === 0 && (
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 transition-colors ${
                  isDragging ? 'border-primary bg-green-50' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="text-center">
                  <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-700 mb-2">
                    Drop folder here or click to browse
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    Upload entire folders with PDF files
                  </p>
                  {!isIOS() ? (
                    <Button
                      variant="outline"
                      onClick={() => folderInputRef.current?.click()}
                      type="button"
                    >
                      <FolderOpen className="mr-2 h-4 w-4" />
                      Select Folder
                    </Button>
                  ) : (
                    <div className="text-sm text-gray-500">
                      <p>Folder upload not supported on iOS</p>
                      <p className="mt-1">Please use individual file upload</p>
                    </div>
                  )}
                  <input
                    ref={folderInputRef}
                    type="file"
                    webkitdirectory="true"
                    directory="true"
                    multiple
                    onChange={handleFolderInputChange}
                    className="hidden"
                    accept=".pdf,.txt,.docx"
                  />
                </div>
              </div>
            )}

            {/* Quick Folder Create - Hide if files are selected */}
            {!selectedFolderId && files.length === 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Or create a new folder</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowQuickFolderCreate(!showQuickFolderCreate)}
                    className="text-primary hover:text-primary/80"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {showQuickFolderCreate ? 'Cancel' : 'New Folder'}
                  </Button>
                </div>
                
                {showQuickFolderCreate && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Folder name"
                      value={quickFolderName}
                      onChange={(e) => setQuickFolderName(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleQuickFolderCreate}
                      disabled={isCreatingQuickFolder || !quickFolderName.trim()}
                      size="sm"
                    >
                      {isCreatingQuickFolder ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Create'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Selected Files Preview */}
            {files.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700">
                  Selected files ({files.length})
                </h4>
                <div className="max-h-32 overflow-y-auto space-y-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center min-w-0">
                        <FileText className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
                        <span className="text-sm truncate" title={file.name}>{file.name}</span>
                      </div>
                      <div className="flex items-center ml-2">
                        <Badge variant="outline" className="text-xs mr-2">
                          {(file.size / (1024 * 1024)).toFixed(1)} MB
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="text-gray-400 hover:text-red-500 p-1 h-auto"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Upload Destination Badge */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm font-medium text-gray-700">Upload destination:</span>
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

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Uploading... ({currentFileIndex + 1}/{totalFiles})
                  </span>
                  <span className="text-sm text-gray-500">
                    {Math.round(overallProgress)}%
                  </span>
                </div>
                <Progress value={overallProgress} className="h-2" />
              </div>
            )}
          </TabsContent>
          </div>
        </Tabs>
        
        {/* Unified Action Buttons in Dialog Footer */}
        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            disabled={isUploading}
          >
            Cancel
          </Button>
          {files.length > 0 && (
            <Button 
              onClick={uploadFilesToAppwrite}
              disabled={isUploading || files.length === 0}
              className="bg-primary hover:bg-primary/90"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload {files.length} file{files.length > 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FileUploader;