
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Camera, Upload, Download, WandSparkles, Save, RotateCcw, X, ImagePlus, Palette, Sparkles, PartyPopper, FileImage, PencilRuler, Printer, QrCode } from 'lucide-react'; // Added Print, QrCode icons
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import FallingSakura from '@/components/animations/FallingSakura'; // Import the new component
import { QRCodeCanvas } from 'qrcode.react'; // Import QR code component
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'; // Import Dialog


// AI flow imports
import { generateSakuraPrompt } from '@/ai/flows/generate-sakura-prompt';
import { analyzeAnimalFeatures } from '@/ai/flows/analyze-animal-features';
import { generateCantoneseStory } from '@/ai/flows/generate-cantonese-story';

// ClipDrop service and helpers
import { replaceBackground, dataUrlToBlob, blobToDataUrl } from '@/services/clipdrop';

// Types
type ApiKeys = {
  clipdropKey: string;
};

// Updated Categories and Tags based on user request
type Category = '自然風景' | '都市場景' | '幻想世界' | '時空場景' | '文化場景';

const categories: Record<Category, string[]> = {
  自然風景: ['森林', '山脈', '海岸', '瀑布', '沙漠', '雪景', '日出/日落'],
  都市場景: ['天際線', '巷弄小路', '未來城市', '老城街道', '夜景霓虹', '雨中街道', '廢墟城市'],
  幻想世界: ['魔法森林', '飄浮島嶼', '古代神殿', '水晶洞窟', '幻想天空', '火山與熔岩'],
  時空場景: ['宇宙星空', '未來世界', '遠古文明', '平行時空', '科幻實驗室'],
  文化場景: ['和風庭園', '歐式古堡', '中式園林', '熱帶市集', '摩洛哥風格'],
};


// Frame and Content Constants based on user request
const FRAME_WIDTH = 1410; // Width of the frame.png
const FRAME_HEIGHT = 2250; // Height of the frame.png
const TARGET_CONTENT_WIDTH = 1441; // Max width constraint for the pet photo
const TARGET_CONTENT_HEIGHT = 1369; // Max height constraint for the pet photo
const TARGET_CONTENT_START_Y = 610; // Y position where the pet image content should start

// ClipDrop dimension limit (set slightly lower for safety)
const MAX_IMAGE_DIMENSION = 2048; // Use Clipdrop's actual limit


