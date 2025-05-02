
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, Camera, Upload, Download, WandSparkles, Save, RotateCcw, X } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

type Category = '自然風景' | '城市場景' | '幻想世界' | '時空主題' | '文化風格' | '抽象主題';

const categories: Record<Category, string[]> = {
  自然風景: ['森林', '湖泊', '山脈', '日出', '雪景'],
  城市場景: ['現代都市', '雨夜街道', '未來街區'],
  幻想世界: ['飄浮島', '火山地貌', '水晶洞窟'],
  時空主題: ['太空基地', '末日未來', '平行時空'],
  文化風格: ['和風庭園', '中式園林', '歐洲古堡'],
  抽象主題: ['蒸氣龐克', '霓虹夜光', '夢幻光影'],
};

// Frame and Content Constants based on user request
const FRAME_WIDTH = 1410; // Width of the frame.png
const FRAME_HEIGHT = 2250; // Height of the frame.png
const TARGET_CONTENT_WIDTH = 1441; // Max width constraint for the pet photo
const TARGET_CONTENT_HEIGHT = 1369; // Max height constraint for the pet photo
const TARGET_CONTENT_START_Y = 610; // Y position where the pet image content should start

// ClipDrop dimension limit (set slightly lower for safety)
const MAX_IMAGE_DIMENSION = 2000;


