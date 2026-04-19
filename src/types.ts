export type ChatMessage = {
  role: 'user' | 'model';
  content: string;
};

export type FishboneData = {
  Man: string[];
  Machine: string[];
  Material: string[];
  Method: string[];
  Measurement: string[];
  Environment: string[];
};

export type DeepAnalysis = {
  fishbone: FishboneData;
  closures: string[];
  documentation: string;
};

export type SafetyIssue = {
  id: string;
  timestamp: number;
  updatedAt: number;
  image: string; // base64
  initialAnalysis: string;
  chatHistory: ChatMessage[];
  finalStatement: string;
  deepAnalysis?: DeepAnalysis;
};

export type PlantKnowledge = {
  id: string;
  title: string;
  content: string;
  category: 'machinery' | 'protocol' | 'facility' | 'other';
};
