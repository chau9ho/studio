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

// AI flow imports (assuming they are server actions)
import { generateSakuraPrompt } from '@/ai/flows/generate-sakura-prompt';
import { analyzeAnimalFeatures } from '@/ai/flows/analyze-animal-features';
import { generateCantoneseStory } from '@/ai/flows/generate-cantonese-story';

// Mock ClipDrop service (replace with actual implementation later)
import { replaceBackground } from '@/services/clipdrop'; // Using provided stub

// Types
type ApiKeys = {
  openaiKey: string;
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
  const [apiKeys, setApiKeys] = useState<ApiKeys>({ openaiKey: '', clipdropKey: '' });
  const [animalName, setAnimalName] = useState<string>('');
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null); // Base64 Data URL
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [animalDescription, setAnimalDescription] = useState<string>('');
  const [generatedStory, setGeneratedStory] = useState<string>('');
  const [processedImage, setProcessedImage] = useState<string | null>(null); // Base64 Data URL of final image
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const finalCanvasRef = useRef<HTMLCanvasElement>(null);
  const frameImageRef = useRef<HTMLImageElement | null>(null); // Ref for the frame image


  // Load API keys and animal name from localStorage on mount
  useEffect(() => {
    const storedKeys = localStorage.getItem('sakuraPetFramesKeys');
    if (storedKeys) {
      try {
        const parsedKeys = JSON.parse(storedKeys);
        setApiKeys({
          openaiKey: parsedKeys.openaiKey || '',
          clipdropKey: parsedKeys.clipdropKey || '',
        });
        setAnimalName(parsedKeys.animalName || '');
      } catch (error) {
        console.error("Failed to parse stored API keys:", error);
        toast({ title: "Error", description: "Could not load saved settings.", variant: "destructive" });
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
      const dataToStore = JSON.stringify({ ...apiKeys, animalName });
      localStorage.setItem('sakuraPetFramesKeys', dataToStore);
      toast({ title: "Settings Saved", description: "API keys and animal name saved successfully." });
    } catch (error) {
      console.error("Failed to save API keys:", error);
      toast({ title: "Error", description: "Could not save settings.", variant: "destructive" });
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setUploadedImage(event.target.files[0]);
      setCapturedImage(null); // Clear captured image if uploading
      setProcessedImage(null);
      setFinalFramedImage(null);
      setAnimalDescription('');
      setGeneratedStory('');
       setGeneratedPrompt(''); // Reset prompt on new image
    }
  };

  const startWebcam = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setIsWebcamOpen(true);
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
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
        setCapturedImage(dataUrl);
        setUploadedImage(null); // Clear uploaded file
        setProcessedImage(null);
        setFinalFramedImage(null);
        setAnimalDescription('');
        setGeneratedStory('');
        setGeneratedPrompt(''); // Reset prompt on new image
        stopWebcam(); // Close webcam after capture
      }
    }
  };

  // Effect to clean up webcam stream when component unmounts or webcam is closed
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, [stopWebcam]);


  const getCurrentImageAsDataUrl = (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (capturedImage) {
        resolve(capturedImage);
      } else if (uploadedImage) {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.onerror = () => {
          resolve(null);
        }
        reader.readAsDataURL(uploadedImage);
      } else {
        resolve(null);
      }
    });
  };

  const getCurrentImageAsBuffer = (): Promise<Buffer | null> => {
     return new Promise(async (resolve) => {
        const dataUrl = await getCurrentImageAsDataUrl();
        if (dataUrl) {
            // Convert Data URL to Blob, then to ArrayBuffer, then to Buffer
            try {
                const response = await fetch(dataUrl);
                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                resolve(Buffer.from(arrayBuffer));
            } catch (error) {
                 console.error("Error converting Data URL to Buffer:", error);
                 resolve(null);
            }
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
    if (!apiKeys.openaiKey) {
       toast({ title: "API Key Missing", description: "Please enter your OpenAI API key.", variant: "destructive" });
       return;
    }
    // TODO: Remove this check once genkit is configured properly
     if (apiKeys.openaiKey === 'DISABLED') {
      const fakePrompt = `A ${selectedTag} landscape under a vibrant sky, with ${selectedCategory.toLowerCase()} elements and blooming sakura trees casting soft pink light.`;
      setGeneratedPrompt(fakePrompt);
       toast({ title: "Using Fake Prompt", description: "OpenAI API key is disabled, using a placeholder prompt." });
      return;
    }


    setIsLoading(prev => ({ ...prev, prompt: true }));
    setGeneratedPrompt('');
    try {
      // Assuming generateSakuraPrompt is a server action/API call
       const result = await generateSakuraPrompt({ category: selectedCategory, tags: selectedTag });
       setGeneratedPrompt(result.prompt);
       toast({ title: "Prompt Generated", description: "Sakura background prompt created." });
    } catch (error) {
      console.error("Error generating prompt:", error);
      toast({ title: "Generation Error", description: "Failed to generate background prompt.", variant: "destructive" });
    } finally {
      setIsLoading(prev => ({ ...prev, prompt: false }));
    }
  };

  const handleAnalyzeAnimal = async () => {
    const imageDataUrl = await getCurrentImageAsDataUrl();
    if (!imageDataUrl) {
      toast({ title: "No Image", description: "Please upload or capture an image first.", variant: "destructive" });
      return;
    }
     if (!apiKeys.openaiKey) {
       toast({ title: "API Key Missing", description: "Please enter your OpenAI API key.", variant: "destructive" });
       return;
    }
     // TODO: Remove this check once genkit is configured properly
     if (apiKeys.openaiKey === 'DISABLED') {
        const fakeDescription = "一隻可愛嘅寵物 (假描述)"; // Fake Cantonese description
        setAnimalDescription(fakeDescription);
        toast({ title: "Using Fake Analysis", description: "OpenAI API key is disabled, using placeholder analysis." });
        return;
     }

    setIsLoading(prev => ({ ...prev, vision: true }));
    setAnimalDescription('');
    try {
       // Assuming analyzeAnimalFeatures is a server action/API call
       const result = await analyzeAnimalFeatures({ photoDataUri: imageDataUrl });
       setAnimalDescription(result.animalDescription);
       toast({ title: "Animal Analyzed", description: "Animal features identified." });
    } catch (error) {
      console.error("Error analyzing animal:", error);
      toast({ title: "Analysis Error", description: "Failed to analyze animal features.", variant: "destructive" });
    } finally {
      setIsLoading(prev => ({ ...prev, vision: false }));
    }
  };

   const handleGenerateStory = async () => {
    if (!animalName || !animalDescription || !generatedPrompt) {
      toast({ title: "Missing Information", description: "Please provide animal name, analyze the animal, and generate a background prompt first.", variant: "destructive" });
      return;
    }
     if (!apiKeys.openaiKey) {
       toast({ title: "API Key Missing", description: "Please enter your OpenAI API key.", variant: "destructive" });
       return;
    }
     // TODO: Remove this check once genkit is configured properly
     if (apiKeys.openaiKey === 'DISABLED') {
        const fakeStory = `${animalName} 係一隻 ${animalDescription}。有一日佢喺個充滿櫻花嘅 ${selectedTag || '地方'} 探險，覺得好開心。(假故事)`;
        setGeneratedStory(fakeStory);
        toast({ title: "Using Fake Story", description: "OpenAI API key is disabled, using placeholder story." });
        return;
     }

    setIsLoading(prev => ({ ...prev, story: true }));
    setGeneratedStory('');
    try {
       // Assuming generateCantoneseStory is a server action/API call
      const result = await generateCantoneseStory({
        animalName: animalName,
        animalDescription: animalDescription,
        backgroundDescription: generatedPrompt, // Use the generated English prompt as scene description
      });
       setGeneratedStory(result.story);
       toast({ title: "Story Generated", description: "Cantonese story created." });
    } catch (error) {
      console.error("Error generating story:", error);
      toast({ title: "Generation Error", description: "Failed to generate Cantonese story.", variant: "destructive" });
    } finally {
      setIsLoading(prev => ({ ...prev, story: false }));
    }
  };

  const handleProcessImage = async () => {
     const imageBuffer = await getCurrentImageAsBuffer();
     if (!imageBuffer) {
        toast({ title: "No Image", description: "Please upload or capture an image first.", variant: "destructive" });
        return;
     }
     if (!generatedPrompt) {
        toast({ title: "No Prompt", description: "Please generate a background prompt first.", variant: "destructive" });
        return;
     }
      if (!apiKeys.clipdropKey) {
       toast({ title: "API Key Missing", description: "Please enter your ClipDrop API key.", variant: "destructive" });
       return;
     }

     setIsLoading(prev => ({ ...prev, clipdrop: true, framing: true })); // Start both loadings
     setProcessedImage(null);
     setFinalFramedImage(null);

     try {
        // Call ClipDrop API (replace with actual call later)
         const response = await replaceBackground(imageBuffer, generatedPrompt); // Using stub

         // Convert the received Buffer to a Base64 Data URL
         const base64Image = `data:image/jpeg;base64,${response.image.toString('base64')}`;
         setProcessedImage(base64Image);
         toast({ title: "Background Replaced", description: "ClipDrop processing complete." });

         // Proceed to framing immediately after ClipDrop success
         await frameImage(base64Image);

     } catch (error) {
        console.error("Error processing image with ClipDrop:", error);
        toast({ title: "Processing Error", description: "Failed to replace background using ClipDrop.", variant: "destructive" });
        setIsLoading(prev => ({ ...prev, clipdrop: false, framing: false })); // Stop both on error
     }
      // Note: framing loading state is handled within frameImage
  };


  const frameImage = (imageSrc: string) => {
     return new Promise<void>((resolve, reject) => {
        if (!finalCanvasRef.current || !frameImageRef.current) {
            toast({ title: "Framing Error", description: "Canvas or frame not ready.", variant: "destructive" });
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

        // Draw white background (redundant if frame.png has white bg, but safe)
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Load the processed image (ClipDrop output)
        const processedImg = new window.Image();
        processedImg.onload = () => {
            // Calculate dimensions to fit within the frame's content area, maintaining aspect ratio
            const contentWidth = canvas.width; // Assume image spans full width inside frame
            const contentHeight = canvas.height - IMAGE_START_Y; // Height available for image
            const imgAspectRatio = processedImg.naturalWidth / processedImg.naturalHeight;
            const contentAspectRatio = contentWidth / contentHeight;

            let drawWidth, drawHeight, drawX, drawY;

            if (imgAspectRatio > contentAspectRatio) {
                // Image is wider than content area
                drawWidth = contentWidth;
                drawHeight = drawWidth / imgAspectRatio;
                 drawX = 0;
                 // Center vertically within the image area
                 drawY = IMAGE_START_Y + (contentHeight - drawHeight) / 2;
            } else {
                // Image is taller than or equal aspect ratio to content area
                drawHeight = contentHeight;
                drawWidth = drawHeight * imgAspectRatio;
                // Center horizontally within the image area
                drawX = (contentWidth - drawWidth) / 2;
                drawY = IMAGE_START_Y;
            }


            // Draw the processed image onto the canvas at the calculated position and size
            ctx.drawImage(processedImg, drawX, drawY, drawWidth, drawHeight);

            // Draw the frame overlay on top
            ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);

            // Set the final framed image state
            setFinalFramedImage(canvas.toDataURL('image/png'));
            toast({ title: "Image Framed", description: "Your Sakura Pet Frame is ready!" });
            setIsLoading(prev => ({ ...prev, clipdrop: false, framing: false })); // Stop both loadings
            resolve();
        };
        processedImg.onerror = () => {
            toast({ title: "Framing Error", description: "Failed to load processed image for framing.", variant: "destructive" });
            setIsLoading(prev => ({ ...prev, clipdrop: false, framing: false })); // Stop both loadings
            reject(new Error("Failed to load processed image"));
        };
        processedImg.src = imageSrc;
     });
  };


  const handleDownload = () => {
    if (!finalFramedImage) {
      toast({ title: "No Image", description: "Generate the final image first.", variant: "destructive" });
      return;
    }
    const link = document.createElement('a');
    link.download = `${animalName || 'sakura_pet'}_frame.png`;
    link.href = finalFramedImage;
    link.click();
  };

  const canGenerate = apiKeys.openaiKey && apiKeys.clipdropKey && (uploadedImage || capturedImage) && animalName && selectedCategory && selectedTag;
  const currentImageSrc = capturedImage || (uploadedImage ? URL.createObjectURL(uploadedImage) : null);
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
                 <CardDescription>Enter your API keys and pet's name. Stored locally.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                    <Label htmlFor="openaiKey">OpenAI API Key (LMZH)</Label>
                    <Input
                        id="openaiKey"
                        type="password"
                        placeholder="sk-..."
                        value={apiKeys.openaiKey}
                        onChange={(e) => setApiKeys(prev => ({ ...prev, openaiKey: e.target.value }))}
                        className="mt-1"
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
                                <Button onClick={startWebcam} variant="outline">
                                    <Camera className="mr-2 h-4 w-4" /> Open Webcam
                                </Button>
                             )}
                              {showWebcam && (
                                <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                                     <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
                                     <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-2">
                                        <Button onClick={captureImage} size="icon" variant="destructive">
                                            <Camera />
                                        </Button>
                                        <Button onClick={stopWebcam} size="icon" variant="secondary">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-webcam-off"><path d="M17 10a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h4"/><path d="M11.78 15.15A5.96 5.96 0 0 1 12 15a6 6 0 0 1-6-6c0-.61.09-1.2.26-1.75"/><path d="M8.7 4.71A5.94 5.94 0 0 1 12 4a6 6 0 0 1 6 6c0 1.26-.39 2.44-1.04 3.44"/><line x1="2" x2="22" y1="2" y2="22"/><path d="M7 19a1 1 0 0 0-1 1v.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-.5a1 1 0 0 0-1-1Z"/></svg>
                                         </Button>
                                     </div>
                                </div>
                             )}
                            <canvas ref={canvasRef} className="hidden"></canvas> {/* Hidden canvas for capture */}
                         </div>
                     </TabsContent>
                 </Tabs>

                  {currentImageSrc && (
                     <div className="mt-4">
                         <Label>Preview:</Label>
                         <Image
                            src={currentImageSrc}
                            alt="Uploaded or Captured Pet"
                            width={300}
                            height={225}
                            className="rounded-md border mt-1 object-cover"
                            data-ai-hint="pet animal"
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
                <Button onClick={handleGeneratePrompt} disabled={!selectedCategory || !selectedTag || isLoading.prompt || !apiKeys.openaiKey || apiKeys.openaiKey === 'DISABLED'} size="sm">
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
                    <Button onClick={handleAnalyzeAnimal} disabled={!currentImageSrc || isLoading.vision || !apiKeys.openaiKey || apiKeys.openaiKey === 'DISABLED'} className="flex-1" variant="outline">
                        {isLoading.vision ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                        Analyze Animal (廣東話)
                    </Button>
                    <Button onClick={handleGenerateStory} disabled={!animalName || !animalDescription || !generatedPrompt || isLoading.story || !apiKeys.openaiKey || apiKeys.openaiKey === 'DISABLED'} className="flex-1" variant="outline">
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
                   <Button onClick={handleProcessImage} disabled={!currentImageSrc || !generatedPrompt || isProcessing || !apiKeys.clipdropKey} className="w-full">
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
                         <div className="w-full aspect-[141/225] bg-muted rounded-md flex flex-col items-center justify-center">
                            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4"/>
                             <p className="text-muted-foreground">{(isLoading.clipdrop && !isLoading.framing) ? 'Replacing background via ClipDrop...' : 'Adding the final frame...'}</p>
                             <Skeleton className="h-[250px] w-[158px] rounded-md mt-4" /> {/* Approximate aspect ratio */}
                        </div>
                    )}
                    {finalFramedImage && (
                        <Image
                            src={finalFramedImage}
                            alt={`Framed photo of ${animalName}`}
                            width={FRAME_WIDTH / 3} // Scale down for display
                            height={FRAME_HEIGHT / 3}
                            className="rounded-md border shadow-md"
                        />
                    )}
                 </CardContent>
                 {finalFramedImage && (
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