export default function SakuraPetFramesApp() {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKeys>({ clipdropKey: '' });
  const [animalName, setAnimalName] = useState<string>('');
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null); // Base64 Data URL
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]); // Changed to array for multiple tags
  const [generatedStory, setGeneratedStory] = useState<string>('');
  const [finalFramedImage, setFinalFramedImage] = useState<string | null>(null); // Base64 Data URL
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [progressText, setProgressText] = useState<string>(''); // Added state for progress text
  const [uiError, setUiError] = useState<string | null>(null);

  const [isWebcamOpen, setIsWebcamOpen] = useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [currentObjectUrl, setCurrentObjectUrl] = useState<string | null>(null);


  const videoRef = useRef<HTMLVideoElement>(null);
  // const canvasRef = useRef<HTMLCanvasElement>(null); // Removed, not needed for resize helper
  const finalCanvasRef = useRef<HTMLCanvasElement>(null); // Used for framing
  const frameImageRef = useRef<HTMLImageElement | null>(null);

   // Cleanup Object URL when component unmounts or image changes
   useEffect(() => {
    return () => {
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
         console.log("Revoked Object URL:", currentObjectUrl);
        setCurrentObjectUrl(null);
      }
    };
  }, [currentObjectUrl]);


  // Load API keys and animal name from localStorage on mount
  useEffect(() => {
    const storedKeys = localStorage.getItem('sakuraPetFramesKeys');
    if (storedKeys) {
      try {
        const parsedKeys = JSON.parse(storedKeys);
        setApiKeys({
          clipdropKey: parsedKeys.clipdropKey || process.env.NEXT_PUBLIC_CLIPDROP_API_KEY || '', // Load from env first
        });
         console.log("Loaded ClipDrop key:", parsedKeys.clipdropKey ? 'from localStorage' : 'using fallback');
        setAnimalName(parsedKeys.animalName || '');
      } catch (error) {
        console.error("Failed to parse stored API keys:", error);
        localStorage.removeItem('sakuraPetFramesKeys');
        toast({ title: "Error", description: "Could not load saved settings. Cleared potentially corrupted data.", variant: "destructive" });
      }
    } else {
         // If no keys in storage, try loading from environment variable
         const envKey = process.env.NEXT_PUBLIC_CLIPDROP_API_KEY;
         if (envKey) {
             setApiKeys({ clipdropKey: envKey });
             console.log("Loaded ClipDrop key from environment variable.");
         } else {
              console.warn("ClipDrop API Key not found in localStorage or environment variables.");
         }
    }

    const frameImg = new window.Image();
    frameImg.src = '/frame.png'; // Assumes frame.png is in the public folder
    frameImg.onload = () => {
        frameImageRef.current = frameImg;
        console.log("Frame image loaded successfully from /public/frame.png");
    };
    frameImg.onerror = (e) => { // Use 'e' for the event object
        console.error("Failed to load frame image from /public/frame.png.", e);
        // Check if toast function exists before calling
        if (toast) {
          toast({ title: "Error", description: "Failed to load the frame image from /public/frame.png. Please ensure it exists.", variant: "destructive" });
        } else {
            console.error("Toast function not available during frame load error.");
        }
         // Optionally set a UI error state here if the frame is critical
         // setUiError("Failed to load application frame. Please refresh or check the image.");
    };

  }, [toast]); // toast is a dependency because it's used in the error handler

  // Save API keys and animal name to localStorage
  const handleSaveKeys = () => {
    try {
      // Only save if the key is not the default/placeholder one from env vars (if applicable)
      // Or simply always save what's in the state
      const dataToStore = JSON.stringify({ clipdropKey: apiKeys.clipdropKey, animalName });
      localStorage.setItem('sakuraPetFramesKeys', dataToStore);
      toast({ title: "設定已儲存", description: "寵物名同 ClipDrop API Key 已經儲存好。" });
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast({ title: "儲存失敗", description: "無法儲存設定。", variant: "destructive" });
    }
  };

  const clearAllStates = () => {
      setUploadedImage(null);
      setCapturedImage(null);
      setFinalFramedImage(null);
      setGeneratedStory('');
      setSelectedCategory(null);
      setSelectedTags([]); // Reset to empty array
      setUiError(null);
      setProgress(0);
      setProgressText('');
      setIsGenerating(false);
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
        setCurrentObjectUrl(null);
      }
      console.log("All states cleared.");
  };

   const handleReset = () => {
       clearAllStates();
       toast({ title: "輸入已清除", description: "準備好整新相啦！" });
   };


  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
       clearAllStates();
       const file = event.target.files[0];
        if (!file.type.startsWith('image/')) {
            toast({ title: "檔案類型錯誤", description: "請上載有效嘅圖片檔案。", variant: "destructive" });
            return;
        }
       setUploadedImage(file);
       const objectUrl = URL.createObjectURL(file);
       setCurrentObjectUrl(objectUrl);
    }
  };

  const startWebcam = async () => {
     setHasCameraPermission(null);
     setUiError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      setStream(mediaStream);
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setIsWebcamOpen(true);
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
      setHasCameraPermission(false);
      toast({ title: "鏡頭錯誤", description: "無法開啟鏡頭，請檢查權限。", variant: "destructive" });
      setUiError("無法開啟鏡頭，請檢查權限。");
      setIsWebcamOpen(false);
    }
  };

   const stopWebcam = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsWebcamOpen(false);
    }
  }, [stream]);


  const captureImage = () => {
    if (videoRef.current) {
       // Create a temporary canvas in memory for resizing
       const tempCanvas = document.createElement('canvas');
       const video = videoRef.current;
       tempCanvas.width = video.videoWidth;
       tempCanvas.height = video.videoHeight;
       const context = tempCanvas.getContext('2d');

      if (context) {
        context.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
        const dataUrl = tempCanvas.toDataURL('image/png');
        clearAllStates();
        setCapturedImage(dataUrl);
        stopWebcam();
      } else {
         console.error("Failed to get canvas context for capture");
          toast({ title: "拍攝失敗", description: "無法從鏡頭拍攝圖片。", variant: "destructive" });
          setUiError("無法從鏡頭拍攝圖片。");
      }
    }
  };

  // Effect to clean up webcam stream when component unmounts
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, [stopWebcam]);


  const getCurrentImageAsDataUrl = (): Promise<string | null> => {
    return new Promise(async (resolve, reject) => {
      if (capturedImage) {
        resolve(capturedImage);
      } else if (uploadedImage) {
        try {
            const dataUrl = await blobToDataUrl(uploadedImage);
            resolve(dataUrl);
        } catch (error) {
             console.error("Error converting uploaded image to Data URL:", error);
             toast({ title: "圖片錯誤", description: "無法讀取上載嘅圖片檔案。", variant: "destructive" });
             setUiError("無法讀取上載嘅圖片檔案。");
             reject(new Error("Could not read uploaded image file."));
        }
      } else {
        resolve(null);
      }
    });
  };

   // Helper function to resize image if needed
   const resizeImageIfNeeded = (
    imageDataUrl: string,
    maxDimension: number
  ): Promise<{ resizedDataUrl: string; resizedBlob: Blob }> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = async () => {
        const { naturalWidth: width, naturalHeight: height } = img;
        console.log(`Original image dimensions: ${width}x${height}`);

        if (width <= maxDimension && height <= maxDimension) {
          console.log("Image is within size limits, no resize needed.");
          try {
            const blob = await dataUrlToBlob(imageDataUrl);
            resolve({ resizedDataUrl: imageDataUrl, resizedBlob: blob });
          } catch (error) {
            reject(new Error("Failed to convert original Data URL to Blob."));
          }
          return;
        }

        console.log("Image exceeds size limits, resizing...");
        setProgressText("張相太大喇，縮細緊..."); // Update progress text

        let newWidth = width;
        let newHeight = height;
        const ratio = width / height;

        if (width > maxDimension) {
          newWidth = maxDimension;
          newHeight = newWidth / ratio;
        }

        // Check height again after scaling width
        if (newHeight > maxDimension) {
          newHeight = maxDimension;
          newWidth = newHeight * ratio;
        }

        newWidth = Math.floor(newWidth);
        newHeight = Math.floor(newHeight);

        console.log(`New image dimensions: ${newWidth}x${newHeight}`);

        // Create a temporary canvas in memory for resizing
        const canvas = document.createElement('canvas'); // No need for canvasRef
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          return reject(new Error("Could not get canvas context for resizing."));
        }

        try {
          ctx.drawImage(img, 0, 0, newWidth, newHeight);
          // Use JPEG for potentially smaller size, adjust quality as needed (0.9 = 90%)
          const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
          console.log("Image resized successfully.");
          const resizedBlob = await dataUrlToBlob(resizedDataUrl);
          resolve({ resizedDataUrl, resizedBlob });
        } catch (error: any) {
           console.error("Error resizing image:", error);
           reject(new Error(`Failed to resize image: ${error.message || error}`));
        }
      };
      img.onerror = (e) => {
        console.error("Failed to load image for resizing check:", e);
        reject(new Error("Failed to load image for resizing check."));
      };
       if (imageDataUrl && typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image')) {
            img.src = imageDataUrl;
       } else {
            reject(new Error("Invalid image source provided for resizing check."));
       }
    });
  };

  const handleGenerateMagic = async () => {
    setUiError(null);
    setProgress(0);
    setProgressText('');
    setIsGenerating(true);
    setFinalFramedImage(null);
    setGeneratedStory('');

    // --- 1. Get Initial Image Data ---
    let initialImageDataUrl: string | null = null;
    try {
        initialImageDataUrl = await getCurrentImageAsDataUrl();
    } catch (error: any) {
        setIsGenerating(false);
        // Error already set in helper functions
        return;
    }
    if (!initialImageDataUrl) {
        toast({ title: "未有圖片", description: "請上載或拍攝寵物相片先。", variant: "destructive" });
        setUiError("請上載或拍攝寵物相片先。");
        setIsGenerating(false);
        return;
    }

    // --- Basic Input Checks ---
     if (!selectedCategory || selectedTags.length === 0) { // Check if tags array is empty
      toast({ title: "未揀好", description: "請選擇一個背景主題同至少一個風格。", variant: "destructive" });
      setUiError("請選擇背景主題同至少一個風格。");
      setIsGenerating(false);
      return;
    }
     if (!apiKeys.clipdropKey) {
       toast({ title: "缺少 API Key", description: "請輸入同儲存你嘅 ClipDrop API key。", variant: "destructive" });
       setUiError("請輸入同儲存 ClipDrop API Key。");
       setIsGenerating(false);
       return;
     }
     if (!animalName) {
       toast({ title: "未有寵物名", description: "請輸入寵物名稱。", variant: "destructive" });
       setUiError("請輸入寵物名稱。");
       setIsGenerating(false);
       return;
     }

    try {
        setProgress(5);
        setProgressText("準備緊魔法材料...🧪");

        // --- 1b. Resize Image If Needed ---
        console.log("Checking image size...");
        let resizedResult;
        try {
             resizedResult = await resizeImageIfNeeded(initialImageDataUrl, MAX_IMAGE_DIMENSION);
        } catch(error: any) {
            console.error("Error during image resize check:", error);
            toast({ title: "圖片處理錯誤", description: `無法處理圖片: ${error.message}`, variant: "destructive" });
            setUiError(`圖片處理出錯: ${error.message}`);
            setIsGenerating(false);
            return;
        }
        const { resizedDataUrl: finalImageDataUrl, resizedBlob: finalImageBlob } = resizedResult;

        // --- 2. Generate Background Prompt ---
        setProgress(10);
        setProgressText("諗緊個靚背景...🌸");
        console.log("Generating background prompt...");
        let promptResult;
        const tagsString = selectedTags.join(', '); // Combine selected tags into a string
        try {
             // Pass category and combined tags string to the flow
             promptResult = await generateSakuraPrompt({ category: selectedCategory, tags: tagsString });
             if (!promptResult || !promptResult.prompt) throw new Error("Empty response from prompt generation");
        } catch (error: any) {
             console.error("Error generating prompt:", error);
             const errorMsg = error.message || 'Unknown AI error';
              setUiError(`生成背景提示出錯: ${errorMsg}. 請檢查 AI 配置或稍後再試。`);
             throw new Error(`Failed to generate background prompt: ${errorMsg}`);
        }
        const bgPrompt = promptResult.prompt;
        setProgress(25);
        console.log("Background prompt generated:", bgPrompt);

        // --- 3. Analyze Animal Features ---
        setProgressText("睇緊你隻寵物有幾得意...🧐");
        console.log("Analyzing animal features...");
        let analysisResult;
        try {
             analysisResult = await analyzeAnimalFeatures({ photoDataUri: finalImageDataUrl }); // Use potentially resized data URL
             if (!analysisResult || !analysisResult.animalDescription) throw new Error("Empty response from animal analysis");
        } catch (error: any) {
            console.error("Error analyzing animal:", error);
             const errorMsg = error.message || 'Unknown AI error';
             setUiError(`分析動物特徵出錯: ${errorMsg}. 請檢查 AI 配置或稍後再試。`);
             throw new Error(`Failed to analyze animal features: ${errorMsg}`);
        }
        const animalDesc = analysisResult.animalDescription;
        setProgress(50);
        console.log("Animal description generated:", animalDesc);

        // --- 4. Generate Cantonese Story ---
        setProgressText("作緊故仔...✏️");
         console.log("Generating story...");
         let storyResult;
         try {
             storyResult = await generateCantoneseStory({
                 animalName: animalName,
                 animalDescription: animalDesc,
                 // Use the generated prompt (which includes sakura) as the background description for the story
                 backgroundDescription: bgPrompt,
             });
             if (!storyResult || !storyResult.story) throw new Error("Empty response from story generation");
         } catch (error: any) {
              console.error("Error generating story:", error);
               const errorMsg = error.message || 'Unknown AI error';
               setUiError(`寫故仔出錯: ${errorMsg}. 請檢查 AI 配置或稍後再試。`);
               throw new Error(`Failed to generate Cantonese story: ${errorMsg}`);
         }
         setGeneratedStory(storyResult.story);
         setProgress(65);
         console.log("Story generated.");

        // --- 5. Replace Background (ClipDrop) ---
        setProgressText("施展緊背景魔法...🪄");
        console.log("Replacing background via ClipDrop...");
        let clipdropResponse;
        try {
             clipdropResponse = await replaceBackground(finalImageBlob, bgPrompt, apiKeys.clipdropKey); // Use potentially resized Blob
             if (!clipdropResponse || !clipdropResponse.image) throw new Error("Invalid response from ClipDrop");
        } catch (error: any) {
             console.error("Error processing image with ClipDrop:", error);
             // Provide specific user-friendly message for ClipDrop errors
             // Set specific UI error for ClipDrop failures
             setUiError("唔好意思, 背景替換出錯，請稍後再試。"); // Adjusted message
             throw new Error(`ClipDrop processing failed: ${error.message || error}`); // Throw to stop process
        }
        const processedImageBlob = clipdropResponse.image;
        const processedImageDataUrl = await blobToDataUrl(processedImageBlob);
        setProgress(85);
        console.log("Background replaced.");

        // --- 6. Frame Image ---
        setProgressText("加緊個靚相框...🖼️");
        console.log("Framing image...");
        await frameImage(processedImageDataUrl); // frameImage handles its own errors and final state setting
        setProgress(100);
        setProgressText('魔法完成! ✨🎉');
        console.log("Magic complete!");
        toast({ title: "✨ 魔法相框變身完成 ✨", description: "快啲睇下你嘅寵物靚相啦！" });

    } catch (error: any) {
        console.error("Error during generation process:", error);
        // Use the specific UI error if set, otherwise use the caught error message
        const displayError = uiError || error.message || "An unknown error occurred.";
        // Set a general error message if no specific one was set (e.g., by ClipDrop handler)
        if (!uiError) {
             // Check for ClipDrop specific error patterns
             if (error.message && (error.message.includes("ClipDrop") || error.message.includes("API Error (400)"))) {
                 setUiError("唔好意思, 背景替換出錯，請稍後再試。");
             } else if (error.message && error.message.includes("Failed to generate") || error.message.includes("analyze animal") || error.message.includes("generate Cantonese story")) {
                 setUiError(`唔好意思, AI 出錯: ${displayError}. 請檢查設定或稍後再試。`);
             }
             else {
                setUiError(`唔好意思, 出咗啲問題: ${displayError}. 請一陣再試啦。`);
             }
        }

         // Update progress text based on error type
         if (error.message && (error.message.includes("ClipDrop") || error.message.includes("API Error (400)"))) {
             setProgressText('背景替換失敗...😢');
             // uiError is already set
         } else if (error.message && (error.message.includes("AI") || error.message.includes("generate prompt") || error.message.includes("analyze animal") || error.message.includes("generate Cantonese story"))) {
             setProgressText('AI 諗嘢失敗...🤯');
             // uiError is already set
         }
         else {
             setProgressText('魔法失敗咗...😢'); // General failure
              // uiError is already set
         }
        toast({ title: "變身失敗", description: uiError || "An unknown error occurred.", variant: "destructive" }); // Use the final uiError value
    } finally {
        setIsGenerating(false);
        // Don't reset progress to 0 immediately, let the user see it completed or failed at 100%
    }
  };


   const frameImage = (processedImageSrc: string): Promise<void> => {
     return new Promise<void>((resolve, reject) => {
        console.log("Starting image framing process...");
        if (!finalCanvasRef.current) {
             console.error("Final canvas ref is not available.");
             toast({ title: "相框錯誤", description: "畫布未準備好。", variant: "destructive" });
             setUiError("相框畫布未準備好。");
             reject(new Error("Canvas not ready"));
             return;
         }
        if (!frameImageRef.current || !frameImageRef.current.complete || frameImageRef.current.naturalWidth === 0) {
             console.error("Frame image ref is not available, not loaded, or has zero dimensions.");
             toast({ title: "相框錯誤", description: "相框圖片載入失敗或無效。請檢查 console。", variant: "destructive" });
             setUiError("相框圖片載入失敗或無效。");
             reject(new Error("Frame image not ready"));
             return;
         }

        const canvas = finalCanvasRef.current;
        const ctx = canvas.getContext('2d');
        const frameImg = frameImageRef.current;

        if (!ctx) {
             console.error("Could not get 2D context from final canvas.");
             toast({ title: "相框錯誤", description: "無法獲取畫布上下文。", variant: "destructive" });
             setUiError("無法獲取畫布上下文。");
             reject(new Error("Could not get canvas context"));
             return;
        }

        canvas.width = FRAME_WIDTH;
        canvas.height = FRAME_HEIGHT;
        console.log(`Canvas dimensions set to ${FRAME_WIDTH}x${FRAME_HEIGHT}`);

         try {
             // Draw the frame FIRST
             ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
             console.log("Frame image drawn onto canvas.");
         } catch (drawError) {
              console.error("Error drawing frame image onto canvas:", drawError);
              toast({ title: "相框錯誤", description: "無法繪製相框圖片。", variant: "destructive" });
              setUiError("無法繪製相框圖片。");
              reject(new Error("Failed to draw frame image on canvas"));
              return;
         }

        console.log("Loading processed image for drawing...");
        const processedImg = new window.Image();
        processedImg.onload = () => {
             console.log(`Processed image loaded: ${processedImg.naturalWidth}x${processedImg.naturalHeight}`);

            const targetWidth = TARGET_CONTENT_WIDTH;
            const targetHeight = TARGET_CONTENT_HEIGHT;
            const targetX = (FRAME_WIDTH - targetWidth) / 2; // Center horizontally
            const targetY = TARGET_CONTENT_START_Y; // Start at specific Y

             let drawWidth, drawHeight;
             const imgRatio = processedImg.naturalWidth / processedImg.naturalHeight;
             const targetRatio = targetWidth / targetHeight;

             // Scale the image to fit within the target area (1441x1369) while maintaining aspect ratio
              // Logic: Scale to cover the *larger* dimension of the target box
              if (imgRatio > targetRatio) {
                  // Image is wider than target box, scale based on height to cover
                  drawHeight = targetHeight;
                  drawWidth = drawHeight * imgRatio;
                   // If scaling by height makes it narrower than target width, scale by width instead
                   if (drawWidth < targetWidth) {
                       drawWidth = targetWidth;
                       drawHeight = drawWidth / imgRatio;
                   }

              } else {
                  // Image is taller than target box (or same ratio), scale based on width to cover
                  drawWidth = targetWidth;
                  drawHeight = drawWidth / imgRatio;
                  // If scaling by width makes it shorter than target height, scale by height instead
                  if (drawHeight < targetHeight) {
                       drawHeight = targetHeight;
                       drawWidth = drawHeight * imgRatio;
                   }
              }


             // Calculate position to center the SCALED image within the TARGET area
             // This might clip parts of the image if it's scaled larger than the target area
             const drawX = targetX + (targetWidth - drawWidth) / 2;
             const drawY = targetY + (targetHeight - drawHeight) / 2;

            console.log(`Target area: ${targetWidth}x${targetHeight} at X=${targetX}, Y=${targetY}`);
            console.log(`Calculated draw dimensions (scaled to cover): ${drawWidth}x${drawHeight}`);
            console.log(`Calculated draw position (centered, may clip): X=${drawX}, Y=${drawY}`);

            try {
                 // Draw the SCALED and CENTERED processed image ON TOP of the frame
                 ctx.drawImage(processedImg, drawX, drawY, drawWidth, drawHeight);
                 console.log("Processed image drawn onto canvas over the frame.");

                 const finalDataUrl = canvas.toDataURL('image/png');
                 console.log("Final image generated as Data URL.");
                  setFinalFramedImage(finalDataUrl); // Update state here
                  resolve();
            } catch (drawError) {
                console.error("Error drawing processed image onto canvas:", drawError);
                 toast({ title: "相框錯誤", description: "無法繪製最終寵物圖片。", variant: "destructive" });
                 setUiError("無法繪製最終寵物圖片。");
                 reject(new Error("Failed to draw processed image on canvas"));
            }
        };
        processedImg.onerror = (e) => {
            console.error("Failed to load processed image for framing:", e);
            toast({ title: "相框錯誤", description: "無法載入已處理嘅寵物圖片。", variant: "destructive" });
            setUiError("無法載入已處理的寵物圖片。");
            reject(new Error("Failed to load processed image"));
        };
        if (processedImageSrc && typeof processedImageSrc === 'string' && processedImageSrc.startsWith('data:image')) {
            console.log("Assigning processed image source to Image object.");
            processedImg.src = processedImageSrc;
        } else {
             console.error("Invalid processed image source provided for framing:", processedImageSrc);
             toast({ title: "相框錯誤", description: "無效嘅已處理圖片來源。", variant: "destructive" });
             setUiError("無效的已處理圖片來源。");
             reject(new Error("Invalid processed image source"));
        }
     });
  };


  const handleDownload = () => {
    if (!finalFramedImage) {
      toast({ title: "未有圖片", description: "請先生成最終圖片。", variant: "destructive" });
      setUiError("請先生成最終圖片。");
      return;
    }
    try {
        const link = document.createElement('a');
        link.download = `${animalName || 'sakura_pet'}_frame.png`;
        link.href = finalFramedImage;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
         console.error("Error creating download link:", error);
         toast({ title: "下載錯誤", description: "無法開始下載圖片。", variant: "destructive" });
          setUiError("無法開始下載圖片。");
    }
  };

  const handlePrint = () => {
    if (!finalFramedImage) {
      toast({ title: "未有圖片", description: "請先生成最終圖片先可以列印。", variant: "destructive" });
      setUiError("請先生成最終圖片先可以列印。");
      return;
    }
    // Open print dialog
    window.print();
  };


  // Handle multiple tag selection
  const handleTagChange = (tag: string, checked: boolean | "indeterminate") => {
      setSelectedTags(prevTags => {
          if (checked === true) {
              return [...prevTags, tag];
          } else {
              return prevTags.filter(t => t !== tag);
          }
      });
  };


  // Derive current image source for preview, preferring captured, then uploaded (via Object URL)
  const previewImageSrc = capturedImage || currentObjectUrl;
  const showWebcam = isWebcamOpen && !capturedImage;
  // Updated condition to check selectedTags array length
  const canGenerate = !!(uploadedImage || capturedImage) && !!selectedCategory && selectedTags.length > 0 && !!apiKeys.clipdropKey && !!animalName;

  return (
    <div className="container mx-auto p-4 max-w-4xl relative"> {/* Added relative positioning */}
      <FallingSakura /> {/* Add the falling sakura component */}
      <Card className="w-full shadow-lg overflow-hidden relative z-10 bg-card/80 backdrop-blur-sm non-printable"> {/* Make card slightly transparent and blurred, hide on print */}
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center text-pink-500 flex items-center justify-center gap-2 animate-text-focus-in">
            <span className="animate-text-pop-up-on-hover inline-block">🌸</span>
            <span className="animate-text-pop-up-on-hover inline-block">櫻</span>
            <span className="animate-text-pop-up-on-hover inline-block">花</span>
            <span className="animate-text-pop-up-on-hover inline-block">寵</span>
            <span className="animate-text-pop-up-on-hover inline-block">物</span>
            <span className="animate-text-pop-up-on-hover inline-block">魔</span>
            <span className="animate-text-pop-up-on-hover inline-block">法</span>
            <span className="animate-text-pop-up-on-hover inline-block">變</span>
            <span className="animate-text-pop-up-on-hover inline-block">身</span>
            <span className="animate-text-pop-up-on-hover inline-block">器</span>
            <span className="animate-text-pop-up-on-hover inline-block">🌸</span>
          </CardTitle>
          <CardDescription className="text-center animate-text-focus-in" style={{ animationDelay: '0.5s' }}>
             <span className="animate-text-pop-up-on-hover inline-block">揀</span>
             <span className="animate-text-pop-up-on-hover inline-block">張</span>
             <span className="animate-text-pop-up-on-hover inline-block">寵</span>
             <span className="animate-text-pop-up-on-hover inline-block">物</span>
             <span className="animate-text-pop-up-on-hover inline-block">相</span>
             <span className="animate-text-pop-up-on-hover inline-block"> + </span>
             <span className="animate-text-pop-up-on-hover inline-block">揀</span>
             <span className="animate-text-pop-up-on-hover inline-block">個</span>
             <span className="animate-text-pop-up-on-hover inline-block">風</span>
             <span className="animate-text-pop-up-on-hover inline-block">格</span>
             <span className="animate-text-pop-up-on-hover inline-block"> = </span>
             <span className="animate-text-pop-up-on-hover inline-block">獨</span>
             <span className="animate-text-pop-up-on-hover inline-block">一</span>
             <span className="animate-text-pop-up-on-hover inline-block">無</span>
             <span className="animate-text-pop-up-on-hover inline-block">二</span>
             <span className="animate-text-pop-up-on-hover inline-block">嘅</span>
             <span className="animate-text-pop-up-on-hover inline-block">櫻</span>
             <span className="animate-text-pop-up-on-hover inline-block">花</span>
             <span className="animate-text-pop-up-on-hover inline-block">魔</span>
             <span className="animate-text-pop-up-on-hover inline-block">法</span>
             <span className="animate-text-pop-up-on-hover inline-block">相</span>
             <span className="animate-text-pop-up-on-hover inline-block">！</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Simplified Combined Input Section */}
          <Card className="non-printable">
             <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2"><ImagePlus size={24} /> 1. 揀選寵物靚相 &amp; 風格</CardTitle>
                <CardDescription>上載/影相，再揀個主題同風格！</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {/* --- Left side: Image Input --- */}
                     <div className="space-y-4">
                         <Label className="font-semibold">A. 揀選寵物相片</Label>
                         <Tabs defaultValue="upload">
                             <TabsList className="grid w-full grid-cols-2">
                                 <TabsTrigger value="upload" disabled={isGenerating}><Upload className="mr-2 h-4 w-4 inline"/>上載圖片</TabsTrigger>
                                 <TabsTrigger value="webcam" disabled={isGenerating}><Camera className="mr-2 h-4 w-4 inline"/>即時拍攝</TabsTrigger>
                             </TabsList>
                             <TabsContent value="upload">
                                 <div className="space-y-2 pt-2">
                                    <Label htmlFor="picture" className="text-sm text-muted-foreground">揀選相片檔案 (太大會自動縮細)</Label>
                                    <Input id="picture" type="file" accept="image/*" onChange={handleImageUpload} disabled={isGenerating} />
                                 </div>
                             </TabsContent>
                             <TabsContent value="webcam">
                                 <div className="space-y-2 pt-2">
                                     {!isWebcamOpen && (
                                        <Button onClick={startWebcam} variant="outline" disabled={hasCameraPermission === false || isGenerating}>
                                            <Camera className="mr-2 h-4 w-4" /> 開啟鏡頭
                                        </Button>
                                     )}
                                      {/* Video element always present but hidden when not active */}
                                      <div className={`relative aspect-video bg-muted rounded-md overflow-hidden ${!showWebcam ? 'hidden' : ''}`}>
                                          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
                                           {isWebcamOpen && (
                                                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-2">
                                                    <Button onClick={captureImage} size="icon" variant="destructive" title="影相">
                                                        <Camera />
                                                    </Button>
                                                    <Button onClick={stopWebcam} size="icon" variant="secondary" title="關閉鏡頭">
                                                        <X/>
                                                    </Button>
                                                </div>
                                           )}
                                      </div>
                                     {hasCameraPermission === false && !isWebcamOpen && ( // Show error only if webcam is not open but permission denied
                                         <Alert variant="destructive">
                                            <AlertTitle>鏡頭權限被拒</AlertTitle>
                                            <AlertDescription>
                                               請喺瀏覽器設定允許使用鏡頭，然後可能需要重新整理頁面。
                                            </AlertDescription>
                                        </Alert>
                                     )}
                                     {hasCameraPermission === null && isWebcamOpen && ( // Show loading only when webcam is open and permission pending
                                         <p className="text-sm text-muted-foreground">要求鏡頭權限中...</p>
                                     )}
                                 </div>
                             </TabsContent>
                         </Tabs>
                          {previewImageSrc && (
                             <div className="mt-4">
                                 <Label>預覽:</Label>
                                 <img
                                    src={previewImageSrc}
                                    alt="已上載或拍攝的寵物相"
                                    width={300}
                                    height={225}
                                    className="rounded-md border mt-1 object-cover bg-muted"
                                    data-ai-hint="pet animal"
                                     onError={(e) => {
                                        console.error("Error loading preview image:", e);
                                        toast({ title: "圖片載入錯誤", description: "無法顯示預覽圖片。", variant: "destructive" });
                                        setUiError("無法顯示預覽圖片。");
                                        if (previewImageSrc === currentObjectUrl) setCurrentObjectUrl(null);
                                        if (previewImageSrc === capturedImage) setCapturedImage(null);
                                     }}
                                 />
                             </div>
                         )}
                     </div>

                     {/* --- Right side: Style Selection & Name --- */}
                     <div className="space-y-4">
                          <div>
                             <Label htmlFor="animalName" className="font-semibold">B. 寵物名</Label>
                             <Input
                                 id="animalName"
                                 type="text"
                                 placeholder="例如: Mochi, 波子"
                                 value={animalName}
                                 onChange={(e) => setAnimalName(e.target.value)}
                                 className="mt-1"
                                 disabled={isGenerating}
                             />
                         </div>
                         <div>
                            <Label htmlFor="category" className="font-semibold">C. 背景主題</Label>
                            <Select
                                onValueChange={(value) => {
                                    setSelectedCategory(value as Category);
                                    setSelectedTags([]); // Reset tags when category changes
                                }}
                                value={selectedCategory || ''}
                                disabled={isGenerating}
                            >
                                <SelectTrigger id="category" className="mt-1">
                                <SelectValue placeholder="揀一個大主題..." />
                                </SelectTrigger>
                                <SelectContent>
                                {Object.keys(categories).map((cat) => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                         </div>
                          {selectedCategory && (
                            <div className="space-y-2">
                                <Label className="font-semibold">D. 背景風格 (揀多個都得)</Label>
                                 <ScrollArea className="h-48 w-full rounded-md border p-4 mt-1">
                                    <div className="grid grid-cols-2 gap-2">
                                        {categories[selectedCategory].map((tag) => (
                                            <div key={tag} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`tag-${tag}`}
                                                    checked={selectedTags.includes(tag)}
                                                    onCheckedChange={(checked) => handleTagChange(tag, checked)}
                                                    disabled={isGenerating}
                                                />
                                                <Label htmlFor={`tag-${tag}`} className="text-sm font-normal cursor-pointer">
                                                    {tag}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                 </ScrollArea>
                            </div>
                         )}
                          {/* Hidden API Key Input - still useful for saving */}
                           <div className="hidden">
                             <Label htmlFor="clipdropKey">ClipDrop API Key</Label>
                             <Input
                                id="clipdropKey"
                                type="password"
                                value={apiKeys.clipdropKey}
                                onChange={(e) => setApiKeys(prev => ({ ...prev, clipdropKey: e.target.value }))}
                                className="mt-1"
                             />
                             <Button onClick={handleSaveKeys} size="sm" className="mt-2">儲存 API Key</Button>
                           </div>

                         {!apiKeys.clipdropKey && (
                              <Alert variant="destructive">
                                  <AlertTitle>缺少 ClipDrop Key</AlertTitle>
                                  <AlertDescription>
                                      要換背景需要 ClipDrop API Key！ <a href="https://clipdrop.co/apis" target="_blank" rel="noopener noreferrer" className="underline">去申請</a>
                                      {/* Optionally add input back if needed */}
                                  </AlertDescription>
                              </Alert>
                          )}
                     </div>
                 </div>
             </CardContent>
          </Card>


          {/* Step 2: Generate */}
          <Card className="non-printable">
             <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2"><Sparkles size={24} /> 2. 施展魔法 ✨</CardTitle>
                <CardDescription>撳個掣，等陣就有靚相睇！</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
                 <Button
                    onClick={handleGenerateMagic}
                    disabled={!canGenerate || isGenerating}
                    className={`w-full text-lg py-6 bg-gradient-to-r from-pink-400 via-purple-400 to-teal-400 hover:from-pink-500 hover:via-purple-500 hover:to-teal-500 text-white shadow-lg transition duration-300 ease-in-out transform hover:scale-105 active:scale-95 disabled:from-pink-200 disabled:via-purple-200 disabled:to-teal-200 disabled:scale-100 disabled:cursor-not-allowed ${!isGenerating && canGenerate ? 'animate-subtle-pulse' : ''}`} // Added pulse animation when ready
                  >
                    {isGenerating ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <WandSparkles className="mr-2 h-6 w-6" />}
                    {isGenerating ? '魔法變身中...' : '開始變身！'}
                 </Button>
                  {isGenerating && (
                    <div className="space-y-2 pt-4 progress-bar-container"> {/* Added wrapper class */}
                          {/* Funky Progress Bar */}
                         <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden shadow-inner relative">
                             {/* Sparkle effect */}
                             <div className="absolute top-0 left-0 h-full w-full overflow-hidden rounded-full">
                                {Array.from({ length: 10 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="absolute h-1 w-1 bg-white rounded-full animate-pulse"
                                        style={{
                                            left: `${Math.random() * 100}%`,
                                            top: `${Math.random() * 100}%`,
                                            animationDelay: `${Math.random() * 2}s`,
                                            animationDuration: '1.5s'
                                        }}
                                    />
                                ))}
                             </div>
                           <div
                             className="bg-gradient-to-r from-pink-400 via-purple-500 to-teal-400 h-2.5 rounded-full transition-all duration-500 ease-out flex items-center justify-center text-xs font-medium text-white shadow-md"
                             style={{ width: `${progress}%` }}
                             role="progressbar"
                             aria-valuenow={progress}
                             aria-valuemin={0}
                             aria-valuemax={100}
                             aria-label="Generation Progress"
                           >
                           </div>
                         </div>
                         <p className="text-sm text-muted-foreground text-center font-medium animate-pulse pt-1">
                            {progressText || '準備緊魔法材料...🧪'} <span className="inline-block animate-bounce">✨</span>
                          </p>
                    </div>
                 )}
                 {uiError && !isGenerating && ( // Only show error if not generating
                     <Alert variant="destructive">
                        <AlertTitle>哎呀！出錯喇！</AlertTitle>
                        <AlertDescription>{uiError}</AlertDescription>
                     </Alert>
                 )}
             </CardContent>
          </Card>


          {/* Step 3: Result */}
           {(finalFramedImage || generatedStory) && !isGenerating && progress === 100 && (
             <Card className="non-printable"> {/* Hide card container itself on print */}
                 <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><PartyPopper size={24} /> 3. 魔法相框完成 🎉</CardTitle>
                    <CardDescription>睇下你嘅大作！</CardDescription>
                 </CardHeader>
                 <CardContent className="flex flex-col items-center space-y-4">
                    {/* --- Image for Display (will be hidden on print) --- */}
                    {finalFramedImage && (
                        <div className="w-full max-w-[400px] md:max-w-[500px] mx-auto non-printable"> {/* Hide this wrapper on print */}
                             <Label className="text-lg font-semibold text-center block mb-2">🖼️ 你的專屬相框:</Label>
                            <img
                                src={finalFramedImage}
                                alt={`Framed photo of ${animalName}`}
                                width={FRAME_WIDTH}
                                height={FRAME_HEIGHT}
                                className="rounded-md border shadow-md object-contain bg-muted w-full h-auto"
                                 onError={(e) => {
                                    console.error("Error loading final framed image:", e);
                                    toast({ title: "圖片載入錯誤", description: "無法顯示最終圖片。", variant: "destructive" });
                                    setUiError("無法顯示最終圖片。");
                                    setFinalFramedImage(null);
                                 }}
                            />
                         </div>
                    )}
                     {generatedStory && (
                        <div className="w-full p-4 bg-pink-50 rounded-md border border-pink-200 mt-4 story-container"> {/* Add class to hide on print */}
                             <Label className="text-lg font-semibold text-pink-700 flex items-center gap-2">📖 寵物小故事:</Label>
                             <p className="text-sm mt-2 whitespace-pre-wrap text-gray-700">{generatedStory}</p>
                         </div>
                      )}
                 </CardContent>
                 <CardFooter className="flex justify-center gap-4 pt-4 non-printable"> {/* Hide footer on print */}
                     {finalFramedImage && (
                        <>
                         <Button onClick={handleDownload}>
                            <Download className="mr-2 h-4 w-4" /> 下載靚相
                         </Button>
                         <Button onClick={handlePrint}>
                           <Printer className="mr-2 h-4 w-4" /> 列印 (4R)
                         </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                               <Button variant="outline">
                                 <QrCode className="mr-2 h-4 w-4" /> 顯示 QR Code
                               </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px] flex flex-col items-center">
                              <DialogHeader>
                                <DialogTitle>用手機掃描下載圖片</DialogTitle>
                              </DialogHeader>
                               {finalFramedImage ? (
                                <QRCodeCanvas value={finalFramedImage} size={256} includeMargin={true} />
                               ) : (
                                 <p>無法生成 QR Code，因為圖片唔存在。</p>
                               )}
                            </DialogContent>
                          </Dialog>
                        </>
                     )}
                     <Button onClick={handleReset} variant="outline">
                        <RotateCcw className="mr-2 h-4 w-4" /> 再玩一次
                     </Button>
                 </CardFooter>
             </Card>
           )}


         {/* Hidden canvas for final image composition */}
         <canvas ref={finalCanvasRef} className="hidden"></canvas>
          {/* Removed hidden canvas for webcam capture/resize */}
         {/* <canvas ref={canvasRef} className="hidden"></canvas> */}

        </CardContent>
         <CardFooter className="text-center text-xs text-muted-foreground justify-center non-printable"> {/* Hide on print */}
             Powered by ClipDrop & Google AI. Inspired by Montara. ✨
         </CardFooter>
      </Card>

       {/* --- Image for Printing (Only visible on print) --- */}
       {finalFramedImage && (
           <div className="hidden printable-area"> {/* Hide by default, show on print */}
               <img src={finalFramedImage} alt={`Printable framed photo of ${animalName}`} />
           </div>
       )}

    </div>
  );
}
