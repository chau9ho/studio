import { useState, useCallback, useRef, RefObject } from 'react';
import type { ToastFunction } from '@/hooks/use-toast'; // Adjust if path differs
import { FRAME_WIDTH, FRAME_HEIGHT, TARGET_CONTENT_WIDTH, TARGET_CONTENT_HEIGHT, TARGET_CONTENT_START_Y } from '@/components/app/SakuraPetFramesApp'; // Import constants

export function useGeneration(
    finalCanvasRef: RefObject<HTMLCanvasElement>,
    frameImageRef: RefObject<HTMLImageElement>,
    toast: ToastFunction
) {
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [progressText, setProgressText] = useState<string>('');
    const [finalFramedImage, setFinalFramedImage] = useState<string | null>(null); // Data URL
    const [finalGcsUrl, setFinalGcsUrl] = useState<string | null>(null); // Public GCS URL
    const [generatedStory, setGeneratedStory] = useState<string>('');
    const [uiError, setUiError] = useState<string | null>(null);

    const clearGenerationStates = useCallback(() => {
        setIsGenerating(false);
        setIsUploading(false);
        setProgress(0);
        setProgressText('');
        setFinalFramedImage(null);
        setFinalGcsUrl(null);
        setGeneratedStory('');
        setUiError(null);
        console.log("Cleared all generation-related states.");
    }, []);

      // Frame the image (moved from SakuraPetFramesApp)
     const frameImage = useCallback((processedImageSrc: string): Promise<string> => {
         return new Promise<string>((resolve, reject) => {
             console.log("Starting image framing process...");
             if (!finalCanvasRef.current) {
                 const errorMsg = "相框畫布未準備好。";
                 console.error(errorMsg);
                 setUiError(errorMsg);
                 reject(new Error("Canvas not ready"));
                 return;
             }
             if (!frameImageRef.current || !frameImageRef.current.complete || frameImageRef.current.naturalWidth === 0) {
                 const errorMsg = "相框圖片載入失敗或無效。";
                 console.error(errorMsg);
                 setUiError(errorMsg);
                 reject(new Error("Frame image not ready"));
                 return;
             }

             const canvas = finalCanvasRef.current;
             const ctx = canvas.getContext('2d');
             const frameImg = frameImageRef.current;

             if (!ctx) {
                 const errorMsg = "無法獲取畫布上下文。";
                 console.error(errorMsg);
                 setUiError(errorMsg);
                 reject(new Error("Could not get canvas context"));
                 return;
             }

             canvas.width = FRAME_WIDTH;
             canvas.height = FRAME_HEIGHT;
             console.log(`Canvas dimensions set to ${FRAME_WIDTH}x${FRAME_HEIGHT}`);

             try {
                 ctx.clearRect(0, 0, canvas.width, canvas.height);
                 ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height); // Draw the white frame
                 console.log("Frame image drawn onto canvas.");
             } catch (drawError) {
                 const errorMsg = "無法繪製相框圖片。";
                 console.error("Error drawing frame image onto canvas:", drawError);
                 setUiError(errorMsg);
                 reject(new Error("Failed to draw frame image on canvas"));
                 return;
             }

             console.log("Loading processed image for drawing...");
             const processedImg = new window.Image();
             processedImg.onload = () => {
                 console.log(`Processed image loaded: ${processedImg.naturalWidth}x${processedImg.naturalHeight}`);

                 const targetWidth = TARGET_CONTENT_WIDTH;
                 const targetHeight = TARGET_CONTENT_HEIGHT;
                 const targetX = (FRAME_WIDTH - targetWidth) / 2;
                 const targetY = TARGET_CONTENT_START_Y;

                 const imgRatio = processedImg.naturalWidth / processedImg.naturalHeight;
                 const targetRatio = targetWidth / targetHeight;

                 let sourceX = 0, sourceY = 0, sourceWidth = processedImg.naturalWidth, sourceHeight = processedImg.naturalHeight;
                 let drawWidth = targetWidth, drawHeight = targetHeight;

                 // Crop and scale logic (Cover the target area)
                 if (imgRatio > targetRatio) {
                     // Image is wider than target, fit height, crop width
                     sourceWidth = processedImg.naturalHeight * targetRatio;
                     sourceX = (processedImg.naturalWidth - sourceWidth) / 2;
                 } else {
                     // Image is taller than target, fit width, crop height
                     sourceHeight = processedImg.naturalWidth / targetRatio;
                     sourceY = (processedImg.naturalHeight - sourceHeight) / 2;
                 }

                 console.log(`Target area: W=${targetWidth}, H=${targetHeight} at X=${targetX}, Y=${targetY}`);
                 console.log(`Source crop: X=${sourceX.toFixed(2)}, Y=${sourceY.toFixed(2)}, W=${sourceWidth.toFixed(2)}, H=${sourceHeight.toFixed(2)}`);
                 console.log(`Draw dimensions: W=${drawWidth.toFixed(2)}, H=${drawHeight.toFixed(2)}`);

                 try {
                     // Draw the cropped and scaled pet image onto the canvas
                     ctx.drawImage(
                         processedImg,
                         sourceX, sourceY, sourceWidth, sourceHeight,
                         targetX, targetY, drawWidth, drawHeight
                     );
                     console.log("Processed image drawn onto canvas over the frame.");

                     const finalDataUrl = canvas.toDataURL('image/png');
                     console.log("Final image generated as Data URL.");
                     resolve(finalDataUrl);
                 } catch (drawError) {
                     const errorMsg = "無法繪製最終寵物圖片。";
                     console.error("Error drawing processed image onto canvas:", drawError);
                      setUiError(errorMsg);
                     reject(new Error("Failed to draw processed image on canvas"));
                 }
             };
             processedImg.onerror = (e) => {
                 const errorMsg = "無法載入已處理嘅寵物圖片。";
                 console.error("Failed to load processed image for framing:", e);
                 setUiError(errorMsg);
                 reject(new Error("Failed to load processed image"));
             };
             if (processedImageSrc && typeof processedImageSrc === 'string' && processedImageSrc.startsWith('data:image')) {
                 console.log("Assigning processed image source to Image object.");
                 processedImg.src = processedImageSrc;
             } else {
                 const errorMsg = "無效嘅已處理圖片來源。";
                 console.error("Invalid processed image source provided for framing:", processedImageSrc);
                  setUiError(errorMsg);
                 reject(new Error("Invalid processed image source"));
             }
         });
     }, [finalCanvasRef, frameImageRef, setUiError]); // Add dependencies

    return {
        isGenerating,
        isUploading,
        progress,
        progressText,
        finalFramedImage,
        finalGcsUrl,
        generatedStory,
        uiError,
        setIsGenerating,
        setIsUploading,
        setProgress,
        setProgressText,
        setFinalFramedImage,
        setFinalGcsUrl,
        setGeneratedStory,
        setUiError,
        clearGenerationStates,
        frameImage, // Expose frameImage
    };
}
