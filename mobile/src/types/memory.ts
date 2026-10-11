export type TripMemoryItem = {
  id: string;
  tripId: string;
  mediaType: 'image' | 'video';
  mimeType: string;
  byteSize: number;
  originalFilename: string;
  caption: string;
  capturedAt: string | null;
  createdAt: string;
  updatedAt: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  objectKey: string;
  thumbnailObjectKey: string | null;
  uploader: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
};

export type TripMemoriesPage = {
  items: TripMemoryItem[];
  nextCursor: string | null;
  total: number;
  photoCount: number;
  videoCount: number;
};

export type MemoryFilter = 'all' | 'image' | 'video';
