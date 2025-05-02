
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Camera, Upload, Download, Wand2, Save } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// AI flow imports
import { generateSakuraPrompt } from '@/ai/flows/generate-sakura-prompt';
import { analyzeAnimalFeatures } from '@/ai/flows/analyze-animal-features';
import { generateCantoneseStory } from '@/ai/flows/generate-cantonese-story';

// ClipDrop service and helpers
import { replaceBackground, dataUrlToBlob, blobToDataUrl } from '@/services/clipdrop';

// Types - Removed openaiKey from ApiKeys
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

const FRAME_WIDTH = 1410;
const FRAME_HEIGHT = 2250;
const IMAGE_START_Y = 300; // H 300

export default function SakuraPetFramesApp() {
  const { toast } = useToast();
  // Removed openaiKey state
  const [apiKeys, setApiKeys] = useState<ApiKeys>({ clipdropKey: '' });
  const [animalName, setAnimalName] = useState<string>('');
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null); // Base64 Data URL
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [animalDescription, setAnimalDescription] = useState<string>('');
  const [generatedStory, setGeneratedStory] = useState<string>('');
  const [processedImage, setProcessedImage] = useState<string | null>(null); // Base64 Data URL of ClipDrop output
  const [finalFramedImage, setFinalFramedImage] = useState<string | null>(null); // Base64 Data URL
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({
    prompt: false,
    vision: false,
    story: false,
    clipdrop: false,
    framing: false,
  });
  const [isWebcamOpen, setIsWebcamOpen] = useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null); // null = pending, true = granted, false = denied
  const [currentObjectUrl, setCurrentObjectUrl] = useState<string | null>(null); // To manage object URL lifecycle


  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const finalCanvasRef = useRef<HTMLCanvasElement>(null);
  const frameImageRef = useRef<HTMLImageElement | null>(null); // Ref for the frame image

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
          // Removed openaiKey loading
          clipdropKey: parsedKeys.clipdropKey || '',
        });
        setAnimalName(parsedKeys.animalName || '');
      } catch (error) {
        console.error("Failed to parse stored API keys:", error);
        localStorage.removeItem('sakuraPetFramesKeys'); // Clear corrupted data
        toast({ title: "Error", description: "Could not load saved settings. Cleared potentially corrupted data.", variant: "destructive" });
      }
    }
     // Preload the frame image
    const frameImg = new window.Image();
    frameImg.src = '/frame.png'; // Assuming frame.png is in the public folder
    frameImg.onload = () => {
        frameImageRef.current = frameImg;
        console.log("Frame image loaded");
    };
    frameImg.onerror = () => {
        console.error("Failed to load frame image.");
        toast({ title: "Error", description: "Failed to load the frame image.", variant: "destructive" });
    };
  }, [toast]);

  // Save API keys and animal name to localStorage
  const handleSaveKeys = () => {
    try {
      // Removed openaiKey saving
      const dataToStore = JSON.stringify({ clipdropKey: apiKeys.clipdropKey, animalName });
      localStorage.setItem('sakuraPetFramesKeys', dataToStore);
      toast({ title: "Settings Saved", description: "ClipDrop API key and animal name saved successfully." });
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast({ title: "Error", description: "Could not save settings.", variant: "destructive" });
    }
  };

  const clearPreviousImageState = () => {
      setUploadedImage(null);
      setCapturedImage(null);
      setProcessedImage(null);
      setFinalFramedImage(null);
      setAnimalDescription('');
      setGeneratedStory('');
      setGeneratedPrompt(''); // Reset prompt on new image
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
        setCurrentObjectUrl(null);
      }
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
       clearPreviousImageState();
       const file = event.target.files[0];
       setUploadedImage(file);
       const objectUrl = URL.createObjectURL(file);
       setCurrentObjectUrl(objectUrl);
    }
  };

  const startWebcam = async () => {
     setHasCameraPermission(null); // Set to pending
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
      // Do not reset permission status here, user might just be closing the preview
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
        clearPreviousImageState(); // Clear previous states before setting new one
        setCapturedImage(dataUrl);
        stopWebcam(); // Close webcam after capture
      } else {
         console.error("Failed to get canvas context for capture");
          toast({ title: "Capture Error", description: "Could not capture image from webcam.", variant: "destructive" });
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
            // Convert File (Blob) to Data URL
            const dataUrl = await blobToDataUrl(uploadedImage);
            resolve(dataUrl);
        } catch (error) {
             console.error("Error converting uploaded image to Data URL:", error);
             toast({ title: "Image Error", description: "Could not read uploaded image file.", variant: "destructive" });
             reject(null);
        }
      } else {
        resolve(null);
      }
    });
  };

  const getCurrentImageAsBlob = (): Promise<Blob | null> => {
     return new Promise(async (resolve, reject) => {
        if (capturedImage) {
            try {
                const blob = await dataUrlToBlob(capturedImage);
                resolve(blob);
            } catch (error) {
                console.error("Error converting captured image Data URL to Blob:", error);
                toast({ title: "Image Error", description: "Could not process captured image.", variant: "destructive" });
                reject(null);
            }
        } else if (uploadedImage) {
           resolve(uploadedImage); // It's already a File (which is a Blob)
        } else {
            resolve(null);
        }
     });
  };


  const handleGeneratePrompt = async () => {
    if (!selectedCategory || !selectedTag) {
      toast({ title: "Missing Selection", description: "Please select a category and tag.", variant: "destructive" });
      return;
    }
     // Removed check for openaiKey from state
     // The check is now implicit in the flow's execution (will throw if GOOGLE_GENAI_API_KEY is missing)

    setIsLoading(prev => ({ ...prev, prompt: true }));
    setGeneratedPrompt('');
    try {
       const result = await generateSakuraPrompt({ category: selectedCategory, tags: selectedTag });
       if (!result || !result.prompt) throw new Error("Empty response from prompt generation");
       setGeneratedPrompt(result.prompt);
       toast({ title: "Prompt Generated", description: "Sakura background prompt created." });
    } catch (error: any) {
      console.error("Error generating prompt:", error);
      // Provide clearer error message if AI model is not configured
      const errorMessage = error.message && error.message.includes("AI model is not configured")
        ? "AI model is not configured. Please ensure the GOOGLE_GENAI_API_KEY is correctly set in your environment variables."
        : `Failed to generate background prompt: ${error.message || error}`;
      toast({ title: "Generation Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(prev => ({ ...prev, prompt: false }));
    }
  };

  const handleAnalyzeAnimal = async () => {
    let imageDataUrl: string | null = null;
    try {
      imageDataUrl = await getCurrentImageAsDataUrl();
    } catch {
       // Error handled within getCurrentImageAsDataUrl
       return;
    }

    if (!imageDataUrl) {
      toast({ title: "No Image", description: "Please upload or capture an image first.", variant: "destructive" });
      return;
    }
     // Removed check for openaiKey from state

    setIsLoading(prev => ({ ...prev, vision: true }));
    setAnimalDescription('');
    try {
       const result = await analyzeAnimalFeatures({ photoDataUri: imageDataUrl });
       if (!result || !result.animalDescription) throw new Error("Empty response from animal analysis");
       setAnimalDescription(result.animalDescription);
       toast({ title: "Animal Analyzed", description: "Animal features identified." });
    } catch (error: any) {
      console.error("Error analyzing animal:", error);
      // Provide clearer error message if AI model is not configured
      const errorMessage = error.message && error.message.includes("AI model is not configured")
          ? "AI model is not configured. Please ensure the GOOGLE_GENAI_API_KEY is correctly set in your environment variables."
          : `Failed to analyze animal features: ${error.message || error}`;
      toast({ title: "Analysis Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(prev => ({ ...prev, vision: false }));
    }
  };

   const handleGenerateStory = async () => {
    if (!animalName || !animalDescription || !generatedPrompt) {
      toast({ title: "Missing Information", description: "Please provide animal name, analyze the animal, and generate a background prompt first.", variant: "destructive" });
      return;
    }
     // Removed check for openaiKey from state

    setIsLoading(prev => ({ ...prev, story: true }));
    setGeneratedStory('');
    try {
      const result = await generateCantoneseStory({
        animalName: animalName,
        animalDescription: animalDescription,
        backgroundDescription: generatedPrompt,
      });
       if (!result || !result.story) throw new Error("Empty response from story generation");
       setGeneratedStory(result.story);
       toast({ title: "Story Generated", description: "Cantonese story created." });
    } catch (error: any) {
      console.error("Error generating story:", error);
      // Provide clearer error message if AI model is not configured
      const errorMessage = error.message && error.message.includes("AI model is not configured")
          ? "AI model is not configured. Please ensure the GOOGLE_GENAI_API_KEY is correctly set in your environment variables."
          : `Failed to generate Cantonese story: ${error.message || error}`;
      toast({ title: "Generation Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(prev => ({ ...prev, story: false }));
    }
  };

  const handleProcessImage = async () => {
     let imageBlob: Blob | null = null;
     try {
         imageBlob = await getCurrentImageAsBlob();
     } catch {
         // Error handled within getCurrentImageAsBlob
         return;
     }

     if (!imageBlob) {
        toast({ title: "No Image", description: "Please upload or capture an image first.", variant: "destructive" });
        return;
     }
     if (!generatedPrompt) {
        toast({ title: "No Prompt", description: "Please generate a background prompt first.", variant: "destructive" });
        return;
     }
      if (!apiKeys.clipdropKey) {
       toast({ title: "API Key Missing", description: "Please enter and save your ClipDrop API key.", variant: "destructive" });
       return;
     }

     setIsLoading(prev => ({ ...prev, clipdrop: true, framing: true })); // Start both loadings
     setProcessedImage(null);
     setFinalFramedImage(null);

     try {
         const response = await replaceBackground(imageBlob, generatedPrompt, apiKeys.clipdropKey);
         if (!response || !response.image) throw new Error("Invalid response from ClipDrop");

         // Convert the received Blob to a Base64 Data URL for display and framing
         const base64Image = await blobToDataUrl(response.image);
         setProcessedImage(base64Image); // Set the processed image state
         toast({ title: "Background Replaced", description: "ClipDrop processing complete." });

         // Proceed to framing immediately
         await frameImage(base64Image);

     } catch (error: any) {
        console.error("Error processing image with ClipDrop:", error);
        toast({ title: "Processing Error", description: `Failed to replace background: ${error.message || error}`, variant: "destructive" });
        setIsLoading(prev => ({ ...prev, clipdrop: false, framing: false })); // Stop both on error
     }
      // Note: framing loading state is handled within frameImage
  };


  const frameImage = (processedImageSrc: string) => {
     return new Promise<void>((resolve, reject) => {
        if (!finalCanvasRef.current || !frameImageRef.current) {
            toast({ title: "Framing Error", description: "Canvas or frame image not ready.", variant: "destructive" });
             setIsLoading(prev => ({ ...prev, framing: false }));
            reject(new Error("Canvas or frame not ready"));
            return;
        }

        const canvas = finalCanvasRef.current;
        const ctx = canvas.getContext('2d');
        const frameImg = frameImageRef.current;

        if (!ctx) {
             toast({ title: "Framing Error", description: "Could not get canvas context.", variant: "destructive" });
             setIsLoading(prev => ({ ...prev, framing: false }));
             reject(new Error("Could not get canvas context"));
             return;
        }

        canvas.width = FRAME_WIDTH;
        canvas.height = FRAME_HEIGHT;

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const processedImg = new window.Image();
        processedImg.onload = () => {
            const contentWidth = canvas.width;
            const contentHeight = canvas.height - IMAGE_START_Y;
            const imgAspectRatio = processedImg.naturalWidth / processedImg.naturalHeight;
            const contentAspectRatio = contentWidth / contentHeight;

            let drawWidth, drawHeight, drawX, drawY;

            if (imgAspectRatio > contentAspectRatio) {
                drawWidth = contentWidth;
                drawHeight = drawWidth / imgAspectRatio;
                 drawX = 0;
                 drawY = IMAGE_START_Y + (contentHeight - drawHeight) / 2;
            } else {
                drawHeight = contentHeight;
                drawWidth = drawHeight * imgAspectRatio;
                drawX = (contentWidth - drawWidth) / 2;
                drawY = IMAGE_START_Y;
            }

            try {
                 ctx.drawImage(processedImg, drawX, drawY, drawWidth, drawHeight);
                 ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);

                 const finalDataUrl = canvas.toDataURL('image/png');
                  setFinalFramedImage(finalDataUrl);
                  toast({ title: "Image Framed", description: "Your Sakura Pet Frame is ready!" });
                  setIsLoading(prev => ({ ...prev, clipdrop: false, framing: false })); // Stop both loadings
                  resolve();
            } catch (drawError) {
                console.error("Error drawing images onto canvas:", drawError);
                 toast({ title: "Framing Error", description: "Could not draw final image.", variant: "destructive" });
                 setIsLoading(prev => ({ ...prev, clipdrop: false, framing: false })); // Stop both loadings
                 reject(new Error("Failed to draw on canvas"));
            }
        };
        processedImg.onerror = () => {
            toast({ title: "Framing Error", description: "Failed to load processed image for framing.", variant: "destructive" });
            setIsLoading(prev => ({ ...prev, clipdrop: false, framing: false })); // Stop both loadings
            reject(new Error("Failed to load processed image"));
        };
        // Ensure the src is valid before assigning
        if (processedImageSrc && typeof processedImageSrc === 'string' && processedImageSrc.startsWith('data:image')) {
            processedImg.src = processedImageSrc;
        } else {
             toast({ title: "Framing Error", description: "Invalid processed image source for framing.", variant: "destructive" });
             setIsLoading(prev => ({ ...prev, clipdrop: false, framing: false }));
             reject(new Error("Invalid processed image source"));
        }
     });
  };


  const handleDownload = () => {
    if (!finalFramedImage) {
      toast({ title: "No Image", description: "Generate the final image first.", variant: "destructive" });
      return;
    }
    try {
        const link = document.createElement('a');
        link.download = `${animalName || 'sakura_pet'}_frame.png`;
        link.href = finalFramedImage;
        link.click();
    } catch (error) {
         console.error("Error creating download link:", error);
         toast({ title: "Download Error", description: "Could not initiate image download.", variant: "destructive" });
    }
  };

  // Derive current image source for preview, preferring captured, then uploaded (via Object URL)
  const previewImageSrc = capturedImage || currentObjectUrl;
  // Updated canGenerate logic to only check for clipdrop key
  const canGenerate = apiKeys.clipdropKey && !!previewImageSrc && animalName && selectedCategory && selectedTag;
  const showWebcam = isWebcamOpen && !capturedImage;
  const isProcessing = Object.values(isLoading).some(status => status);


  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center text-primary flex items-center justify-center gap-2">
            🌸 Montara 櫻花祭
          </CardTitle>
          <CardDescription className="text-center">
            Create beautiful sakura-themed framed photos for your beloved pets!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* API Keys and Animal Name */}
          <Card>
             <CardHeader>
                 <CardTitle className="text-xl">Settings</CardTitle>
                 <CardDescription>Enter your ClipDrop API key and pet's name. Stored locally.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
                  {/* Removed Google AI Key input field */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Empty div to maintain layout if needed, or adjust grid cols */}
                    <div>{/* Placeholder for layout */}</div>
                    <div>
                    <Label htmlFor="clipdropKey">ClipDrop API Key</Label>
                    <Input
                        id="clipdropKey"
                        type="password"
                        placeholder="Your ClipDrop Key"
                        value={apiKeys.clipdropKey}
                        onChange={(e) => setApiKeys(prev => ({ ...prev, clipdropKey: e.target.value }))}
                        className="mt-1"
                    />
                    </div>
                 </div>
                 <div>
                    <Label htmlFor="animalName">Animal's Name</Label>
                    <Input
                        id="animalName"
                        type="text"
                        placeholder="e.g., Mochi"
                        value={animalName}
                        onChange={(e) => setAnimalName(e.target.value)}
                        className="mt-1"
                    />
                 </div>
             </CardContent>
              <CardFooter>
                 <Button onClick={handleSaveKeys} size="sm">
                     <Save className="mr-2 h-4 w-4" /> Save Settings
                 </Button>
              </CardFooter>
          </Card>

          {/* Image Input */}
          <Card>
             <CardHeader>
                <CardTitle className="text-xl">1. Upload or Capture Pet Photo</CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
                 <Tabs defaultValue="upload">
                     <TabsList className="grid w-full grid-cols-2">
                         <TabsTrigger value="upload"><Upload className="mr-2 h-4 w-4 inline"/>Upload</TabsTrigger>
                         <TabsTrigger value="webcam"><Camera className="mr-2 h-4 w-4 inline"/>Webcam</TabsTrigger>
                     </TabsList>
                     <TabsContent value="upload">
                         <div className="space-y-2">
                            <Label htmlFor="picture">Upload Photo</Label>
                            <Input id="picture" type="file" accept="image/*" onChange={handleImageUpload} />
                         </div>
                     </TabsContent>
                     <TabsContent value="webcam">
                         <div className="space-y-2">
                             {!isWebcamOpen && (
                                <Button onClick={startWebcam} variant="outline" disabled={hasCameraPermission === false}>
                                    <Camera className="mr-2 h-4 w-4" /> Open Webcam
                                </Button>
                             )}
                             {/* Always render video tag to avoid race conditions */}
                              <div className={`relative aspect-video bg-muted rounded-md overflow-hidden ${!showWebcam && 'hidden'}`}>
                                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
                                   {isWebcamOpen && (
                                        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-2">
                                            <Button onClick={captureImage} size="icon" variant="destructive" title="Capture Photo">
                                                <Camera />
                                            </Button>
                                            <Button onClick={stopWebcam} size="icon" variant="secondary" title="Close Webcam">
                                                {/* Simple X icon using SVG */}
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </Button>
                                        </div>
                                   )}
                              </div>

                            {/* Show permission status/errors */}
                             {hasCameraPermission === false && (
                                 <Alert variant="destructive">
                                    <AlertTitle>Camera Access Denied</AlertTitle>
                                    <AlertDescription>
                                        Please allow camera access in your browser settings to use the webcam feature. You might need to refresh the page after changing settings.
                                    </AlertDescription>
                                </Alert>
                             )}
                             {hasCameraPermission === null && (
                                 <p className="text-sm text-muted-foreground">Checking camera permissions...</p>
                             )}

                            <canvas ref={canvasRef} className="hidden"></canvas> {/* Hidden canvas for capture */}
                         </div>
                     </TabsContent>
                 </Tabs>

                  {previewImageSrc && (
                     <div className="mt-4">
                         <Label>Preview:</Label>
                         {/* Use standard img tag for Object URLs and Data URLs */}
                         <img
                            src={previewImageSrc}
                            alt="Uploaded or Captured Pet"
                            width={300}
                            height={225}
                            className="rounded-md border mt-1 object-cover"
                            data-ai-hint="pet animal"
                            // Add error handling for the image itself
                             onError={(e) => {
                                console.error("Error loading preview image:", e);
                                toast({ title: "Image Load Error", description: "Could not display the preview image.", variant: "destructive" });
                                // Optionally clear the broken source
                                if (previewImageSrc === currentObjectUrl) setCurrentObjectUrl(null);
                                if (previewImageSrc === capturedImage) setCapturedImage(null);
                             }}
                         />
                     </div>
                 )}
             </CardContent>
          </Card>


          {/* Category and Tag Selection */}
           <Card>
            <CardHeader>
                <CardTitle className="text-xl">2. Choose Background Theme</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <Label htmlFor="category">Category (分類)</Label>
                    <Select onValueChange={(value) => { setSelectedCategory(value as Category); setSelectedTag(null); setGeneratedPrompt(''); }} value={selectedCategory || ''}>
                        <SelectTrigger id="category" className="mt-1">
                        <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                        {Object.keys(categories).map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                 </div>
                 <div>
                    <Label htmlFor="tag">Tag (標籤)</Label>
                     <Select onValueChange={(value) => { setSelectedTag(value); setGeneratedPrompt(''); }} value={selectedTag || ''} disabled={!selectedCategory}>
                        <SelectTrigger id="tag" className="mt-1">
                        <SelectValue placeholder="Select a tag" />
                        </SelectTrigger>
                        <SelectContent>
                        {selectedCategory && categories[selectedCategory].map((tag) => (
                            <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                 </div>
            </CardContent>
             <CardFooter>
                 {/* Updated button disabled logic - removed openaiKey check */}
                <Button onClick={handleGeneratePrompt} disabled={!selectedCategory || !selectedTag || isLoading.prompt } size="sm">
                   {isLoading.prompt ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                   Generate Background Prompt
                </Button>
             </CardFooter>
             {generatedPrompt && (
                <CardContent>
                    <Label>Generated Prompt:</Label>
                    <Textarea value={generatedPrompt} readOnly className="mt-1 h-20 bg-muted/50"/>
                </CardContent>
             )}
          </Card>

          {/* AI Generation Steps */}
           <Card>
             <CardHeader>
                <CardTitle className="text-xl">3. Generate Story & Final Image</CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    {/* Updated button disabled logic - removed openaiKey check */}
                    <Button onClick={handleAnalyzeAnimal} disabled={!previewImageSrc || isLoading.vision } className="flex-1" variant="outline">
                        {isLoading.vision ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                        Analyze Animal (廣東話)
                    </Button>
                    {/* Updated button disabled logic - removed openaiKey check */}
                    <Button onClick={handleGenerateStory} disabled={!animalName || !animalDescription || !generatedPrompt || isLoading.story } className="flex-1" variant="outline">
                         {isLoading.story ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                        Generate Story (廣東話)
                    </Button>
                </div>
                 {animalDescription && (
                    <div>
                        <Label>Animal Description:</Label>
                        <p className="text-sm p-2 bg-muted/50 rounded-md mt-1">{animalDescription}</p>
                    </div>
                 )}
                  {generatedStory && (
                    <div>
                        <Label>Generated Story:</Label>
                        <p className="text-sm p-2 bg-muted/50 rounded-md mt-1 whitespace-pre-wrap">{generatedStory}</p>
                    </div>
                  )}
                   {/* Updated button disabled logic - removed canGenerate check as it included openaiKey */}
                   <Button onClick={handleProcessImage} disabled={!previewImageSrc || !generatedPrompt || isProcessing || !apiKeys.clipdropKey} className="w-full">
                        {(isLoading.clipdrop || isLoading.framing) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                       {(isLoading.clipdrop && !isLoading.framing) ? 'Replacing Background...' : (isLoading.framing ? 'Framing Image...' : 'Generate Final Framed Image')}
                    </Button>
             </CardContent>
           </Card>


          {/* Final Output */}
          { (isLoading.clipdrop || isLoading.framing || finalFramedImage) && (
             <Card>
                 <CardHeader>
                    <CardTitle className="text-xl">4. Your Sakura Pet Frame</CardTitle>
                 </CardHeader>
                 <CardContent className="flex flex-col items-center">
                    {(isLoading.clipdrop || isLoading.framing) && !finalFramedImage && (
                         <div className="w-full aspect-[141/225] bg-muted rounded-md flex flex-col items-center justify-center p-4 text-center">
                            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4"/>
                             <p className="text-muted-foreground mb-4">{(isLoading.clipdrop && !isLoading.framing) ? 'Replacing background via ClipDrop...' : 'Adding the final frame...'}</p>
                             <Skeleton className="h-[250px] w-[158px] rounded-md" /> {/* Approximate aspect ratio */}
                        </div>
                    )}
                    {finalFramedImage && (
                         // Use standard img tag for the final Data URL
                        <img
                            src={finalFramedImage}
                            alt={`Framed photo of ${animalName}`}
                            width={FRAME_WIDTH / 3} // Scale down for display
                            height={FRAME_HEIGHT / 3}
                            className="rounded-md border shadow-md object-contain" // Use object-contain
                             onError={(e) => {
                                console.error("Error loading final framed image:", e);
                                toast({ title: "Image Load Error", description: "Could not display the final framed image.", variant: "destructive" });
                                setFinalFramedImage(null); // Clear broken source
                             }}
                        />
                    )}
                 </CardContent>
                 {finalFramedImage && !isProcessing && ( // Only show download when not loading
                    <CardFooter className="justify-center">
                        <Button onClick={handleDownload}>
                        <Download className="mr-2 h-4 w-4" /> Download Image
                        </Button>
                    </CardFooter>
                 )}
             </Card>
          )}


         {/* Hidden canvas for final image composition */}
         <canvas ref={finalCanvasRef} className="hidden"></canvas>

        </CardContent>
      </Card>
    </div>
  );
}

