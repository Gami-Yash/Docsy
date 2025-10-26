
export interface FileDocument {
  $id: string;
  $collectionId: string;
  $databaseId: string;
  $createdAt: string;
  $updatedAt: string;
  $permissions: string[];
  fileID: string;  // The field that stores the actual file ID
  fileName: string;
  size: number;
  url: string;
  folders?: string;
  users: string;
}
