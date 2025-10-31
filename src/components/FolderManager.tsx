import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Folder, Plus, MessageSquare } from 'lucide-react';
import { getFoldersByUserId } from '@/lib/appwrite/databases';
import { getCurrentUser } from '@/lib/appwrite/auth';

interface FolderManagerProps {
  onFolderSelect: (folderId: string, folderName: string) => void;
  selectedFolderId: string | null;
  onCreateNewFolder: () => void;
  folders: any[];
  isLoading?: boolean;
  onChatWithFolder?: (folderId: string, folderName: string) => void;
}

const FolderManager: React.FC<FolderManagerProps> = ({ 
  onFolderSelect, 
  selectedFolderId,
  onCreateNewFolder,
  folders = [],
  isLoading = false,
  onChatWithFolder
}) => {
  const { toast } = useToast();

  return (
    <Card className="mb-6 shadow-sm border-gray-100">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex justify-between items-center">
          <span className="text-gray-800">Your Folders</span>
          <Button 
            onClick={onCreateNewFolder} 
            variant="ghost" 
            size="sm"
            className="text-primary hover:text-primary/80 hover:bg-green-50 px-3 py-1.5 h-auto text-sm font-medium rounded-lg"
          >
            <Plus className="h-4 w-4 mr-1" /> New Folder
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          ) : folders.length > 0 ? (
            folders.map((folder) => (
              <div key={folder.$id} className="mb-2">
                <div
                  className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all duration-200 border ${
                    selectedFolderId === folder.$id
                      ? 'bg-green-50 border-green-200 shadow-sm'
                      : 'hover:bg-gray-50 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div 
                    className="flex items-center flex-grow min-w-0"
                    onClick={() => onFolderSelect(folder.$id, folder.name)}
                  >
                    <div className="flex-shrink-0 mr-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        selectedFolderId === folder.$id 
                          ? 'bg-green-100' 
                          : 'bg-green-50'
                      }`}>
                        <Folder className={`h-5 w-5 ${
                          selectedFolderId === folder.$id 
                            ? 'text-green-700' 
                            : 'text-green-600'
                        }`} />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className={`text-sm font-medium block truncate ${
                        selectedFolderId === folder.$id 
                          ? 'text-green-900' 
                          : 'text-gray-800'
                      }`}>
                        {folder.name}
                      </span>
                      {folder.description && (
                        <p className="text-xs text-gray-500 truncate mt-1">
                          {folder.description}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Always show the chat button if onChatWithFolder is provided */}
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onChatWithFolder) {
                        onChatWithFolder(folder.$id, folder.name);
                      }
                    }}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50 p-2 h-auto rounded-lg ml-2 flex-shrink-0"
                    title="Chat with folder"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="mb-4">
                <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto">
                  <Folder className="h-6 w-6 text-gray-400" />
                </div>
              </div>
              <p className="text-sm font-medium mb-2">No folders yet</p>
              <p className="text-xs text-gray-400">Create your first folder to organize your PDFs</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default FolderManager;