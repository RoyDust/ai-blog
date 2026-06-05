export type CoverAsset = {
  id: string;
  url: string;
  key?: string | null;
  provider: string;
  source: string;
  generatedByAi: boolean;
  status: string;
  title?: string | null;
  alt?: string | null;
  description?: string | null;
  tags: string[];
  usageCount: number;
  lastUsedAt?: string | null;
  createdAt: string;
};

export type CoverAssetListResponse = {
  items: CoverAsset[];
  total: number;
  page: number;
  limit: number;
};
