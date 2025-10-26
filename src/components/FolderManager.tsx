import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Folder, Plus, MessageSquare } from 'lucide-react'; // Add MessageSquare import
import { getFoldersByUserId } from '@/lib/appwrite/databases';
import { getCurrentUser } from '@/lib/appwrite/auth';

interface FolderManagerProps {
  onFolderSelect: (folderId: string, folderName: string) => void;
  selectedFolderId: string | null;
  onCreateNewFolder: () => void;
  folders: any[]; // Accept folders as props
  isLoading?: boolean;
  onChatWithFolder?: (folderId: string, folderName: string) => void; // Add this prop
}

const FolderManager: React.FC<FolderManagerProps> = ({ 
  onFolderSelect, 
  selectedFolderId,
  onCreateNewFolder,
  folders = [], // Default to empty array
  isLoading = false,
  onChatWithFolder // Add this prop
}) => {
  const { toast } = useToast();

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex justify-between items-center">
          <span>Your Folders</span>
          <Button 
            onClick={onCreateNewFolder} 
            variant="ghost" 
            size="sm"
            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
          >
            <Plus className="h-4 w-4 mr-1" /> New Folder
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
          {isLoading ? (
            <div className="text-center py-4">Loading folders...</div>
          ) : folders.length > 0 ? (
            folders.map((folder) => (
              <div key={folder.$id} className="mb-2">
                <div
                  className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                    selectedFolderId === folder.$id
                      ? 'bg-purple-100'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <div 
                    className="flex items-center flex-grow"
                    onClick={() => onFolderSelect(folder.$id, folder.name)}
                  >
                    <Folder className="h-5 w-5 text-purple-600 mr-2" />
                    <span className="text-sm font-medium">{folder.name}</span>
                  </div>
                  {onChatWithFolder && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChatWithFolder(folder.$id, folder.name);
                      }}
                      className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-gray-500">
              No folders yet. Create your first folder to organize your PDFs.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default FolderManager;