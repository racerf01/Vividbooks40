export type MediaType = 'image' | 'lottie';

export interface LottieStep {
  id: string;
  url: string;
  title?: string; // Optional title for tooltip/admin
  description?: string; // AI-generated description of what happens in the animation
  detailedDescription?: string; // Detailed step-by-step description
  keywords?: string[]; // Keywords for RAG search (e.g., ["Hmota", "Atomy", "DNA"])
}

export interface SectionMediaItem {
  id: string; // Unique ID
  heading: string; // The H2 text to attach to
  type: MediaType;
  
  // Image specific
  imageUrl?: string;
  imageDescription?: string; // AI-generated description for images
  
  // Lottie specific
  lottieConfig?: {
    introUrl?: string; // Optional intro animation that plays once
    introDescription?: string; // Description of intro animation
    steps: LottieStep[]; // List of main animations
    shouldLoop: boolean; // Default loop setting
    autoplay: boolean;
    backgroundImage?: string; // Background image URL (for transparent Lottie animations)
  };
}
