
import React, { useState, useEffect, useRef, useCallback } from 'react';

interface PixelEditorProps {
  imageDataUrl: string;
  onSave: (editedImageDataUrl: string) => void;
  onCancel: () => void;
}

const COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
  '#00FFFF', '#FF00FF', '#C0C0C0', '#808080', '#800000', '#808000',
  '#008000', '#800080', '#008080', '#000080', '#FFA500', '#A52A2A',
  '#FFC0CB', '#E6E6FA', '#4B0082', '#001F3F', '#F0E68C', '#7CFC00'
];

const INITIAL_PIXEL_SCALE_FACTOR = 15; 
const MAX_CANVAS_DISPLAY_SIZE = 480; 
const DRAWING_BLOCK_SIZE = 1; 

const PixelEditor: React.FC<PixelEditorProps> = ({ imageDataUrl, onSave, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedColor, setSelectedColor] = useState<string>(COLORS[0]);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null);
  const [displayDimensions, setDisplayDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = imageDataUrl;
    image.onload = () => {
      const { naturalWidth, naturalHeight } = image;
      setOriginalDimensions({ width: naturalWidth, height: naturalHeight });

      if (naturalWidth === 0 || naturalHeight === 0) {
        setDisplayDimensions({ width: 0, height: 0 });
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.width = 0;
            canvas.height = 0;
        }
        console.warn("PixelEditor received an image with zero dimensions.");
        return;
      }

      // Calculate scale based on MAX_CANVAS_DISPLAY_SIZE but prioritize initial scale if image is small
      const scaleToFitW = naturalWidth > 0 ? MAX_CANVAS_DISPLAY_SIZE / naturalWidth : INITIAL_PIXEL_SCALE_FACTOR;
      const scaleToFitH = naturalHeight > 0 ? MAX_CANVAS_DISPLAY_SIZE / naturalHeight : INITIAL_PIXEL_SCALE_FACTOR;
      
      let finalPixelPerfectScale = Math.floor(Math.min(INITIAL_PIXEL_SCALE_FACTOR, scaleToFitW, scaleToFitH));
      finalPixelPerfectScale = Math.max(1, finalPixelPerfectScale); 

      const newDisplayWidth = naturalWidth * finalPixelPerfectScale;
      const newDisplayHeight = naturalHeight * finalPixelPerfectScale;

      setDisplayDimensions({
        width: newDisplayWidth,
        height: newDisplayHeight,
      });
      
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = naturalWidth; 
        canvas.height = naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false; 
          ctx.drawImage(image, 0, 0, naturalWidth, naturalHeight);
        }
      }
    };
    image.onerror = (e) => {
      console.error("Error loading image for editor:", e);
      onCancel(); 
    };
  }, [imageDataUrl, onCancel]);

  const getDrawCoordinates = useCallback((event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !originalDimensions || !displayDimensions || displayDimensions.width === 0 || displayDimensions.height === 0) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    const nativeEv = event.nativeEvent;
    if ('touches' in nativeEv && nativeEv.touches.length > 0) {
        clientX = nativeEv.touches[0].clientX;
        clientY = nativeEv.touches[0].clientY;
    } else if ('clientX' in nativeEv) { 
        clientX = nativeEv.clientX;
        clientY = nativeEv.clientY;
    } else { 
        return null;
    }

    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    
    const mappedX = (canvasX / displayDimensions.width) * originalDimensions.width;
    const mappedY = (canvasY / displayDimensions.height) * originalDimensions.height;

    const pixelCol = Math.floor(mappedX / DRAWING_BLOCK_SIZE);
    const pixelRow = Math.floor(mappedY / DRAWING_BLOCK_SIZE);

    const drawStartX = pixelCol * DRAWING_BLOCK_SIZE;
    const drawStartY = pixelRow * DRAWING_BLOCK_SIZE;

    return { x: drawStartX, y: drawStartY };
  }, [originalDimensions, displayDimensions]);


  const draw = useCallback((event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const drawCoords = getDrawCoordinates(event);
    if (!drawCoords) return;

    const { x, y } = drawCoords; 
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (ctx && originalDimensions) {
        if (x < originalDimensions.width && y < originalDimensions.height) {
            ctx.fillStyle = selectedColor;
            const effectiveBlockWidth = Math.min(DRAWING_BLOCK_SIZE, originalDimensions.width - x);
            const effectiveBlockHeight = Math.min(DRAWING_BLOCK_SIZE, originalDimensions.height - y);
            ctx.fillRect(x, y, effectiveBlockWidth, effectiveBlockHeight);
        }
    }
  }, [getDrawCoordinates, selectedColor, originalDimensions]);

  const handleInteractionStart = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (event.nativeEvent.cancelable && (event.type === 'touchstart' || event.type === 'touchmove')) {
      event.preventDefault();
    }
    setIsDrawing(true);
    draw(event);
  };
  
  const handleInteractionMove = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (event.nativeEvent.cancelable && (event.type === 'touchstart' || event.type === 'touchmove')) {
      event.preventDefault();
    }
    if (!isDrawing) return;
    draw(event);
  };

  const handleInteractionEnd = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
     if (event.nativeEvent.cancelable && event.type === 'touchend') {
      event.preventDefault();
    }
    setIsDrawing(false);
  };
  
  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL('image/png'));
    }
  };

  return (
    <div className="mt-6 w-full flex flex-col items-center" role="dialog" aria-labelledby="editor-title">
      <h2 id="editor-title" className="text-xl sm:text-2xl text-center mb-4 text-indigo-300">Pixel Editor</h2>
      
      <div 
        className="mb-4 p-0 bg-slate-800 rounded-md inline-block leading-none shadow-lg"
        style={{
            width: displayDimensions ? `${displayDimensions.width}px` : 'auto',
            height: displayDimensions ? `${displayDimensions.height}px` : 'auto',
            maxWidth: '100%', // Ensures the canvas container shrinks on small screens
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleInteractionStart}
          onMouseMove={handleInteractionMove}
          onMouseUp={handleInteractionEnd}
          onTouchStart={handleInteractionStart}
          onTouchMove={handleInteractionMove}
          onTouchEnd={handleInteractionEnd}
          className="border-2 border-sky-500 cursor-crosshair"
          style={{
            imageRendering: 'pixelated', 
            width: '100%', // Canvas fills its parent div
            height: '100%', // Canvas fills its parent div
            display: 'block', 
            touchAction: 'none',
          }}
          aria-label="Pixel art editing canvas"
        />
      </div>

      <div className="mb-4 w-full max-w-xs sm:max-w-sm md:max-w-md">
        <label htmlFor="color-palette" className="block text-base sm:text-lg mb-1 text-indigo-300 text-center sm:text-left">Color Palette:</label>
        <div 
          id="color-palette" 
          className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1 p-2 bg-slate-800 rounded-md mx-auto sm:mx-0" 
          role="radiogroup" 
          aria-label="Color palette"
        >
          {COLORS.map(color => (
            <button
              key={color}
              type="button"
              onClick={() => setSelectedColor(color)}
              className={`w-6 h-6 sm:w-7 sm:h-7 rounded border-2 transition-all duration-150 ease-in-out 
                ${selectedColor === color ? 'border-fuchsia-500 ring-2 ring-fuchsia-400 scale-110 shadow-md' : 'border-slate-600 hover:border-slate-400'}`}
              style={{ backgroundColor: color }}
              aria-label={`Select color ${color}`}
              aria-pressed={selectedColor === color}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 w-full max-w-xs sm:max-w-sm">
        <button
          onClick={handleSave}
          className="flex-1 py-2 px-4 text-base sm:text-lg font-semibold rounded-md transition-colors duration-150 bg-green-600 hover:bg-green-700 text-white focus:ring-4 focus:ring-green-400"
          aria-label="Save edited image"
        >
          Save Changes
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-2 px-4 text-base sm:text-lg font-semibold rounded-md transition-colors duration-150 bg-slate-600 hover:bg-slate-500 text-white focus:ring-4 focus:ring-slate-400"
          aria-label="Cancel editing"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default PixelEditor;
