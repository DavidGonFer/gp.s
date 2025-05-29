
import { GoogleGenAI, GenerateImagesResponse } from "@google/genai";

const apiKey = process.env.API_KEY;

if (!apiKey) {
  console.error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "MISSING_API_KEY" }); 

export async function generatePixelArt(userPrompt: string, aspectRatio: string): Promise<string> {
  if (!apiKey) {
    throw new Error("API Key is not configured. Cannot generate images.");
  }

  const fullPrompt = `${userPrompt}, 8-bit pixel art style, detailed, vibrant colors, classic video game art`;

  try {
    const response: GenerateImagesResponse = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: fullPrompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/png',
        aspectRatio: aspectRatio,
      },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      const firstImageResult = response.generatedImages[0];

      if (firstImageResult.image?.imageBytes) {
        return `data:image/png;base64,${firstImageResult.image.imageBytes}`;
      } else if (firstImageResult.error) {
        console.error("Image generation error from API:", firstImageResult.error);
        throw new Error(`Image generation failed: ${firstImageResult.error.message} (Code: ${firstImageResult.error.code})`);
      } else {
        let detailMessage = "No image data received.";
        if (firstImageResult.finishReason && firstImageResult.finishReason !== "SUCCESS") {
          detailMessage += ` Generation finished due to: ${firstImageResult.finishReason}.`;
        }
        
        if (firstImageResult.safetyRatings && firstImageResult.safetyRatings.some(rating => rating.blocked === true)) {
          const blockedCategories = firstImageResult.safetyRatings
            .filter(r => r.blocked)
            .map(r => r.category)
            .join(', ');
          detailMessage += ` Image was likely blocked by safety filters. Affected categories: ${blockedCategories || 'unknown'}.`;
          console.warn("Image blocked by safety filters. Details:", firstImageResult.safetyRatings);
        }
        console.error(`Image generation issue. Details: ${detailMessage}`, firstImageResult);
        throw new Error(`Image generation failed. ${detailMessage}`);
      }
    } else {
      console.error("API returned no images in the response array.", response);
      throw new Error('Image generation failed: The API returned no images in the response. This could be due to a general API issue or a problem with the request configuration.');
    }
  } catch (error) {
    console.error('Gemini API call or response processing failed:', error); 
    if (error instanceof Error) {
      if (error.message.includes("API_KEY_INVALID") || error.message.includes("API key not valid")) {
        throw new Error("API Key is invalid. Please check your Google AI Studio configuration and ensure the key is correct and enabled.");
      }
      if (error.message.includes("PERMISSION_DENIED")) {
        throw new Error("Permission denied. Ensure the API key has the necessary permissions for the Imagen API.");
      }
      if (error.message.toLowerCase().includes("quota") || error.message.includes("RESOURCE_EXHAUSTED")) {
        throw new Error("You have exceeded your API quota or rate limit. Please check your usage limits.");
      }
      
      const knownErrorPatterns = [
        "Image generation failed:",
        "API Key is not configured",
        "API Key is invalid",
        "Permission denied",
        "You have exceeded your API quota"
      ];
      if (knownErrorPatterns.some(pattern => error.message.startsWith(pattern))) {
         throw error; 
      }
      throw new Error(`Failed to generate pixel art: ${error.message}`);
    }
    throw new Error('An unknown error occurred during image generation.');
  }
}

export async function generateSurprisePrompt(): Promise<string> {
  if (!apiKey) {
    throw new Error("API Key is not configured. Cannot generate prompt.");
  }

  const internalPrompt = "Generate a short, creative, and fun pixel art prompt. Maximum 15 words. Focus on themes like: cosmic wonders, fantasy creatures, cute animals, retro tech, or magical landscapes. The prompt should be suitable for generating 8-bit style pixel art. Examples: 'A tiny astronaut kitten discovering a crystal moon', 'A smiling retro robot surfing on a data wave', 'Enchanted forest with glowing mushrooms and a hidden path'.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: internalPrompt,
      // config: { temperature: 0.8 } // Example config for creativity
    });

    const text = response.text;
    if (!text || text.trim() === '') {
      console.warn("Gemini API returned an empty string for surprise prompt.");
      throw new Error("Received an empty prompt from the AI. Please try again.");
    }
    // Remove potential markdown quotes if any
    return text.trim().replace(/^["']|["']$/g, '');
  } catch (error) {
    console.error('Gemini API call for surprise prompt failed:', error);
    if (error instanceof Error) {
      if (error.message.includes("API_KEY_INVALID") || error.message.includes("API key not valid")) {
        throw new Error("API Key is invalid for prompt generation.");
      }
       if (error.message.toLowerCase().includes("quota") || error.message.includes("RESOURCE_EXHAUSTED")) {
        throw new Error("You have exceeded your API quota for text generation.");
      }
      throw new Error(`Failed to generate surprise prompt: ${error.message}`);
    }
    throw new Error('An unknown error occurred while generating surprise prompt.');
  }
}
