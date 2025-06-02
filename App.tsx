
import React, { useState, useEffect, useCallback } from 'react';
import { generatePixelArt, generateSurprisePrompt } from './services/geminiService';
import { quantizeImageToPixelGrid } from './utils/imageUtils';
import { LoadingIcon, ErrorIcon, ImageIcon, EditIcon } from './components/Icons';
import PixelEditor from './components/PixelEditor';

const RESOLUTION_OPTIONS = [64, 128, 256, 512] as const;
type ResolutionOption = typeof RESOLUTION_OPTIONS[number];

const ASPECT_RATIO_OPTIONS = ['1:1', '3:4', '4:3', '16:9', '9:16'] as const;
type AspectRatioOption = typeof ASPECT_RATIO_OPTIONS[number];

interface QuantizedDimensions {
  width: number;
  height: number;
}

interface AppMetadata {
  prompt?: string;
  // other metadata fields can be added here if needed
}

const App: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [selectedPixelHeight, setSelectedPixelHeight] = useState<ResolutionOption>(RESOLUTION_OPTIONS[0]);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatioOption>(ASPECT_RATIO_OPTIONS[0]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [imageToEdit, setImageToEdit] = useState<string | null>(null);
  const [quantizedDimensions, setQuantizedDimensions] = useState<QuantizedDimensions | null>(null);

  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState<boolean>(false);
  const [surprisePromptError, setSurprisePromptError] = useState<string | null>(null);

  useEffect(() => {
    // Check for API_KEY (this is also checked in geminiService before calls)
    if (!process.env.API_KEY) {
      setApiKeyMissing(true);
      console.warn("API_KEY environment variable is not set. Image generation will not work.");
    }

    // Fetch metadata.json to potentially set an initial prompt
    fetch('/metadata.json')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json() as Promise<AppMetadata>;
      })
      .then(data => {
        if (data && typeof data.prompt === 'string' && data.prompt.trim() !== '') {
          setPrompt(data.prompt);
        }
      })
      .catch(err => {
        console.warn("Could not load or parse metadata.json for initial prompt:", err);
        // It's not critical if metadata.json isn't found or is malformed for this feature.
      });
  }, []); // Empty dependency array ensures this runs once on mount

  const parseAspectRatio = (aspectRatioString: AspectRatioOption): { w: number, h: number } => {
    const [w, h] = aspectRatioString.split(':').map(Number);
    return { w, h };
  };

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt to generate an image.');
      return;
    }
    if (apiKeyMissing) {
      setError('API Key is missing. Please configure it in your environment.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSurprisePromptError(null);
    setGeneratedImage(null);
    setQuantizedDimensions(null);
    setIsEditing(false);

    try {
      const rawImageUrl = await generatePixelArt(prompt, selectedAspectRatio);

      const aspectRatio = parseAspectRatio(selectedAspectRatio);
      const targetHeight = selectedPixelHeight;
      const targetWidth = Math.round(targetHeight * (aspectRatio.w / aspectRatio.h));

      if (targetWidth <= 0 || targetHeight <= 0) {
        throw new Error("Calculated target dimensions for quantization are invalid (zero or negative).");
      }

      const processedImageUrl = await quantizeImageToPixelGrid(rawImageUrl, targetWidth, targetHeight);
      setGeneratedImage(processedImageUrl);
      setQuantizedDimensions({ width: targetWidth, height: targetHeight });

    } catch (err) {
      console.error('Error generating or processing pixel art:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  }, [prompt, apiKeyMissing, selectedPixelHeight, selectedAspectRatio]);

  const handleEditClick = () => {
    if (generatedImage) {
      setImageToEdit(generatedImage);
      setIsEditing(true);
    }
  };

  const handleSaveEdit = (editedImageDataUrl: string) => {
    setGeneratedImage(editedImageDataUrl);
    setIsEditing(false);
    setImageToEdit(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setImageToEdit(null);
  };

  const handleSurpriseMeClick = async () => {
    if (apiKeyMissing) {
      setSurprisePromptError('API Key is missing. Cannot generate surprise prompt.');
      return;
    }
    setIsGeneratingPrompt(true);
    setSurprisePromptError(null);
    setError(null);
    try {
      const creativePrompt = await generateSurprisePrompt();
      setPrompt(creativePrompt);
    } catch (err) {
      console.error('Error generating surprise prompt:', err);
      setSurprisePromptError(err instanceof Error ? err.message : 'Could not generate a surprise prompt.');
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const getResolutionButtonSizeClasses = (height: ResolutionOption): string => {
    switch (height) {
      case 64: return 'h-10 min-w-[4.5rem] sm:min-w-[5rem]';
      case 128: return 'h-11 min-w-[4.5rem] sm:min-w-[5rem]';
      case 256: return 'h-12 min-w-[4.5rem] sm:min-w-[5rem]';
      case 512: return 'h-14 min-w-[4.5rem] sm:min-w-[5rem]';
      default: return 'h-10 min-w-[4.5rem] sm:min-w-[5rem]';
    }
  };

  const getAspectRatioButtonSizeClasses = (ratio: AspectRatioOption): string => {
    switch (ratio) {
      case '1:1': return 'w-11 h-11';
      case '3:4': return 'w-9 h-12';
      case '4:3': return 'w-12 h-9';
      case '16:9': return 'w-16 h-10'; // Adjusted for better text fit and clickability
      case '9:16': return 'w-10 h-16'; // Adjusted for better text fit and clickability
      default: return 'w-11 h-11';
    }
  };


  return (
    <div className="min-h-screen text-sky-200 flex flex-col items-center p-4 selection:bg-fuchsia-600 selection:text-white">
      <header
        className="galaxy-header-bg w-full max-w-4xl mb-6 md:mb-8 py-8 md:py-12 rounded-lg border-b-4 border-indigo-700 shadow-2xl"
      >
        <div className="text-center">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-white tracking-widest" style={{ textShadow: '3px 3px 8px rgba(0,0,0,0.9)' }}>
            Unipixelverse
          </h1>
        </div>
      </header>

      <div className="w-full max-w-2xl bg-slate-900 p-4 sm:p-6 md:p-8 rounded-lg shadow-2xl border-2 border-indigo-600 transform transition-all duration-500 hover:scale-105">
        {apiKeyMissing && (
          <div className="mb-4 p-3 bg-red-700 border border-red-500 text-yellow-300 rounded-md text-center text-sm">
            Warning: API_KEY environment variable is not set. Image generation is disabled.
          </div>
        )}

        {!isEditing && (
          <>
            <div className="mb-4">
              <label htmlFor="resolution-selector" className="block text-lg sm:text-xl mb-2 text-indigo-300">Pixel Grid Height:</label>
              <div id="resolution-selector" className="flex flex-wrap gap-2 sm:gap-3 justify-center mb-4 items-end" role="group" aria-label="Pixel grid height">
                {RESOLUTION_OPTIONS.map((height) => {
                  const sizeClasses = getResolutionButtonSizeClasses(height);
                  return (
                    <button
                      key={height}
                      onClick={() => setSelectedPixelHeight(height)}
                      disabled={isLoading || isGeneratingPrompt}
                      className={`px-2 sm:px-3 text-base sm:text-lg font-bold rounded-md transition-all duration-200 border-2 flex items-center justify-center
                        ${sizeClasses}
                        ${selectedPixelHeight === height
                          ? 'bg-sky-500 text-white border-sky-400 ring-2 ring-sky-300 scale-105'
                          : 'bg-slate-700 text-indigo-300 border-indigo-500 hover:bg-indigo-600 hover:text-white hover:border-indigo-400'
                        }
                        ${(isLoading || isGeneratingPrompt) ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                      aria-pressed={selectedPixelHeight === height}
                      aria-label={`Set pixel grid height to ${height} pixels`}
                    >
                      <span className="flex-shrink-0">{height}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="aspect-ratio-selector" className="block text-lg sm:text-xl mb-2 text-indigo-300">Aspect Ratio:</label>
              <div id="aspect-ratio-selector" className="flex flex-wrap gap-2 sm:gap-3 justify-center mb-4 items-center" role="group" aria-label="Image aspect ratio">
                {ASPECT_RATIO_OPTIONS.map(ratio => {
                  const sizeClasses = getAspectRatioButtonSizeClasses(ratio);
                  return (
                    <button
                      key={ratio}
                      onClick={() => setSelectedAspectRatio(ratio)}
                      disabled={isLoading || isGeneratingPrompt}
                      className={`p-1 text-base sm:text-lg font-bold rounded-md transition-all duration-200 border-2 flex items-center justify-center
                        ${sizeClasses}
                        ${selectedAspectRatio === ratio
                          ? 'bg-sky-500 text-white border-sky-400 ring-2 ring-sky-300 scale-105'
                          : 'bg-slate-700 text-indigo-300 border-indigo-500 hover:bg-indigo-600 hover:text-white hover:border-indigo-400'
                        }
                        ${(isLoading || isGeneratingPrompt) ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                      aria-pressed={selectedAspectRatio === ratio}
                      aria-label={`Set aspect ratio to ${ratio}`}
                    >
                       <span className="flex-shrink-0">{ratio}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="prompt" className="block text-lg sm:text-xl mb-2 text-indigo-300">Enter your vision:</label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., a cosmic owl nebula, vibrant colors"
                rows={3}
                className="w-full p-3 bg-slate-800 border-2 border-indigo-500 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none text-base sm:text-lg placeholder-slate-500 resize-none text-sky-100"
                disabled={isLoading || isGeneratingPrompt}
                aria-label="Image generation prompt"
              />
              {prompt.trim() === '' && !isEditing && (
                <div className="mt-2">
                  <button
                    onClick={handleSurpriseMeClick}
                    disabled={isGeneratingPrompt || isLoading || apiKeyMissing}
                    className={`w-full py-2 px-4 text-lg font-semibold rounded-md transition-all duration-300 ease-in-out
                      bg-teal-500 hover:bg-teal-600 text-white focus:ring-4 focus:ring-teal-300 transform hover:scale-105 active:scale-95
                      disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed`}
                    aria-live="polite"
                  >
                    {isGeneratingPrompt ? (
                      <span className="flex items-center justify-center">
                        <LoadingIcon className="mr-2 h-5 w-5" />
                        Sparking Idea...
                      </span>
                    ) : (
                      '✨ Surprise Me!'
                    )}
                  </button>
                  {surprisePromptError && (
                    <div role="alert" className="mt-1 p-1.5 bg-red-900 border border-red-700 text-yellow-200 rounded-md text-center text-xs">
                      <p>{surprisePromptError}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleGenerate}
              disabled={isLoading || apiKeyMissing || isGeneratingPrompt || prompt.trim() === ''}
              className={`w-full py-2.5 sm:py-3 px-4 sm:px-6 text-xl sm:text-2xl font-bold rounded-md transition-all duration-300 ease-in-out
                ${isLoading || apiKeyMissing || isGeneratingPrompt || prompt.trim() === ''
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  : 'bg-fuchsia-600 hover:bg-fuchsia-700 text-white focus:ring-4 focus:ring-fuchsia-400 transform hover:scale-105 active:scale-95'
                }`}
              aria-live="polite"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <LoadingIcon className="mr-2 h-5 sm:h-6 w-5 sm:w-6" />
                  Conjuring Pixels...
                </span>
              ) : (
                'Generate Pixel Art'
              )}
            </button>
          </>
        )}

        {error && !isEditing && (
          <div role="alert" className="mt-6 p-3 sm:p-4 bg-red-800 border border-red-600 text-yellow-300 rounded-md flex items-center justify-center text-center">
            <ErrorIcon className="mr-2 h-5 sm:h-6 w-5 sm:w-6" />
            <p className="text-base sm:text-lg">{error}</p>
          </div>
        )}

        {generatedImage && !isEditing && quantizedDimensions && (
          <div className="mt-8 p-1 bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-500 rounded-lg shadow-xl">
            <div className="bg-slate-800 p-3 sm:p-4 rounded-md">
              <h2 className="text-xl sm:text-2xl text-center mb-3 sm:mb-4 text-indigo-300">
                Your Pixel Masterpiece ({quantizedDimensions.width}x{quantizedDimensions.height}):
              </h2>
              <img
                src={generatedImage}
                alt={`Generated pixel art with aspect ratio ${selectedAspectRatio}, quantized to ${quantizedDimensions.width}x${quantizedDimensions.height} pixels`}
                className="w-full max-w-xs sm:max-w-sm md:max-w-md mx-auto rounded-md border-2 border-sky-400 object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
              <button
                onClick={handleEditClick}
                className="mt-4 w-full py-2 px-4 text-base sm:text-lg font-semibold rounded-md transition-all duration-300 ease-in-out bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-4 focus:ring-indigo-400 flex items-center justify-center transform hover:scale-105 active:scale-95"
                aria-label="Edit generated image"
              >
                <EditIcon className="mr-2 h-4 sm:h-5 w-4 sm:w-5" />
                Edit Image
              </button>
            </div>
          </div>
        )}

        {!generatedImage && !isLoading && !error && !isEditing && (
            <div className="mt-8 text-center text-slate-500">
                <ImageIcon className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-2"/>
                <p className="text-base sm:text-lg">Your generated image will appear here.</p>
            </div>
        )}

        {isEditing && imageToEdit && (
          <PixelEditor
            imageDataUrl={imageToEdit}
            onSave={handleSaveEdit}
            onCancel={handleCancelEdit}
          />
        )}
      </div>
      <footer className="mt-8 text-center text-xs sm:text-sm text-indigo-400">
        <p>&copy; {new Date().getFullYear()} Unipixelverse. Powered by Google Imagen & Gemini.</p>
      </footer>
    </div>
  );
};

export default App;
