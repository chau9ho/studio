'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Camera, Upload, Download, WandSparkles, Save, RotateCcw, X, ImagePlus, Palette, Sparkles, PartyPopper, FileImage, PencilRuler, Printer, QrCode, Cog, Link as LinkIcon, CheckCircle2, RefreshCw, CloudUpload } from 'lucide-react'; // Added CloudUpload icon
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import FallingSakura from '@/components/animations/FallingSakura';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { QRCodeCanvas } from 'qrcode.react'; // Import QR Code component
import { Progress } from "@/components/ui/progress"; // Import Progress component


// AI flow imports
import { generateSakuraPrompt } from '@/ai/flows/generate-sakura-prompt';
import { analyzeAnimalFeatures } from '@/ai/flows/analyze-animal-features';
import { generateCantoneseStory } from '@/ai/flows/generate-cantonese-story';

// ClipDrop service and helpers
import { replaceBackground, dataUrlToBlob, blobToDataUrl } from '@/services/clipdrop';

// Server Action imports
import { listPetImages, fetchGcsImageAsDataUrl, uploadFramedImageToGcs } from '@/actions/gcsActions'; // Import new upload action

// Types
type ApiKeys = {
  clipdropKey: string;
};

// Default API Key
const DEFAULT_CLIPDROP_KEY = 'dbe3bc24b88a9804d1dee978f6cb30f168886d7ababf3e09c76b81d3767beac1b305f6997c1a7d163766ac2ef54981bc';


// Updated Categories and Tags with more options
type Category = '自然風景' | '都市場景' | '幻想世界' | '時空場景' | '文化場景';

const categories: Record<Category, string[]> = {
  自然風景: ['森林小徑', '高山流水', '寧靜海岸', '飛流瀑布', '金色沙漠', '冰川雪景', '彩霞日落', '繁花草地', '竹林幽徑', '星空湖泊', '雨後彩虹'],
  都市場景: ['繁華天際線', '古老巷弄', '賽博龐克城', '石板老街', '迷幻霓虹夜', '雨中街角咖啡', '末日廢墟樓', '空中花園都市', '歐式小鎮廣場', '塗鴉藝術牆', '電車軌道旁'],
  幻想世界: ['精靈魔法森林', '天空飄浮島', '失落古代神殿', '閃耀水晶洞', '彩虹雲海天', '熔岩火山地獄', '糖果屋樂園', '深海亞特蘭提斯', '巨樹蘑菇林', '迷霧沼澤地', '時間齒輪境'],
  時空場景: ['浩瀚宇宙星雲', '高科技未來基地', '神秘遠古遺跡', '扭曲平行空間', '蒸汽龐克實驗室', '侏儸紀恐龍島', '維多利亞時代街景', '古代埃及金字塔', '西部牛仔小鎮', '月球殖民基地'],
  文化場景: ['日式和風庭園', '哥德式古堡', '江南中式園林', '波西米亞市集', '摩洛哥藍白風情', '希臘聖托里尼島', '威尼斯水都運河', '印度泰姬陵', '瑪雅文明遺址', '非洲草原部落'],
};


// Frame and Content Constants based on user request
const FRAME_WIDTH = 1410; // Width of the frame.png
const FRAME_HEIGHT = 2250; // Height of the frame.png
const TARGET_CONTENT_WIDTH = 1410; // Target width for the pet photo within the frame
const TARGET_CONTENT_HEIGHT = 1369; // Target height for the pet photo within the frame
const TARGET_CONTENT_START_Y = 610; // Y position where the pet image content should start

// ClipDrop dimension limit (set slightly lower for safety)
const MAX_IMAGE_DIMENSION = 2048; // Use Clipdrop's actual limit

// Canvas for resizing, separate from the final framing canvas
let resizeCanvas: HTMLCanvasElement | null = null;
if (typeof window !== 'undefined') {
    resizeCanvas = document.createElement('canvas');
    console.log("Resize canvas created.");
}