export default function SakuraPetFramesApp() {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKeys>({ clipdropKey: '' });
  const [animalName, setAnimalName] = useState<string>('');
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null); // Base64 Data URL
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
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
  const canvasRef = useRef<HTMLCanvasElement>(null); // Used for webcam capture and potential resize
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
          clipdropKey: parsedKeys.clipdropKey || '',
        });
        setAnimalName(parsedKeys.animalName || '');
      } catch (error) {
        console.error("Failed to parse stored API keys:", error);
        localStorage.removeItem('sakuraPetFramesKeys');
        toast({ title: "Error", description: "Could not load saved settings. Cleared potentially corrupted data.", variant: "destructive" });
      }
    }
    const frameImg = new window.Image();
    frameImg.src = '/frame.png';
    frameImg.onload = () => {
        frameImageRef.current = frameImg;
        console.log("Frame image loaded");
    };
    frameImg.onerror = (e) => { // Use 'e' for the event object
        console.error("Failed to load frame image from /frame.png.", e);
        if (toast) {
          toast({ title: "Error", description: "Failed to load the frame image from /public/frame.png. Please ensure it exists.", variant: "destructive" });
        }
    };
  }, [toast]);

  // Save API keys and animal name to localStorage
  const handleSaveKeys = () => {
    try {
      const dataToStore = JSON.stringify({ clipdropKey: apiKeys.clipdropKey, animalName });
      localStorage.setItem('sakuraPetFramesKeys', dataToStore);
      toast({ title: "Settings Saved", description: "ClipDrop API key and animal name saved successfully." });
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast({ title: "Error", description: "Could not save settings.", variant: "destructive" });
    }
  };

  const clearAllStates = () => {
      setUploadedImage(null);
      setCapturedImage(null);
      setFinalFramedImage(null);
      setGeneratedStory('');
      setSelectedCategory(null);
      setSelectedTag(null);
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
       toast({ title: "Inputs Cleared", description: "Ready for a new creation!" });
   };


  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
       clearAllStates();
       const file = event.target.files[0];
        if (!file.type.startsWith('image/')) {
            toast({ title: "Invalid File", description: "Please upload a valid image file.", variant: "destructive" });
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
      toast({ title: "Webcam Error", description: "Could not access webcam. Please check permissions.", variant: "destructive" });
      setUiError("Could not access webcam. Please check permissions.");
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
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        clearAllStates();
        setCapturedImage(dataUrl);
        stopWebcam();
      } else {
         console.error("Failed to get canvas context for capture");
          toast({ title: "Capture Error", description: "Could not capture image from webcam.", variant: "destructive" });
          setUiError("Could not capture image from webcam.");
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
             toast({ title: "Image Error", description: "Could not read uploaded image file.", variant: "destructive" });
             setUiError("Could not read uploaded image file.");
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

        if (newHeight > maxDimension) {
          newHeight = maxDimension;
          newWidth = newHeight * ratio;
        }

        newWidth = Math.floor(newWidth);
        newHeight = Math.floor(newHeight);

        console.log(`New image dimensions: ${newWidth}x${newHeight}`);

        if (!canvasRef.current) {
            return reject(new Error("Resize canvas is not available."));
        }
        const canvas = canvasRef.current; // Reuse capture canvas
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          return reject(new Error("Could not get canvas context for resizing."));
        }

        try {
          ctx.drawImage(img, 0, 0, newWidth, newHeight);
          const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.9); // Use JPEG for potentially smaller size
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
        toast({ title: "No Image", description: "Please upload or capture an image first.", variant: "destructive" });
        setUiError("Please upload or capture an image first.");
        setIsGenerating(false);
        return;
    }

    // --- Basic Input Checks ---
     if (!selectedCategory || !selectedTag) {
      toast({ title: "Missing Selection", description: "Please select a category and tag.", variant: "destructive" });
      setUiError("Please select a category and tag.");
      setIsGenerating(false);
      return;
    }
     if (!apiKeys.clipdropKey) {
       toast({ title: "API Key Missing", description: "Please enter and save your ClipDrop API key.", variant: "destructive" });
       setUiError("Please enter and save your ClipDrop API key.");
       setIsGenerating(false);
       return;
     }
     if (!animalName) {
       toast({ title: "Animal Name Missing", description: "Please enter the animal's name.", variant: "destructive" });
       setUiError("Please enter the animal's name.");
       setIsGenerating(false);
       return;
     }

    try {
        setProgress(5);
        setProgressText("準備緊魔法材料...");

        // --- 1b. Resize Image If Needed ---
        console.log("Checking image size...");
        let resizedResult;
        try {
             resizedResult = await resizeImageIfNeeded(initialImageDataUrl, MAX_IMAGE_DIMENSION);
        } catch(error: any) {
            console.error("Error during image resize check:", error);
            toast({ title: "Image Processing Error", description: `Could not process image: ${error.message}`, variant: "destructive" });
            setUiError(`圖片處理出錯: ${error.message}`);
            setIsGenerating(false);
            return;
        }
        const { resizedDataUrl: finalImageDataUrl, resizedBlob: finalImageBlob } = resizedResult;

        // --- 2. Generate Background Prompt ---
        setProgress(10);
        setProgressText("諗緊個靚背景...");
        console.log("Generating background prompt...");
        let promptResult;
        try {
             promptResult = await generateSakuraPrompt({ category: selectedCategory, tags: selectedTag });
             if (!promptResult || !promptResult.prompt) throw new Error("Empty response from prompt generation");
        } catch (error: any) {
             console.error("Error generating prompt:", error);
             throw new Error(`Failed to generate background prompt: ${error.message || 'Unknown AI error'}`);
        }
        const bgPrompt = promptResult.prompt;
        setProgress(25);
        console.log("Background prompt generated:", bgPrompt);

        // --- 3. Analyze Animal Features ---
        setProgressText("睇緊你隻寵物有幾得意...");
        console.log("Analyzing animal features...");
        let analysisResult;
        try {
             analysisResult = await analyzeAnimalFeatures({ photoDataUri: finalImageDataUrl }); // Use potentially resized data URL
             if (!analysisResult || !analysisResult.animalDescription) throw new Error("Empty response from animal analysis");
        } catch (error: any) {
            console.error("Error analyzing animal:", error);
            throw new Error(`Failed to analyze animal features: ${error.message || 'Unknown AI error'}`);
        }
        const animalDesc = analysisResult.animalDescription;
        setProgress(50);
        console.log("Animal description generated:", animalDesc);

        // --- 4. Generate Cantonese Story ---
        setProgressText("作緊故仔...");
         console.log("Generating story...");
         let storyResult;
         try {
             storyResult = await generateCantoneseStory({
                 animalName: animalName,
                 animalDescription: animalDesc,
                 backgroundDescription: bgPrompt,
             });
             if (!storyResult || !storyResult.story) throw new Error("Empty response from story generation");
         } catch (error: any) {
              console.error("Error generating story:", error);
              throw new Error(`Failed to generate Cantonese story: ${error.message || 'Unknown AI error'}`);
         }
         setGeneratedStory(storyResult.story);
         setProgress(65);
         console.log("Story generated.");

        // --- 5. Replace Background (ClipDrop) ---
        setProgressText("施展緊背景魔法...");
        console.log("Replacing background via ClipDrop...");
        let clipdropResponse;
        try {
             clipdropResponse = await replaceBackground(finalImageBlob, bgPrompt, apiKeys.clipdropKey); // Use potentially resized Blob
             if (!clipdropResponse || !clipdropResponse.image) throw new Error("Invalid response from ClipDrop");
        } catch (error: any) {
             console.error("Error processing image with ClipDrop:", error);
             // Provide specific user-friendly message for ClipDrop errors
             setUiError("唔好意思, 背景替換出咗問題, 請一陣再試啦。");
             throw new Error(`ClipDrop processing failed: ${error.message || error}`); // Throw to stop process
        }
        const processedImageBlob = clipdropResponse.image;
        const processedImageDataUrl = await blobToDataUrl(processedImageBlob);
        setProgress(85);
        console.log("Background replaced.");

        // --- 6. Frame Image ---
        setProgressText("加緊個靚相框...");
        console.log("Framing image...");
        await frameImage(processedImageDataUrl); // frameImage handles its own errors and final state setting
        setProgress(100);
        setProgressText('魔法完成! ✨');
        console.log("Magic complete!");
        toast({ title: "✨ 魔法相框變身完成 ✨", description: "快啲睇下你嘅寵物靚相啦！" });

    } catch (error: any) {
        console.error("Error during generation process:", error);
        // Use the specific UI error if set, otherwise use the caught error message
        const displayError = uiError || error.message || "An unknown error occurred.";
        if (!uiError) { // Only set UI error if not already set (e.g., by ClipDrop specific handler)
            setUiError(`唔好意思, 出咗啲問題: ${displayError}. 請一陣再試啦。`);
        }
        toast({ title: "變身失敗", description: displayError, variant: "destructive" });
        setProgressText('魔法失敗咗...😢'); // Update progress text on failure
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
             toast({ title: "Framing Error", description: "Canvas not ready for framing.", variant: "destructive" });
             setUiError("Canvas not ready for framing.");
             reject(new Error("Canvas not ready"));
             return;
         }
        if (!frameImageRef.current || !frameImageRef.current.complete || frameImageRef.current.naturalWidth === 0) {
             console.error("Frame image ref is not available, not loaded, or has zero dimensions.");
             toast({ title: "Framing Error", description: "Frame image not loaded or invalid. Check console.", variant: "destructive" });
             setUiError("Frame image not loaded or invalid.");
             reject(new Error("Frame image not ready"));
             return;
         }

        const canvas = finalCanvasRef.current;
        const ctx = canvas.getContext('2d');
        const frameImg = frameImageRef.current;

        if (!ctx) {
             console.error("Could not get 2D context from final canvas.");
             toast({ title: "Framing Error", description: "Could not get canvas context.", variant: "destructive" });
             setUiError("Could not get canvas context.");
             reject(new Error("Could not get canvas context"));
             return;
        }

        canvas.width = FRAME_WIDTH;
        canvas.height = FRAME_HEIGHT;
        console.log(`Canvas dimensions set to ${FRAME_WIDTH}x${FRAME_HEIGHT}`);

         try {
             ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
             console.log("Frame image drawn onto canvas.");
         } catch (drawError) {
              console.error("Error drawing frame image onto canvas:", drawError);
              toast({ title: "Framing Error", description: "Could not draw the frame image.", variant: "destructive" });
              setUiError("Could not draw the frame image.");
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

             let drawWidth, drawHeight;
             const imgRatio = processedImg.naturalWidth / processedImg.naturalHeight;
             const targetRatio = targetWidth / targetHeight;

             // Fit image within target dimensions while maintaining aspect ratio
             if (imgRatio > targetRatio) {
                 // Image is wider than target proportionally, fit to width
                 drawWidth = targetWidth;
                 drawHeight = drawWidth / imgRatio;
             } else {
                 // Image is taller than target proportionally (or same ratio), fit to height
                 drawHeight = targetHeight;
                 drawWidth = drawHeight * imgRatio;
             }

             // Ensure dimensions do not exceed the target box (shouldn't happen with logic above, but safe)
             drawWidth = Math.min(drawWidth, targetWidth);
             drawHeight = Math.min(drawHeight, targetHeight);

             // Calculate position to center the image within the target area
             const drawX = targetX + (targetWidth - drawWidth) / 2;
             const drawY = targetY + (targetHeight - drawHeight) / 2;

            console.log(`Target area: ${targetWidth}x${targetHeight} at X=${targetX}, Y=${targetY}`);
            console.log(`Calculated draw dimensions (scaled): ${drawWidth}x${drawHeight}`);
            console.log(`Calculated draw position: X=${drawX}, Y=${drawY}`);

            try {
                 ctx.drawImage(processedImg, drawX, drawY, drawWidth, drawHeight);
                 console.log("Processed image drawn onto canvas.");

                 const finalDataUrl = canvas.toDataURL('image/png');
                 console.log("Final image generated as Data URL.");
                  setFinalFramedImage(finalDataUrl); // Update state here
                  resolve();
            } catch (drawError) {
                console.error("Error drawing processed image onto canvas:", drawError);
                 toast({ title: "Framing Error", description: "Could not draw final image.", variant: "destructive" });
                 setUiError("Could not draw final image.");
                 reject(new Error("Failed to draw processed image on canvas"));
            }
        };
        processedImg.onerror = (e) => {
            console.error("Failed to load processed image for framing:", e);
            toast({ title: "Framing Error", description: "Failed to load processed image for framing.", variant: "destructive" });
            setUiError("Failed to load processed image for framing.");
            reject(new Error("Failed to load processed image"));
        };
        if (processedImageSrc && typeof processedImageSrc === 'string' && processedImageSrc.startsWith('data:image')) {
            console.log("Assigning processed image source to Image object.");
            processedImg.src = processedImageSrc;
        } else {
             console.error("Invalid processed image source provided for framing:", processedImageSrc);
             toast({ title: "Framing Error", description: "Invalid processed image source for framing.", variant: "destructive" });
             setUiError("Invalid processed image source for framing.");
             reject(new Error("Invalid processed image source"));
        }
     });
  };


  const handleDownload = () => {
    if (!finalFramedImage) {
      toast({ title: "No Image", description: "Generate the final image first.", variant: "destructive" });
      setUiError("Generate the final image first.");
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
         toast({ title: "Download Error", description: "Could not initiate image download.", variant: "destructive" });
          setUiError("Could not initiate image download.");
    }
  };

  // Derive current image source for preview, preferring captured, then uploaded (via Object URL)
  const previewImageSrc = capturedImage || currentObjectUrl;
  const showWebcam = isWebcamOpen && !capturedImage;
  const canGenerate = !!(uploadedImage || capturedImage) && !!selectedCategory && !!selectedTag && !!apiKeys.clipdropKey && !!animalName;

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card className="w-full shadow-lg overflow-hidden"> {/* Added overflow hidden */}
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center text-primary flex items-center justify-center gap-2">
            🌸 Montara 櫻花寵物魔法相框
          </CardTitle>
          <CardDescription className="text-center">
             上傳寵物相片，揀個靚景，即刻變身櫻花主題靚相！(Powered by ClipDrop & Genkit)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Simplified Setup */}
          <Card>
             <CardHeader>
                 <CardTitle className="text-xl">基本設定</CardTitle>
                 <CardDescription>入咗一次就唔駛再入㗎喇</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="animalName">寵物名 (Animal's Name)</Label>
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
                    <Label htmlFor="clipdropKey">ClipDrop API Key</Label>
                    <Input
                        id="clipdropKey"
                        type="password"
                        placeholder="Your ClipDrop Key"
                        value={apiKeys.clipdropKey}
                        onChange={(e) => setApiKeys(prev => ({ ...prev, clipdropKey: e.target.value }))}
                        className="mt-1"
                        disabled={isGenerating}
                    />
                    </div>
                 </div>
             </CardContent>
              <CardFooter>
                 <Button onClick={handleSaveKeys} size="sm" disabled={isGenerating}>
                     <Save className="mr-2 h-4 w-4" /> 儲存設定
                 </Button>
              </CardFooter>
          </Card>

          {/* Step 1: Upload or Capture */}
          <Card>
             <CardHeader>
                <CardTitle className="text-xl">1. 上載或拍攝寵物相片</CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
                 <Tabs defaultValue="upload">
                     <TabsList className="grid w-full grid-cols-2">
                         <TabsTrigger value="upload" disabled={isGenerating}><Upload className="mr-2 h-4 w-4 inline"/>上載圖片</TabsTrigger>
                         <TabsTrigger value="webcam" disabled={isGenerating}><Camera className="mr-2 h-4 w-4 inline"/>即時拍攝</TabsTrigger>
                     </TabsList>
                     <TabsContent value="upload">
                         <div className="space-y-2">
                            <Label htmlFor="picture">揀選相片檔案 (建議 2000x2000px 以下)</Label>
                            <Input id="picture" type="file" accept="image/*" onChange={handleImageUpload} disabled={isGenerating} />
                         </div>
                     </TabsContent>
                     <TabsContent value="webcam">
                         <div className="space-y-2">
                             {!isWebcamOpen && (
                                <Button onClick={startWebcam} variant="outline" disabled={hasCameraPermission === false || isGenerating}>
                                    <Camera className="mr-2 h-4 w-4" /> 開啟鏡頭
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
                             {hasCameraPermission === false && (
                                 <Alert variant="destructive">
                                    <AlertTitle>鏡頭權限被拒</AlertTitle>
                                    <AlertDescription>
                                       請喺瀏覽器設定允許使用鏡頭，然後可能需要重新整理頁面。
                                    </AlertDescription>
                                </Alert>
                             )}
                             {hasCameraPermission === null && isWebcamOpen && (
                                 <p className="text-sm text-muted-foreground">要求鏡頭權限中...</p>
                             )}
                            {/* Canvas for webcam capture AND resizing */}
                            <canvas ref={canvasRef} className="hidden"></canvas>
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
             </CardContent>
          </Card>


          {/* Step 2: Select Style */}
           <Card>
            <CardHeader>
                <CardTitle className="text-xl">2. 選擇背景風格</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <Label htmlFor="category">主題 (Category)</Label>
                    <Select onValueChange={(value) => { setSelectedCategory(value as Category); setSelectedTag(null); }} value={selectedCategory || ''} disabled={isGenerating}>
                        <SelectTrigger id="category" className="mt-1">
                        <SelectValue placeholder="選擇一個主題" />
                        </SelectTrigger>
                        <SelectContent>
                        {Object.keys(categories).map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                 </div>
                 <div>
                    <Label htmlFor="tag">風格 (Tag)</Label>
                     <Select onValueChange={(value) => { setSelectedTag(value); }} value={selectedTag || ''} disabled={!selectedCategory || isGenerating}>
                        <SelectTrigger id="tag" className="mt-1">
                        <SelectValue placeholder="選擇一個風格" />
                        </SelectTrigger>
                        <SelectContent>
                        {selectedCategory && categories[selectedCategory].map((tag) => (
                            <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                 </div>
            </CardContent>
          </Card>

          {/* Step 3: Generate */}
          <Card>
             <CardHeader>
                <CardTitle className="text-xl">3. 開始變身！</CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
                 <Button onClick={handleGenerateMagic} disabled={!canGenerate || isGenerating} className="w-full text-lg py-6 bg-gradient-to-r from-pink-500 to-teal-500 hover:from-pink-600 hover:to-teal-600 text-white shadow-lg transition duration-300 ease-in-out transform hover:scale-105 disabled:from-pink-300 disabled:to-teal-300 disabled:scale-100">
                    {isGenerating ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <WandSparkles className="mr-2 h-6 w-6" />}
                    {isGenerating ? '魔法施展中...' : '開始變身魔法'}
                 </Button>
                  {isGenerating && (
                    <div className="space-y-2">
                         {/* Fancy Progress Bar */}
                         <div className="w-full bg-gray-200 rounded-full h-6 dark:bg-gray-700 overflow-hidden shadow-inner">
                           <div
                             className="bg-gradient-to-r from-pink-400 via-purple-400 to-teal-400 h-6 rounded-full transition-all duration-500 ease-out flex items-center justify-center text-xs font-medium text-white"
                             style={{ width: `${progress}%` }}
                           >
                             {progress > 10 && `${progress}%`} {/* Show percentage when progress starts */}
                           </div>
                         </div>
                         <p className="text-sm text-muted-foreground text-center font-medium animate-pulse">
                            {progressText || '準備緊魔法材料...'}
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


          {/* Step 4: Result */}
           {(finalFramedImage || generatedStory) && !isGenerating && progress === 100 && (
             <Card>
                 <CardHeader>
                    <CardTitle className="text-xl">4. ✨ 魔法相框完成 ✨</CardTitle>
                 </CardHeader>
                 <CardContent className="flex flex-col items-center space-y-4">
                    {finalFramedImage && (
                        <img
                            src={finalFramedImage}
                            alt={`Framed photo of ${animalName}`}
                            style={{ maxWidth: '100%', height: 'auto', maxHeight: '70vh' }}
                            className="rounded-md border shadow-md object-contain bg-muted"
                             onError={(e) => {
                                console.error("Error loading final framed image:", e);
                                toast({ title: "圖片載入錯誤", description: "無法顯示最終圖片。", variant: "destructive" });
                                setUiError("無法顯示最終圖片。");
                                setFinalFramedImage(null);
                             }}
                        />
                    )}
                     {generatedStory && (
                        <div className="w-full p-4 bg-primary/10 rounded-md border border-primary/30 mt-4">
                             <Label className="text-lg font-semibold text-primary/90">📖 寵物小故事:</Label>
                             <p className="text-sm mt-2 whitespace-pre-wrap text-foreground/80">{generatedStory}</p>
                         </div>
                      )}
                 </CardContent>
                 <CardFooter className="flex justify-center gap-4 pt-4">
                     {finalFramedImage && (
                        <Button onClick={handleDownload}>
                           <Download className="mr-2 h-4 w-4" /> 下載圖片
                        </Button>
                     )}
                     <Button onClick={handleReset} variant="outline">
                        <RotateCcw className="mr-2 h-4 w-4" /> 再玩一次 (Reset)
                     </Button>
                 </CardFooter>
             </Card>
           )}


         {/* Hidden canvas for final image composition */}
         <canvas ref={finalCanvasRef} className="hidden"></canvas>

        </CardContent>
      </Card>
    </div>
  );
}