export default function SakuraPetFramesApp() {
  const { toast } = useToast();
  // Initialize with default key, useEffect will load saved key
  const [apiKeys, setApiKeys] = useState<ApiKeys>({ clipdropKey: DEFAULT_CLIPDROP_KEY });
  const [tempApiKeyInput, setTempApiKeyInput] = useState<string>(''); // Temporary state for dialog input
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState<boolean>(false);
  const [animalName, setAnimalName] = useState<string>('');
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null); // Base64 Data URL
  const [fetchedGcsImages, setFetchedGcsImages] = useState<string[]>([]); // State for fetched GCS image URLs
  const [selectedGcsImage, setSelectedGcsImage] = useState<string | null>(null); // State for the selected GCS image URL
  const [isFetchingGcsImages, setIsFetchingGcsImages] = useState<boolean>(false); // Loading state for GCS fetch
  const [gcsFetchError, setGcsFetchError] = useState<string | null>(null); // Error state for GCS fetch


  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]); // Changed to array for multiple tags
  const [generatedStory, setGeneratedStory] = useState<string>('');
  const [finalFramedImage, setFinalFramedImage] = useState<string | null>(null); // Base64 Data URL for local display/download
  const [finalGcsUrl, setFinalGcsUrl] = useState<string | null>(null); // URL of the uploaded framed image in GCS
  const [isUploading, setIsUploading] = useState<boolean>(false); // State for upload status

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [progressText, setProgressText] = useState<string>(''); // Added state for progress text
  const [uiError, setUiError] = useState<string | null>(null);

  const [isWebcamOpen, setIsWebcamOpen] = useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [currentObjectUrl, setCurrentObjectUrl] = useState<string | null>(null);


  const videoRef = useRef<HTMLVideoElement>(null);
  const finalCanvasRef = useRef<HTMLCanvasElement>(null); // Used for framing
  const frameImageRef = useRef<HTMLImageElement | null>(null);
   const captureCanvasRef = useRef<HTMLCanvasElement>(null); // Hidden canvas for webcam capture

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
    const storedSettings = localStorage.getItem('sakuraPetFramesSettings');
    let loadedKey = DEFAULT_CLIPDROP_KEY; // Start with default
    let loadedName = '';

    if (storedSettings) {
      try {
        const parsedSettings = JSON.parse(storedSettings);
        // Use saved key ONLY if it exists and is not empty, otherwise fallback to default
        if (parsedSettings.clipdropKey && parsedSettings.clipdropKey.trim() !== '') {
          loadedKey = parsedSettings.clipdropKey;
          console.log("Loaded ClipDrop key from localStorage.");
        } else {
          console.log("Using default ClipDrop key (saved key was empty or missing).");
        }
        loadedName = parsedSettings.animalName || '';
      } catch (error) {
        console.error("Failed to parse stored settings:", error);
        localStorage.removeItem('sakuraPetFramesSettings');
        toast({ title: "Error", description: "Could not load saved settings. Cleared potentially corrupted data.", variant: "destructive" });
      }
    } else {
        console.log("No settings found in localStorage, using default ClipDrop key.");
    }

    setApiKeys({ clipdropKey: loadedKey });
    setTempApiKeyInput(loadedKey); // Sync temp input with loaded key
    setAnimalName(loadedName);

    // Frame image loading remains the same
    const frameImg = new window.Image();
    frameImg.src = '/frame.png'; // Expects frame.png in the public folder
    frameImg.onload = () => {
        frameImageRef.current = frameImg;
        console.log("Frame image loaded successfully from /public/frame.png");
    };
    frameImg.onerror = (e) => {
        console.error("Failed to load frame image from /public/frame.png.", e);
        if (toast) {
          toast({ title: "Error", description: "Failed to load the frame image from /public/frame.png. Please ensure it exists.", variant: "destructive" });
        } else {
            console.error("Toast function not available during frame load error.");
        }
         setUiError("Failed to load application frame. Please refresh or check the image.");
    };

  }, [toast]);

  // Save API keys and animal name to localStorage
  const handleSaveSettings = () => {
    try {
      // Use the temporary input value for saving
      const keyToSave = tempApiKeyInput.trim();
      // If the user clears the input, save an empty string, which will cause the app to use the default key on next load.
      const finalKeyToUse = keyToSave || DEFAULT_CLIPDROP_KEY;

      const dataToStore = JSON.stringify({ clipdropKey: keyToSave, animalName }); // Save the potentially empty user input
      localStorage.setItem('sakuraPetFramesSettings', dataToStore);

      setApiKeys({ clipdropKey: finalKeyToUse }); // Update the active key state

      toast({ title: "設定已儲存", description: "寵物名同 ClipDrop API Key 已經儲存好。" });
      setIsSettingsDialogOpen(false); // Close dialog on save
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast({ title: "儲存失敗", description: "無法儲存設定。", variant: "destructive" });
    }
  };

  const clearAllStates = () => {
      setUploadedImage(null);
      setCapturedImage(null);
      setFetchedGcsImages([]); // Clear fetched images
      setSelectedGcsImage(null); // Clear selected GCS image
      setGcsFetchError(null); // Clear GCS fetch error
      setFinalFramedImage(null);
      setFinalGcsUrl(null); // Clear GCS URL
      setGeneratedStory('');
      setSelectedCategory(null);
      setSelectedTags([]);
      setUiError(null);
      setProgress(0);
      setProgressText('');
      setIsGenerating(false);
      setIsFetchingGcsImages(false); // Reset GCS fetching state
      setIsUploading(false); // Reset uploading state
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
        setCurrentObjectUrl(null);
      }
      console.log("All states cleared.");
  };

   const handleReset = () => {
       clearAllStates();
       toast({ title: "重新嚟過！", description: "所有嘢清空晒，可以再玩啦！" });
   };


  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
       // Clear other image sources
       setUploadedImage(null);
       setCapturedImage(null);
       setSelectedGcsImage(null); // Clear GCS selection
       setFinalFramedImage(null);
       setFinalGcsUrl(null); // Clear GCS URL
       setGeneratedStory('');
       if (currentObjectUrl) {
         URL.revokeObjectURL(currentObjectUrl);
         setCurrentObjectUrl(null);
       }

       const file = event.target.files[0];
        if (!file.type.startsWith('image/')) {
            toast({ title: "檔案類型錯誤", description: "請上載有效嘅圖片檔案。", variant: "destructive" });
            return;
        }
       setUploadedImage(file);
       const objectUrl = URL.createObjectURL(file);
       setCurrentObjectUrl(objectUrl);
       console.log("Image uploaded and Object URL created:", objectUrl);
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
     if (videoRef.current && captureCanvasRef.current) {
         const canvas = captureCanvasRef.current;
         const video = videoRef.current;
         canvas.width = video.videoWidth;
         canvas.height = video.videoHeight;
         const context = canvas.getContext('2d');

         if (context) {
             context.drawImage(video, 0, 0, canvas.width, canvas.height);
             const dataUrl = canvas.toDataURL('image/png');
             // Clear other image sources
             setUploadedImage(null);
             setSelectedGcsImage(null);
             setCapturedImage(dataUrl);
             setFinalFramedImage(null);
             setFinalGcsUrl(null); // Clear GCS URL
             setGeneratedStory('');
             if (currentObjectUrl) {
                 URL.revokeObjectURL(currentObjectUrl);
                 setCurrentObjectUrl(null);
             }
             console.log("Image captured from webcam.");
             stopWebcam();
         } else {
             console.error("Failed to get canvas context for capture");
             toast({ title: "拍攝失敗", description: "無法從鏡頭拍攝圖片。", variant: "destructive" });
             setUiError("無法從鏡頭拍攝圖片。");
         }
     } else {
          console.error("Video ref or capture canvas ref not available for capture.");
          toast({ title: "拍攝失敗", description: "元件未準備好拍攝。", variant: "destructive" });
          setUiError("元件未準備好拍攝。");
     }
   };

  // Effect to clean up webcam stream when component unmounts
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, [stopWebcam]);


    // Function to fetch images from GCS via server action
    const fetchImagesFromGCS = useCallback(async () => {
        if (!animalName) {
            setFetchedGcsImages([]); // Clear images if name is empty
            setGcsFetchError(null);
            return;
        }
        setIsFetchingGcsImages(true);
        setGcsFetchError(null);
        setFetchedGcsImages([]); // Clear previous results
        setSelectedGcsImage(null); // Clear selection

        try {
            console.log(`Fetching images for animal: ${animalName}`);
            const urls = await listPetImages(animalName);
            setFetchedGcsImages(urls);
            if (urls.length === 0) {
                 toast({ title: "搵唔到相", description: `喺雲端搵唔到 ${animalName} 嘅相。` });
            } else {
                 toast({ title: "搵到相喇！", description: `搵到 ${urls.length} 張 ${animalName} 嘅相。` });
            }
            console.log("Fetched image URLs:", urls);
        } catch (error: any) {
            console.error("Error fetching images from GCS:", error);
            const errorMsg = `無法由雲端載入圖片: ${error.message}`;
            setGcsFetchError(errorMsg);
            toast({ title: "載入失敗", description: errorMsg, variant: "destructive" });
        } finally {
            setIsFetchingGcsImages(false);
        }
    }, [animalName, toast]);

    // Trigger fetch when animal name changes (debounced slightly)
    useEffect(() => {
        const handler = setTimeout(() => {
            if (animalName) {
                fetchImagesFromGCS();
            } else {
                 // Clear results if animal name is cleared
                 setFetchedGcsImages([]);
                 setSelectedGcsImage(null);
                 setGcsFetchError(null);
            }
        }, 500); // Debounce for 500ms

        return () => {
            clearTimeout(handler);
        };
    }, [animalName, fetchImagesFromGCS]);


  // Function to handle selecting a fetched GCS image
  const handleSelectGcsImage = async (imageUrl: string) => {
     setSelectedGcsImage(imageUrl);
     setUiError(null);

     // Clear other primary image sources
     setUploadedImage(null);
     setCapturedImage(null);
     setFinalFramedImage(null); // Also clear final images
     setFinalGcsUrl(null);
     if (currentObjectUrl) {
         URL.revokeObjectURL(currentObjectUrl);
         setCurrentObjectUrl(null);
     }

     // Use the server action to load the image data URL
     setProgressText("由雲端載入緊圖片..."); // Indicate loading
     setProgress(5); // Show some progress
     try {
         const dataUrl = await fetchGcsImageAsDataUrl(imageUrl); // Call server action
         if (!dataUrl) {
             throw new Error("Server action returned empty data URL.");
         }
         setCapturedImage(dataUrl); // Store the loaded image data URL in capturedImage state
         console.log("Selected GCS image loaded as Data URL via server action:", imageUrl);
         toast({ title: "圖片已選取", description: "已選取並載入雲端圖片。" });
         setProgress(0); // Clear progress after load
         setProgressText('');
     } catch (error: any) {
         console.error("Error loading selected GCS image via server action:", error);
         const errorMsg = `無法載入選定嘅圖片: ${error.message}`;
         toast({ title: "載入失敗", description: errorMsg, variant: "destructive" });
         setUiError(errorMsg);
         setSelectedGcsImage(null); // Deselect on error
         setProgress(0);
         setProgressText('');
     }
   };


  const getCurrentImageAsDataUrl = (): Promise<string | null> => {
    return new Promise(async (resolve, reject) => {
      if (capturedImage) { // Handles webcam and SELECTED GCS image (now loaded via server action)
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
      }
      else {
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
       if (!resizeCanvas) {
           return reject(new Error("Resize canvas is not available."));
       }
       const ctx = resizeCanvas.getContext('2d');
       if (!ctx) {
            return reject(new Error("Could not get resize canvas context."));
       }

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
        setProgressText("張相太大喇，幫你變細啲先..."); // Update progress text

        let newWidth = width;
        let newHeight = height;
        const ratio = width / height;

        if (width > maxDimension) {
          newWidth = maxDimension;
          newHeight = newWidth / ratio;
        }

        if (newHeight > maxDimension) {
          newHeight = maxDimension;
          newWidth = newHeight * ratio;
        }

        newWidth = Math.floor(newWidth);
        newHeight = Math.floor(newHeight);

        console.log(`New image dimensions: ${newWidth}x${newHeight}`);

        // Use the dedicated resizeCanvas
        resizeCanvas.width = newWidth;
        resizeCanvas.height = newHeight;

        try {
          ctx.clearRect(0, 0, newWidth, newHeight); // Clear before drawing
          ctx.drawImage(img, 0, 0, newWidth, newHeight);
          // Use JPEG for potentially better compression on large images, adjust quality as needed
          const resizedDataUrl = resizeCanvas.toDataURL('image/jpeg', 0.9);
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
    setIsGenerating(true); // This now triggers the overlay
    setFinalFramedImage(null);
    setFinalGcsUrl(null); // Clear previous GCS URL
    setGeneratedStory('');
    setIsUploading(false);

    let initialImageDataUrl: string | null = null;
    try {
        initialImageDataUrl = await getCurrentImageAsDataUrl();
        if (!initialImageDataUrl) { // Check if null or empty
             throw new Error("No image source available (upload, webcam, or GCS selection).");
        }
    } catch (error: any) {
        console.error("Error getting current image data URL:", error);
        setUiError(`讀取圖片失敗: ${error.message}. 請重試。`);
        setIsGenerating(false);
        toast({ title: "圖片錯誤", description: `讀取圖片失敗: ${error.message}`, variant: "destructive" });
        return;
    }

     if (!selectedCategory || selectedTags.length === 0) {
      toast({ title: "未揀好", description: "請選擇一個背景主題同至少一個風格。", variant: "destructive" });
      setUiError("請選擇背景主題同至少一個風格。");
      setIsGenerating(false);
      return;
    }
     if (!apiKeys.clipdropKey) {
       // This case should be less likely now with the default key
       toast({ title: "缺少 API Key", description: "ClipDrop API key 未設定。", variant: "destructive" });
       setUiError("ClipDrop API key 未設定。請喺設定輸入。");
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

        console.log("Checking image size...");
        let resizedResult;
        try {
             resizedResult = await resizeImageIfNeeded(initialImageDataUrl, MAX_IMAGE_DIMENSION); // Use the already fetched URL
        } catch(error: any) {
            console.error("Error during image resize check:", error);
            setUiError(`圖片處理出錯: ${error.message}`);
            throw error; // Re-throw to be caught by the main catch block
        }
        const { resizedDataUrl: finalImageDataUrl, resizedBlob: finalImageBlob } = resizedResult;

        setProgress(10);
        setProgressText("唸緊咒語變靚背景...🌸");
        console.log("Generating background prompt...");
        let promptResult;
        const tagsString = selectedTags.join(', ');
        try {
             promptResult = await generateSakuraPrompt({ category: selectedCategory, tags: tagsString });
             if (!promptResult || !promptResult.prompt) throw new Error("Empty response from prompt generation");
        } catch (error: any) {
             console.error("Error generating prompt:", error);
             setUiError(`生成背景提示出錯: ${error.message}. 請檢查 AI 配置或稍後再試。`);
             throw error; // Re-throw
        }
        const bgPrompt = promptResult.prompt;
        setProgress(25);
        console.log("Background prompt generated:", bgPrompt);

        setProgressText("用魔法睇清楚你隻寵物...🧐");
        console.log("Analyzing animal features...");
        let analysisResult;
        try {
             // Use the resized data URL for analysis
             analysisResult = await analyzeAnimalFeatures({ photoDataUri: finalImageDataUrl });
             if (!analysisResult || !analysisResult.animalDescription) throw new Error("Empty response from animal analysis");
        } catch (error: any) {
            console.error("Error analyzing animal:", error);
             setUiError(`分析動物特徵出錯: ${error.message}. 請檢查 AI 配置或稍後再試。`);
             throw error; // Re-throw
        }
        const animalDesc = analysisResult.animalDescription;
        setProgress(50);
        console.log("Animal description generated:", animalDesc);

        setProgressText("作緊個得意故仔...✏️");
         console.log("Generating story...");
         let storyResult;
         try {
             storyResult = await generateCantoneseStory({
                 animalName: animalName,
                 animalDescription: animalDesc,
                 backgroundDescription: bgPrompt, // Use the background prompt for story context
             });
             if (!storyResult || !storyResult.story) throw new Error("Empty response from story generation");
         } catch (error: any) {
              console.error("Error generating story:", error);
               setUiError(`寫故仔出錯: ${error.message}. 請檢查 AI 配置或稍後再試。`);
               throw error; // Re-throw
         }
         setGeneratedStory(storyResult.story);
         setProgress(60); // Adjust progress
         console.log("Story generated.");

        setProgressText("施展緊背景替換魔法...🪄");
        console.log("Replacing background via ClipDrop...");
        let clipdropResponse;
        try {
             // Use the resized blob for ClipDrop
             clipdropResponse = await replaceBackground(finalImageBlob, bgPrompt, apiKeys.clipdropKey);
             if (!clipdropResponse || !clipdropResponse.image) throw new Error("Invalid response from ClipDrop");
        } catch (error: any) {
             console.error("Error processing image with ClipDrop:", error);
             // Use the user-friendly message for UI
             setUiError("唔好意思, 背景替換出錯，請一陣再試啦。");
             // Check if the error is related to API key or usage limits
             if (error.message.includes("API Error (401)") || error.message.includes("API Error (403)")) {
                 setUiError("ClipDrop API Key 無效或已過期，請檢查設定。");
             } else if (error.message.includes("API Error (429)")) {
                  setUiError("ClipDrop API 使用量已達上限，請稍後再試。");
             } else if (error.message.includes("API Error (400)") && error.message.includes("resolution exceeds")) {
                 setUiError("圖片解像度過高，即使嘗試調整後仍無法處理。");
             }
              else if (error.message.includes("Failed to fetch")) {
                 setUiError("無法連接 ClipDrop API，請檢查網絡或稍後再試。");
             }
             throw error; // Re-throw the original error for logging but use friendly message for UI
        }
        const processedImageBlob = clipdropResponse.image;
        const processedImageDataUrl = await blobToDataUrl(processedImageBlob);
        setProgress(75); // Adjust progress
        console.log("Background replaced.");

        setProgressText("最後一步，加個靚相框...🖼️");
        console.log("Framing image...");
        // Frame image now returns the data URL
        const framedDataUrl = await frameImage(processedImageDataUrl);
        setFinalFramedImage(framedDataUrl); // Set local state for immediate display/download
        setProgress(85); // Adjust progress
        console.log("Image framed.");

        // --- Upload to GCS ---
        setProgressText("將靚相放上雲端...☁️");
        setIsUploading(true); // Indicate upload start
        console.log("Uploading framed image to GCS...");
        try {
             const uploadedUrl = await uploadFramedImageToGcs(framedDataUrl, animalName);
             setFinalGcsUrl(uploadedUrl); // Store the GCS URL
             setProgress(100);
             setProgressText('魔法變身完成! 相已上傳! ✨🎉');
             console.log("Magic complete! Image uploaded to GCS:", uploadedUrl);
             toast({ title: "✨ 魔法相框變身完成 ✨", description: "靚相已經整好兼擺上雲端！" });
        } catch (uploadError: any) {
             console.error("Error uploading framed image to GCS:", uploadError);
             setUiError(`圖片已生成但上傳雲端失敗: ${uploadError.message}. 你仍然可以下載本地圖片。`);
             // Keep progress lower to indicate upload failed, but generation succeeded
             setProgress(95);
             setProgressText('魔法變身完成，但上傳失敗...😢');
             toast({ title: "變身完成但上傳失敗", description: `圖片已生成但上傳雲端失敗: ${uploadError.message}`, variant: "destructive" });
             // Do not throw here, let the user download the local image
        } finally {
             setIsUploading(false); // Indicate upload end
        }


    } catch (error: any) {
        console.error("Error during generation process:", error);
        // Use the specific UI error if set, otherwise use the caught error message
        const displayError = uiError || `唔好意思, 出咗啲問題: ${error.message || 'An unknown error occurred.'}. 請一陣再試啦。`;
        // Ensure uiError is set with the final message
        if (!uiError) {
            setUiError(displayError);
        }
        setProgressText('魔法失敗咗...😢'); // Update progress text on failure
        toast({ title: "變身失敗", description: displayError, variant: "destructive" });
    } finally {
        setIsGenerating(false); // This will hide the overlay
        // Keep progress at 100 or show error text based on success/failure
    }
  };


   const frameImage = (processedImageSrc: string): Promise<string> => { // Return Promise<string>
     return new Promise<string>((resolve, reject) => { // Return string
        console.log("Starting image framing process...");
        if (!finalCanvasRef.current) {
             const errorMsg = "相框畫布未準備好。";
             console.error(errorMsg);
             toast({ title: "相框錯誤", description: errorMsg, variant: "destructive" });
             setUiError(errorMsg);
             reject(new Error("Canvas not ready"));
             return;
         }
        if (!frameImageRef.current || !frameImageRef.current.complete || frameImageRef.current.naturalWidth === 0) {
            const errorMsg = "相框圖片載入失敗或無效。";
             console.error(errorMsg);
             toast({ title: "相框錯誤", description: errorMsg + " 請檢查 console。", variant: "destructive" });
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
             toast({ title: "相框錯誤", description: errorMsg, variant: "destructive" });
             setUiError(errorMsg);
             reject(new Error("Could not get canvas context"));
             return;
        }

        canvas.width = FRAME_WIDTH;
        canvas.height = FRAME_HEIGHT;
        console.log(`Canvas dimensions set to ${FRAME_WIDTH}x${FRAME_HEIGHT}`);

         try {
             // Clear canvas before drawing
             ctx.clearRect(0, 0, canvas.width, canvas.height);
             // Draw the white frame first (assuming frame.png has transparency where the image goes)
             ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
             console.log("Frame image drawn onto canvas.");
         } catch (drawError) {
              const errorMsg = "無法繪製相框圖片。";
              console.error("Error drawing frame image onto canvas:", drawError);
              toast({ title: "相框錯誤", description: errorMsg, variant: "destructive" });
              setUiError(errorMsg);
              reject(new Error("Failed to draw frame image on canvas"));
              return;
         }

        console.log("Loading processed image for drawing...");
        const processedImg = new window.Image();
        processedImg.onload = () => {
             console.log(`Processed image loaded: ${processedImg.naturalWidth}x${processedImg.naturalHeight}`);

             // Target dimensions and position for the pet image within the frame
             const targetWidth = TARGET_CONTENT_WIDTH;
             const targetHeight = TARGET_CONTENT_HEIGHT;
             const targetX = (FRAME_WIDTH - targetWidth) / 2; // Center horizontally
             const targetY = TARGET_CONTENT_START_Y; // Start at H 610

             // Calculate scaling to fit/fill the target area while maintaining aspect ratio
             const imgRatio = processedImg.naturalWidth / processedImg.naturalHeight;
             const targetRatio = targetWidth / targetHeight;

             let drawWidth, drawHeight, sourceX, sourceY, sourceWidth, sourceHeight;

             // Determine source dimensions to crop (if needed) and draw dimensions to scale
             if (imgRatio >= targetRatio) {
                 // Image is wider or same aspect ratio as target: Fit height, crop width
                 sourceHeight = processedImg.naturalHeight;
                 sourceWidth = processedImg.naturalHeight * targetRatio;
                 sourceX = (processedImg.naturalWidth - sourceWidth) / 2;
                 sourceY = 0;
                 drawWidth = targetWidth;
                 drawHeight = targetHeight;
             } else {
                 // Image is taller than target: Fit width, crop height
                 sourceWidth = processedImg.naturalWidth;
                 sourceHeight = processedImg.naturalWidth / targetRatio;
                 sourceX = 0;
                 sourceY = (processedImg.naturalHeight - sourceHeight) / 2;
                 drawWidth = targetWidth;
                 drawHeight = targetHeight;
             }


             console.log(`Target area: W=${targetWidth}, H=${targetHeight} at X=${targetX}, Y=${targetY}`);
             console.log(`Source crop: X=${sourceX.toFixed(2)}, Y=${sourceY.toFixed(2)}, W=${sourceWidth.toFixed(2)}, H=${sourceHeight.toFixed(2)}`);
             console.log(`Draw dimensions: W=${drawWidth.toFixed(2)}, H=${drawHeight.toFixed(2)}`);


             try {
                  // Draw the cropped and scaled pet image onto the canvas AT the target position
                  ctx.drawImage(
                     processedImg,
                     sourceX, sourceY, sourceWidth, sourceHeight, // Source rectangle (cropped part of original)
                     targetX, targetY, drawWidth, drawHeight      // Destination rectangle (scaled to fit target area)
                 );
                console.log("Processed image drawn onto canvas over the frame.");

                 const finalDataUrl = canvas.toDataURL('image/png');
                 console.log("Final image generated as Data URL.");
                  // Don't set state here, resolve the promise with the URL
                  resolve(finalDataUrl);
            } catch (drawError) {
                 const errorMsg = "無法繪製最終寵物圖片。";
                console.error("Error drawing processed image onto canvas:", drawError);
                 toast({ title: "相框錯誤", description: errorMsg, variant: "destructive" });
                 setUiError(errorMsg);
                 reject(new Error("Failed to draw processed image on canvas"));
            }
        };
        processedImg.onerror = (e) => {
            const errorMsg = "無法載入已處理嘅寵物圖片。";
            console.error("Failed to load processed image for framing:", e);
            toast({ title: "相框錯誤", description: errorMsg, variant: "destructive" });
            setUiError(errorMsg);
            reject(new Error("Failed to load processed image"));
        };
        if (processedImageSrc && typeof processedImageSrc === 'string' && processedImageSrc.startsWith('data:image')) {
            console.log("Assigning processed image source to Image object.");
            processedImg.src = processedImageSrc;
        } else {
             const errorMsg = "無效嘅已處理圖片來源。";
             console.error("Invalid processed image source provided for framing:", processedImageSrc);
             toast({ title: "相框錯誤", description: errorMsg, variant: "destructive" });
             setUiError(errorMsg);
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
    // Trigger browser's print dialog
    window.print();
    console.log("Print dialog should be open.");
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

  // QR code URL for upload service
  const qrUploadUrl = `https://upload-photo-dot-comfyuiserver2024.uc.r.appspot.com/?userName=${encodeURIComponent(animalName || 'Pet')}`;


  // Derive current image source for preview
  // Order: captured (webcam/selected GCS), uploaded (file object URL), null
  const previewImageSrc = capturedImage || currentObjectUrl;
  const showWebcam = isWebcamOpen && !capturedImage;
  // Updated condition to check selectedTags array length and animalName
   const canGenerate = !!(uploadedImage || capturedImage) && !!selectedCategory && selectedTags.length > 0 && !!apiKeys.clipdropKey && !!animalName;
   // Use finalGcsUrl for QR code if available, otherwise fall back to finalFramedImage (Data URL)
   const qrCodeValue = finalGcsUrl || finalFramedImage;

  return (
    <TooltipProvider>
      {/* Generation Overlay */}
       {(isGenerating || isUploading) && ( // Show overlay during generation AND upload
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm"
             style={{ backgroundImage: "url('/background1.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
          <div className="text-center p-8 rounded-lg bg-card/80 backdrop-blur-sm shadow-2xl max-w-md mx-auto">
              {/* Show loader or upload icon based on state */}
              {isUploading ? (
                  <CloudUpload className="h-16 w-16 animate-pulse text-teal-500 mx-auto mb-6" />
              ) : (
                  <Loader2 className="h-16 w-16 animate-spin text-pink-500 mx-auto mb-6" />
              )}
              <p className="text-2xl font-bold text-pink-600 mb-2 animate-pulse">{progressText || (isUploading ? '上傳緊...' : '魔法變身中...')}</p>
              {/* Enhanced Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700 overflow-hidden shadow-inner relative border border-pink-200">
                  {/* Sparkle effect */}
                  <div className="absolute top-0 left-0 h-full w-full overflow-hidden rounded-full">
                    {Array.from({ length: 15 }).map((_, i) => (
                        <div
                            key={i}
                            className="absolute h-1.5 w-1.5 bg-white rounded-full opacity-70"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                                animation: `sparkle ${1 + Math.random() * 1}s infinite alternate ease-in-out`,
                                animationDelay: `${Math.random() * 1}s`,
                            }}
                        />
                    ))}
                  </div>
                   <Progress
                    value={progress}
                    className="h-4 w-full border border-pink-200 bg-gray-200 dark:bg-gray-700 shadow-inner"
                    indicatorClassName="bg-gradient-to-r from-pink-400 via-purple-500 to-teal-400 transition-all duration-500 ease-out"
                    aria-label="Generation Progress"
                   />
              </div>
               <p className="text-sm text-muted-foreground mt-3">{progress < 100 ? '請稍等片刻...' : (finalGcsUrl ? '變身完成！相已上傳！' : (isUploading ? '上傳緊...' : '變身完成！') )}</p>
          </div>
           <style jsx>{`
                @keyframes sparkle {
                  0% { transform: scale(0.5); opacity: 0.5; }
                  100% { transform: scale(1); opacity: 1; }
                }
              `}</style>
        </div>
      )}


      <div className="container mx-auto p-4 max-w-4xl relative">
        <FallingSakura />
         {/* Settings Dialog */}
         <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
           <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="absolute top-4 right-4 z-20 non-printable">
                 <Cog className="h-4 w-4" />
                 <span className="sr-only">設定</span>
              </Button>
           </DialogTrigger>
           <DialogContent className="sm:max-w-[425px]">
             <DialogHeader>
               <DialogTitle>設定</DialogTitle>
               <DialogDescription>
                 輸入你嘅 ClipDrop API Key。如果留空，會使用預設 Key。
               </DialogDescription>
             </DialogHeader>
             <div className="grid gap-4 py-4">
               <div className="grid grid-cols-4 items-center gap-4">
                 <Label htmlFor="clipdrop-key-input" className="text-right">
                   API Key
                 </Label>
                 <Input
                   id="clipdrop-key-input"
                   value={tempApiKeyInput}
                   onChange={(e) => setTempApiKeyInput(e.target.value)}
                   placeholder="貼上你嘅 ClipDrop Key"
                   className="col-span-3"
                   type="password"
                 />
               </div>
                <Alert variant="default" className="mt-2">
                   <AlertDescription>
                       冇 Key? <a href="https://clipdrop.co/apis" target="_blank" rel="noopener noreferrer" className="underline">去 ClipDrop 免費申請</a>.
                       <br />
                       留空會用預設 Key (可能有使用限制)。
                   </AlertDescription>
               </Alert>
             </div>
             <DialogFooter>
               <Button type="button" onClick={handleSaveSettings}>儲存設定</Button>
             </DialogFooter>
           </DialogContent>
         </Dialog>

        <Card className="w-full shadow-lg overflow-hidden relative z-10 bg-card/80 backdrop-blur-sm non-printable">
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
               <span className="animate-text-pop-up-on-hover inline-block">上</span>
               <span className="animate-text-pop-up-on-hover inline-block">載</span>
               <span className="animate-text-pop-up-on-hover inline-block">寵</span>
               <span className="animate-text-pop-up-on-hover inline-block">物</span>
               <span className="animate-text-pop-up-on-hover inline-block">相</span>
               <span className="animate-text-pop-up-on-hover inline-block"> + </span>
               <span className="animate-text-pop-up-on-hover inline-block">揀</span>
               <span className="animate-text-pop-up-on-hover inline-block">個</span>
               <span className="animate-text-pop-up-on-hover inline-block">風</span>
               <span className="animate-text-pop-up-on-hover inline-block">格</span>
               <span className="animate-text-pop-up-on-hover inline-block"> = </span>
               <span className="animate-text-pop-up-on-hover inline-block">夢</span>
               <span className="animate-text-pop-up-on-hover inline-block">幻</span>
               <span className="animate-text-pop-up-on-hover inline-block">櫻</span>
               <span className="animate-text-pop-up-on-hover inline-block">花</span>
               <span className="animate-text-pop-up-on-hover inline-block">相</span>
               <span className="animate-text-pop-up-on-hover inline-block">！</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Simplified Input Section */}
            <Card className="non-printable">
               <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><ImagePlus size={24} className="text-teal-500" /> 1. 揀相 &amp; 揀 Style</CardTitle>
                  <CardDescription>上載、影相或用QR Code提供靚相，再揀你想要嘅背景主題同風格！</CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       {/* Image Input */}
                       <div className="space-y-4">
                           <Label className="font-semibold text-lg text-purple-600">A. 你嘅得意寵物相</Label>
                           <Tabs defaultValue="upload">
                               <TabsList className="grid w-full grid-cols-3"> {/* Changed to grid-cols-3 */}
                                   <TabsTrigger value="upload"><Upload className="mr-2 h-4 w-4 inline"/>上載</TabsTrigger>
                                   <TabsTrigger value="webcam"><Camera className="mr-2 h-4 w-4 inline"/>拍攝</TabsTrigger>
                                   <TabsTrigger value="qrcode"><QrCode className="mr-2 h-4 w-4 inline"/>雲端</TabsTrigger> {/* Changed QR Code Tab label */}
                               </TabsList>
                               <TabsContent value="upload">
                                   <div className="space-y-2 pt-2">
                                      <Label htmlFor="picture" className="text-sm text-muted-foreground">揀張相 (JPG, PNG, etc.)</Label>
                                      <Input id="picture" type="file" accept="image/*" onChange={handleImageUpload} />
                                   </div>
                               </TabsContent>
                               <TabsContent value="webcam">
                                   <div className="space-y-2 pt-2">
                                       {!isWebcamOpen && (
                                          <Button onClick={startWebcam} variant="outline" disabled={hasCameraPermission === false}>
                                              <Camera className="mr-2 h-4 w-4" /> 開鏡頭
                                          </Button>
                                       )}
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
                                       {hasCameraPermission === false && !isWebcamOpen && (
                                           <Alert variant="destructive">
                                              <AlertTitle>鏡頭權限被拒</AlertTitle>
                                              <AlertDescription>
                                                 請喺瀏覽器設定允許使用鏡頭，然後重新整理頁面。
                                              </AlertDescription>
                                          </Alert>
                                       )}
                                       {hasCameraPermission === null && isWebcamOpen && (
                                           <p className="text-sm text-muted-foreground">要求鏡頭權限中...</p>
                                       )}
                                   </div>
                               </TabsContent>
                               <TabsContent value="qrcode"> {/* Updated QR Code / Cloud Tab Content */}
                                  <div className="space-y-4 pt-4">
                                     {/* QR Code Section */}
                                     <div className='flex flex-col items-center gap-4 border-b pb-4 mb-4'>
                                          <p className="text-sm text-center text-muted-foreground">用手機掃描 QR Code，上載寵物相片到雲端。</p>
                                           {!animalName ? (
                                               <Alert variant="destructive">
                                                   <AlertTitle>請先輸入寵物名</AlertTitle>
                                                   <AlertDescription>
                                                       你需要先喺右邊輸入寵物名，先可以生成QR Code。
                                                   </AlertDescription>
                                               </Alert>
                                           ) : (
                                               <div className="p-2 bg-white rounded-md inline-block shadow-md">
                                                  <QRCodeCanvas value={qrUploadUrl} size={160} includeMargin={true} />
                                               </div>
                                           )}
                                      </div>

                                      {/* Fetched Images Section */}
                                      <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                             <Label className="text-sm text-muted-foreground">喺雲端搵到嘅相：</Label>
                                             <Button onClick={fetchImagesFromGCS} variant="ghost" size="sm" disabled={isFetchingGcsImages || !animalName} title="重新整理雲端圖片">
                                                <RefreshCw className={`h-4 w-4 ${isFetchingGcsImages ? 'animate-spin' : ''}`} />
                                             </Button>
                                        </div>
                                          {isFetchingGcsImages && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> 搵緊相...</p>}
                                          {gcsFetchError && !isFetchingGcsImages && <Alert variant="destructive"><AlertDescription>{gcsFetchError}</AlertDescription></Alert>}
                                          {!isFetchingGcsImages && fetchedGcsImages.length === 0 && animalName && (
                                             <p className="text-sm text-muted-foreground">喺雲端搵唔到 '{animalName}' 嘅相。試下用 QR code 上載？</p>
                                          )}
                                          {fetchedGcsImages.length > 0 && (
                                              <ScrollArea className="h-40 w-full rounded-md border">
                                                 <div className="p-2 grid grid-cols-3 gap-2">
                                                      {fetchedGcsImages.map((url) => (
                                                          <button
                                                              key={url}
                                                              onClick={() => handleSelectGcsImage(url)}
                                                              className={`relative aspect-square rounded-md overflow-hidden border-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${selectedGcsImage === url ? 'border-pink-500 ring-2 ring-pink-500 ring-offset-2' : 'border-transparent hover:border-pink-300'}`}
                                                          >
                                                              <img
                                                                  src={url}
                                                                  alt={`Fetched pet image ${url.split('/').pop()}`}
                                                                  className="object-cover w-full h-full"
                                                                  loading="lazy" // Lazy load images
                                                                   onError={(e) => { e.currentTarget.style.display='none'; /* Hide broken images */ }}
                                                              />
                                                              {selectedGcsImage === url && (
                                                                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                                      <CheckCircle2 className="h-6 w-6 text-white" />
                                                                  </div>
                                                              )}
                                                          </button>
                                                      ))}
                                                 </div>
                                              </ScrollArea>
                                          )}
                                      </div>
                                  </div>
                               </TabsContent>
                           </Tabs>
                            {previewImageSrc && (
                               <div className="mt-4">
                                   <Label>預覽:</Label>
                                   <img
                                      src={previewImageSrc} // Use the derived preview source
                                      alt="已上載、拍攝或由雲端選取嘅寵物相"
                                      width={300}
                                      height={225}
                                      className="rounded-md border mt-1 object-cover bg-muted shadow-md"
                                      data-ai-hint="pet animal"
                                       onError={(e) => {
                                          console.error("Error loading preview image:", e, previewImageSrc);
                                          toast({ title: "圖片載入錯誤", description: "無法顯示預覽圖片。", variant: "destructive" });
                                          setUiError("無法顯示預覽圖片。");
                                           // Clear the problematic source
                                           if (previewImageSrc === capturedImage) setCapturedImage(null);
                                           else if (previewImageSrc === currentObjectUrl) {
                                               setUploadedImage(null); // Also clear the file state
                                               setCurrentObjectUrl(null);
                                               URL.revokeObjectURL(previewImageSrc);
                                           }
                                       }}
                                   />
                               </div>
                           )}
                       </div>

                       {/* Style Selection & Name */}
                       <div className="space-y-4">
                            <div>
                               <Label htmlFor="animalName" className="font-semibold text-lg text-purple-600">B. 寵物嘅大名</Label>
                               <Input
                                   id="animalName"
                                   type="text"
                                   placeholder="例如: 毛毛, 旺財" // Removed English requirement, GCS path handles encoding
                                   value={animalName}
                                   onChange={(e) => setAnimalName(e.target.value)}
                                   className="mt-1"
                               />
                               <p className="text-xs text-muted-foreground mt-1">提示：寵物名會用嚟生成 QR Code 同喺雲端搵相。</p>
                           </div>
                           <div>
                              <Label htmlFor="category" className="font-semibold text-lg text-purple-600">C. 背景主題</Label>
                              <Select
                                  onValueChange={(value) => {
                                      setSelectedCategory(value as Category);
                                      setSelectedTags([]);
                                  }}
                                  value={selectedCategory || ''}
                              >
                                  <SelectTrigger id="category" className="mt-1">
                                  <SelectValue placeholder="揀個主題啦..." />
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
                                  <Label className="font-semibold text-lg text-purple-600">D. 背景風格 (揀幾多個都得！)</Label>
                                   <ScrollArea className="h-48 w-full rounded-md border p-4 mt-1 bg-background/50">
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                          {categories[selectedCategory].map((tag) => (
                                              <div key={tag} className="flex items-center space-x-2 hover:bg-pink-100 p-1 rounded transition-colors duration-150">
                                                  <Checkbox
                                                      id={`tag-${tag}`}
                                                      checked={selectedTags.includes(tag)}
                                                      onCheckedChange={(checked) => handleTagChange(tag, checked)}
                                                      className="border-pink-300 data-[state=checked]:bg-pink-500 data-[state=checked]:text-white"
                                                  />
                                                  <Label htmlFor={`tag-${tag}`} className="text-sm font-normal cursor-pointer select-none">
                                                      {tag}
                                                  </Label>
                                              </div>
                                          ))}
                                      </div>
                                   </ScrollArea>
                              </div>
                           )}
                       </div>
                   </div>
               </CardContent>
            </Card>


            {/* Step 2: Generate */}
            <Card className="non-printable">
               <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><Sparkles size={24} className="text-yellow-500" /> 2. 施展魔法 ✨</CardTitle>
                  <CardDescription>撳個掣，魔法就會開始！</CardDescription>
               </CardHeader>
               <CardContent className="flex flex-col items-center space-y-4">
                   <Button
                      onClick={handleGenerateMagic}
                      disabled={!canGenerate || isGenerating || isUploading} // Disable when generating or uploading
                      className={`w-full text-xl py-6 font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-teal-500 hover:from-pink-600 hover:via-purple-600 hover:to-teal-600 text-white shadow-lg rounded-full transition duration-300 ease-in-out transform hover:scale-105 active:scale-95 disabled:from-gray-400 disabled:via-gray-500 disabled:to-gray-600 disabled:scale-100 disabled:cursor-not-allowed ${canGenerate ? 'animate-subtle-pulse' : ''}`}
                    >
                      <WandSparkles className="mr-3 h-7 w-7" />
                       開始變身！ (Make Magic!)
                   </Button>
                    {uiError && !isGenerating && !isUploading && ( // Only show error when not busy
                       <Alert variant="destructive" className="w-full">
                          <AlertTitle>哎呀！魔法失敗咗！</AlertTitle>
                          <AlertDescription>{uiError}</AlertDescription>
                       </Alert>
                   )}
               </CardContent>
            </Card>


            {/* Step 3: Result */}
             {(finalFramedImage || generatedStory) && !isGenerating && !isUploading && ( // Hide results during generation/upload
               <Card className="non-printable">
                   <CardHeader>
                      <CardTitle className="text-xl flex items-center gap-2"><PartyPopper size={24} className="text-green-500"/> 3. 噹噹噹噹！睇下成果 🎉</CardTitle>
                      <CardDescription>你嘅專屬魔法相框同故仔整好啦！</CardDescription>
                   </CardHeader>
                   <CardContent className="flex flex-col items-center space-y-6">
                      {finalFramedImage && (
                          <div className="w-full max-w-[400px] md:max-w-[500px] mx-auto">
                               <Label className="text-lg font-semibold text-center block mb-2 text-pink-700">🖼️ 魔法相框:</Label>
                              <img
                                  src={finalFramedImage} // Use the local Data URL for immediate display
                                  alt={`Framed photo of ${animalName}`}
                                  width={FRAME_WIDTH}
                                  height={FRAME_HEIGHT}
                                  className="rounded-lg border-4 border-pink-200 shadow-xl object-contain bg-muted w-full h-auto"
                                   onError={(e) => {
                                      console.error("Error loading final framed image:", e);
                                      toast({ title: "圖片載入錯誤", description: "無法顯示最終圖片。", variant: "destructive" });
                                      setUiError("無法顯示最終圖片。");
                                      setFinalFramedImage(null);
                                      setFinalGcsUrl(null); // Clear GCS URL too if local display fails
                                   }}
                              />
                           </div>
                      )}
                       {generatedStory && (
                          <div className="w-full p-4 bg-teal-50 rounded-lg border border-teal-200 mt-4 shadow-sm story-container">
                               <Label className="text-lg font-semibold text-teal-700 flex items-center gap-2">📖 寵物專屬小故事:</Label>
                               <p className="text-sm mt-2 whitespace-pre-wrap text-gray-800 leading-relaxed">{generatedStory}</p>
                           </div>
                        )}
                   </CardContent>
                   <CardFooter className="flex flex-wrap justify-center gap-3 pt-4 non-printable">
                       {finalFramedImage && ( // Keep local download enabled even if GCS fails
                          <Button onClick={handleDownload} variant="secondary">
                              <Download className="mr-2 h-4 w-4" /> 下載靚相
                          </Button>
                       )}
                       {finalGcsUrl && ( // Only show print/QR if GCS upload was successful
                          <>
                           <Button onClick={handlePrint} variant="secondary">
                             <Printer className="mr-2 h-4 w-4" /> 列印 (4R)
                           </Button>
                           {/* QR Code Download Dialog Trigger */}
                           <Dialog>
                               <DialogTrigger asChild>
                                   <Button variant="secondary">
                                       <QrCode className="mr-2 h-4 w-4" /> 手機下載 (QR)
                                   </Button>
                               </DialogTrigger>
                               <DialogContent className="sm:max-w-[300px]">
                                   <DialogHeader>
                                       <DialogTitle>掃描 QR Code 下載</DialogTitle>
                                       <DialogDescription>
                                           用手機相機掃描下面嘅 QR Code 就可以下載雲端圖片。
                                       </DialogDescription>
                                   </DialogHeader>
                                   {qrCodeValue ? ( // Check if there's a value for QR code
                                        <div className="flex justify-center py-4 bg-white p-2 rounded-md">
                                          {/* Use finalGcsUrl for QR code */}
                                          <QRCodeCanvas value={finalGcsUrl} size={256} includeMargin={true} />
                                        </div>
                                   ) : (
                                        <Alert variant="default" className="my-4">
                                           <AlertTitle>QR Code 無法生成</AlertTitle>
                                           <AlertDescription>圖片連結不存在，無法生成 QR Code。</AlertDescription>
                                       </Alert>
                                   )}
                                    <DialogFooter>
                                        <DialogTrigger asChild>
                                            <Button type="button" variant="outline">關閉</Button>
                                        </DialogTrigger>
                                    </DialogFooter>
                               </DialogContent>
                           </Dialog>
                          </>
                       )}
                       <Button onClick={handleReset} variant="outline" className="text-red-600 border-red-300 hover:bg-red-50">
                          <RotateCcw className="mr-2 h-4 w-4" /> 清空再玩
                       </Button>
                   </CardFooter>
               </Card>
             )}


           {/* Hidden canvas for final image composition */}
           <canvas ref={finalCanvasRef} className="hidden"></canvas>
            {/* Hidden canvas for webcam capture */}
           <canvas ref={captureCanvasRef} className="hidden"></canvas>

          </CardContent>
           <CardFooter className="text-center text-xs text-muted-foreground justify-center non-printable pt-6">
               Powered by ClipDrop & Google AI. Inspired by Montara. ✨
           </CardFooter>
        </Card>

         {/* Image for Printing - Use finalFramedImage (local) or finalGcsUrl */}
         {finalFramedImage && ( // Use local image for print consistency
             <div className="hidden printable-area">
                 <img src={finalFramedImage} alt={`Printable framed photo of ${animalName}`} />
             </div>
         )}

      </div>
    </TooltipProvider>
  );
}

// Add CSS for sparkle animation if not already in globals.css
// Ensure globals.css has the following or similar:
/*
@keyframes sparkle {
  0% { transform: scale(0.5); opacity: 0.5; }
  100% { transform: scale(1); opacity: 1; }
}
*/
