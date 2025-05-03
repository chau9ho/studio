'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Cog } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import FallingSakura from '@/components/animations/FallingSakura';
import SettingsDialog from './SettingsDialog';
import ImageInputSection from './ImageInputSection';
import StyleSelectionSection from './StyleSelectionSection';
import GenerationControlSection from './GenerationControlSection';
import ResultsSection from './ResultsSection';
import GenerationOverlay from './GenerationOverlay';
import PrintableArea from './PrintableArea';

// AI flow imports
import { generateSakuraPrompt } from '@/ai/flows/generate-sakura-prompt';
import { analyzeAnimalFeatures } from '@/ai/flows/analyze-animal-features';
import { generateCantoneseStory } from '@/ai/flows/generate-cantonese-story';

// Service imports
import { replaceBackground } from '@/services/clipdrop';
import { removeBackgroundWithRemoveBg } from '@/services/removebg';
import { dataUrlToBlob, blobToDataUrl } from '@/lib/imageUtils'; // Moved image utils

// Server Action imports
import { uploadFramedImageToGcs } from '@/actions/gcsActions';

// Custom Hooks
import { useImageHandling } from '@/hooks/useImageHandling';
import { useApiKeys } from '@/hooks/useApiKeys';
import { useGeneration } from '@/hooks/useGeneration';
import { useWebcam } from '@/hooks/useWebcam';
import { useGCS } from '@/hooks/useGCS';


// Types
export type Category = '自然風景' | '都市場景' | '幻想世界' | '時空場景' | '文化場景';

export const categories: Record<Category, string[]> = {
    自然風景: ['森林', '山脈', '海岸', '瀑布', '沙漠', '雪景', '日出／日落', '田野', '湖泊', '星空'],
    都市場景: ['天際線', '巷弄小路', '未來城市', '老城街道', '夜景霓虹', '雨中街道', '廢墟城市', '地鐵站', '咖啡店', '屋頂'],
    幻想世界: ['魔法森林', '飄浮島嶼', '古代神殿', '水晶洞窟', '幻想天空', '火山與熔岩', '水下城市', '雲中城堡', '異次元空間', '巨人遺跡'],
    時空場景: ['宇宙星空', '未來世界', '遠古文明', '平行時空', '科幻實驗室', '恐龍時代', '維多利亞時代', '賽博龐克街頭', '蒸汽龐克工廠', '時間隧道'],
    文化場景: ['和風庭園', '歐式古堡', '中式園林', '熱帶市集', '摩洛哥風格', '埃及神廟', '希臘神殿', '印度宮殿', '威尼斯水城', '美國西部小鎮'],
};


// Frame and Content Constants
export const FRAME_WIDTH = 1410;
export const FRAME_HEIGHT = 2250;
export const TARGET_CONTENT_WIDTH = 1410;
export const TARGET_CONTENT_HEIGHT = 1369;
export const TARGET_CONTENT_START_Y = 610;

// Dimension limit
export const MAX_IMAGE_DIMENSION = 2048; // ClipDrop limit


export default function SakuraPetFramesApp() {
    const { toast } = useToast();

    // State Management
    const [animalName, setAnimalName] = useState<string>('');
    const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [removeImageBackground, setRemoveImageBackground] = useState<boolean>(false); // State for remove.bg option
    const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState<boolean>(false);

    // Custom Hooks
    const {
        apiKeys,
        tempApiKeyInput,
        setTempApiKeyInput,
        tempRemoveBgApiKeyInput, // Added remove.bg temp key state
        setTempRemoveBgApiKeyInput, // Added setter
        handleSaveSettings,
        isLoading: keysLoading,
    } = useApiKeys(toast); // Pass toast

    const {
        uploadedImage,
        setUploadedImage,
        capturedImage,
        setCapturedImage,
        currentObjectUrl,
        setCurrentObjectUrl,
        handleImageUpload,
        getCurrentImageDataUrl,
        clearImageSources,
        previewImageSrc
    } = useImageHandling(toast);


    // === Call useGCS *before* useWebcam ===
    const {
        fetchedGcsImages, // Fetched images list
        setFetchedGcsImages, // <--- Added setter
        selectedGcsImage,
        setSelectedGcsImage,
        isFetchingGcsImages,
        gcsFetchError,
        fetchImagesFromGCS,
        handleSelectGcsImage
    } = useGCS(
        animalName,
        toast,
        setCapturedImage,
        setCurrentObjectUrl,
        setUploadedImage
    );


    const videoRef = useRef<HTMLVideoElement>(null);
    const {
        startWebcam,
        stopWebcam,
        captureImage,
        isWebcamOpen,
        hasCameraPermission,
    } = useWebcam(
        videoRef,
        setCapturedImage,
        setCurrentObjectUrl,
        setUploadedImage,
        setSelectedGcsImage,
        toast
    );
    // === End of hook order fix ===


    const finalCanvasRef = useRef<HTMLCanvasElement>(null);
    const frameImageRef = useRef<HTMLImageElement | null>(null);
    const {
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
        frameImage, // Expose frameImage function
        clearGenerationStates,
    } = useGeneration(finalCanvasRef, frameImageRef, toast);


    // Load frame image on mount
    useEffect(() => {
        const frameImg = new window.Image();
        frameImg.src = '/frame.png';
        frameImg.onload = () => {
            frameImageRef.current = frameImg;
            console.log("Frame image loaded successfully from /public/frame.png");
        };
        frameImg.onerror = (e) => {
            console.error("Failed to load frame image from /public/frame.png.", e);
            toast({ title: "Error", description: "Failed to load the frame image from /public/frame.png. Please ensure it exists.", variant: "destructive" });
            setUiError("Failed to load application frame. Please refresh or check the image.");
        };
    }, [toast, setUiError]);

    // Load animal name from localStorage (moved from useApiKeys)
     useEffect(() => {
         const storedSettings = localStorage.getItem('sakuraPetFramesSettings');
         if (storedSettings) {
             try {
                 const parsedSettings = JSON.parse(storedSettings);
                 setAnimalName(parsedSettings.animalName || '');
             } catch (error) {
                 console.error("Failed to parse animal name from stored settings:", error);
             }
         }
     }, []);

     // Save animal name to localStorage (moved from useApiKeys)
     useEffect(() => {
         // Function to update only the animal name in localStorage
         const saveAnimalName = () => {
             try {
                 const storedSettings = localStorage.getItem('sakuraPetFramesSettings');
                 let settings = {};
                 if (storedSettings) {
                     try {
                         settings = JSON.parse(storedSettings);
                     } catch (e) {
                         console.error("Failed to parse existing settings, resetting.", e);
                         settings = {}; // Reset if parsing fails
                     }
                 }
                 const updatedSettings = { ...settings, animalName };
                 localStorage.setItem('sakuraPetFramesSettings', JSON.stringify(updatedSettings));
             } catch (error) {
                 console.error("Failed to save animal name to settings:", error);
                 // Optionally show a toast, but might be too noisy for just name changes
             }
         };

         // Debounce saving animal name
         const handler = setTimeout(() => {
             saveAnimalName();
         }, 500); // Save after 500ms of inactivity

         return () => {
             clearTimeout(handler);
         };
     }, [animalName]);


    // Reset Function
    const handleReset = useCallback(() => {
        clearImageSources();
        setFetchedGcsImages([]); // Clear fetched images state managed by useGCS
        setSelectedGcsImage(null);
        setAnimalName(''); // Clear animal name
        setSelectedCategories([]);
        setSelectedTags([]);
        setRemoveImageBackground(false); // Reset remove.bg option
        clearGenerationStates();
        // Note: API keys are not reset, they persist
        toast({ title: "重新嚟過！", description: "所有嘢清空晒，可以再玩啦！" });
    }, [clearImageSources, clearGenerationStates, toast, setFetchedGcsImages, setSelectedGcsImage]); // <--- Added setFetchedGcsImages dependency


    // Main generation logic
    const handleGenerateMagic = async () => {
        setUiError(null);
        setProgress(0);
        setProgressText('');
        setIsGenerating(true);
        setFinalFramedImage(null);
        setFinalGcsUrl(null);
        setGeneratedStory('');
        setIsUploading(false);

        // --- 1. Input Validation ---
        let initialImageDataUrl: string | null = null;
        try {
            initialImageDataUrl = await getCurrentImageDataUrl();
            if (!initialImageDataUrl) {
                throw new Error("No image source available (upload, webcam, or GCS selection).");
            }
        } catch (error: any) {
            console.error("Error getting current image data URL:", error);
            const errorMsg = `讀取圖片失敗: ${error.message}. 請重試。`;
            setUiError(errorMsg);
            setIsGenerating(false);
            toast({ title: "圖片錯誤", description: errorMsg, variant: "destructive" });
            return;
        }

        if (selectedCategories.length === 0 || selectedTags.length === 0) {
            setUiError("請選擇背景主題同至少一個風格。");
            setIsGenerating(false);
            return;
        }
        if (!apiKeys.clipdropKey) {
            setUiError("ClipDrop API key 未設定。請喺設定輸入。");
            setIsGenerating(false);
            return;
        }
        if (removeImageBackground && !apiKeys.removeBgKey) { // Check remove.bg key if option is enabled
             setUiError("Remove.bg API key 未設定。請喺設定輸入或取消「移除背景」選項。");
             setIsGenerating(false);
             return;
        }
        if (!animalName) {
            setUiError("請輸入寵物名稱。");
            setIsGenerating(false);
            return;
        }

        try {
            // --- 2. Image Preparation ---
            setProgress(5);
            setProgressText("準備緊魔法材料...🧪");

            console.log("Checking image size and converting to Blob...");
            let initialImageBlob: Blob;
            try {
                initialImageBlob = await dataUrlToBlob(initialImageDataUrl);
                // Note: Resizing is now part of ClipDrop/Remove.bg handling if needed by them
                // No explicit resize step here unless absolutely necessary before remove.bg
            } catch (error: any) {
                console.error("Error converting initial image to Blob:", error);
                setUiError(`圖片處理出錯: ${error.message}`);
                throw error;
            }

            // --- 3. Optional Background Removal ---
            let imageToSendToClipDrop: Blob = initialImageBlob;
            let removedBgDataUrl: string | null = null; // To analyze features if bg removed

             if (removeImageBackground) {
                 setProgress(10);
                 setProgressText("施展緊去背魔法...✂️");
                 console.log("Removing background via Remove.bg...");
                 try {
                     const removedBgArrayBuffer = await removeBackgroundWithRemoveBg(initialImageBlob, apiKeys.removeBgKey);
                     const removedBgBlob = new Blob([removedBgArrayBuffer], { type: 'image/png' }); // Assume PNG output

                     // Convert removedBgBlob to DataURL for AI analysis and potential framing
                     removedBgDataUrl = await blobToDataUrl(removedBgBlob);

                      // Use the background-removed image for ClipDrop
                     imageToSendToClipDrop = removedBgBlob;
                     console.log("Background removed successfully.");
                 } catch (error: any) {
                     console.error("Error removing background with Remove.bg:", error);
                     // Decide if this is a fatal error or if we should continue with original image
                      const errorMsg = `Remove.bg 去背失敗: ${error.message}. 將使用原始圖片進行下一步。`;
                      setUiError(errorMsg); // Show non-fatal error
                      toast({ title: "去背失敗", description: errorMsg, variant: "destructive" });
                     // Continue with the original image (imageToSendToClipDrop remains initialImageBlob)
                      removedBgDataUrl = initialImageDataUrl; // Analyze original if remove.bg failed
                     setProgressText("去背失敗，繼續用原圖...");
                     await new Promise(resolve => setTimeout(resolve, 1500)); // Pause briefly
                 }
             } else {
                 removedBgDataUrl = initialImageDataUrl; // Analyze original if not removing bg
             }


            // --- 4. AI Analysis & Story Generation (Parallel Potential) ---
            setProgress(20);
             // Analyze features using the potentially background-removed image data URL
            setProgressText("用魔法睇清楚你隻寵物...🧐");
            console.log("Analyzing animal features...");
            let animalDesc = '';
             try {
                const analysisResult = await analyzeAnimalFeatures({ photoDataUri: removedBgDataUrl }); // Use removedBgDataUrl
                if (!analysisResult || !analysisResult.animalDescription) throw new Error("Empty response from animal analysis");
                 animalDesc = analysisResult.animalDescription;
             } catch (error: any) {
                 console.error("Error analyzing animal:", error);
                 setUiError(`分析動物特徵出錯: ${error.message}.`); // Assume non-fatal for now
                 animalDesc = "一隻可愛嘅寵物"; // Fallback description
                 toast({ title: "分析失敗", description: `分析動物特徵出錯: ${error.message}. 使用預設描述。`, variant: "destructive" });
                 await new Promise(resolve => setTimeout(resolve, 1500));
            }
            setProgress(35);
            console.log("Animal description generated:", animalDesc);

            // Generate background prompt
             setProgressText("唸緊咒語變靚背景...🌸");
             console.log("Generating background prompt...");
             let bgPrompt = '';
             const tagsString = selectedTags.join(', ');
             try {
                 const promptResult = await generateSakuraPrompt({ category: selectedCategories[0] || '世界名勝', tags: tagsString });
                 if (!promptResult || !promptResult.prompt) throw new Error("Empty response from prompt generation");
                 bgPrompt = promptResult.prompt;
             } catch (error: any) {
                 console.error("Error generating prompt:", error);
                 setUiError(`生成背景提示出錯: ${error.message}.`); // Assume non-fatal
                 bgPrompt = "beautiful park with sakura cherry blossoms"; // Fallback prompt
                 toast({ title: "提示生成失敗", description: `生成背景提示出錯: ${error.message}. 使用預設背景提示。`, variant: "destructive" });
                 await new Promise(resolve => setTimeout(resolve, 1500));
             }
             setProgress(50);
             console.log("Background prompt generated:", bgPrompt);


            // Generate story
            setProgressText("作緊個得意故仔...✏️");
            console.log("Generating story...");
             try {
                 const storyResult = await generateCantoneseStory({
                     animalName: animalName,
                     animalDescription: animalDesc, // Use potentially fallback description
                     backgroundDescription: bgPrompt, // Use potentially fallback prompt
                 });
                 if (!storyResult || !storyResult.story) throw new Error("Empty response from story generation");
                  setGeneratedStory(storyResult.story);
             } catch (error: any) {
                 console.error("Error generating story:", error);
                 setUiError(`寫故仔出錯: ${error.message}.`); // Non-fatal
                 setGeneratedStory("（無法生成故事）"); // Indicate failure
                 toast({ title: "故事生成失敗", description: `寫故仔出錯: ${error.message}.`, variant: "destructive" });
                 await new Promise(resolve => setTimeout(resolve, 1500));
            }
            setProgress(60);
            console.log("Story generated.");


            // --- 5. Background Replacement ---
            setProgressText("施展緊背景替換魔法...🪄");
            console.log("Replacing background via ClipDrop...");
            let processedImageBlob: Blob;
            try {
                // ClipDrop might handle resizing internally based on API limits
                const clipdropResponse = await replaceBackground(imageToSendToClipDrop, bgPrompt, apiKeys.clipdropKey);
                if (!clipdropResponse || !clipdropResponse.image) throw new Error("Invalid response from ClipDrop");
                processedImageBlob = clipdropResponse.image;
            } catch (error: any) {
                console.error("Error processing image with ClipDrop:", error);
                let clipDropErrorMsg = `唔好意思, 背景替換出錯: ${error.message}`;
                 if (error.message.includes("API Error (401)") || error.message.includes("API Error (403)")) {
                    clipDropErrorMsg = "ClipDrop API Key 無效或已過期，請檢查設定。";
                 } else if (error.message.includes("API Error (429)")) {
                     clipDropErrorMsg = "ClipDrop API 使用量已達上限，請稍後再試。";
                 } else if (error.message.includes("API Error (400)") && error.message.includes("resolution exceeds")) {
                     clipDropErrorMsg = `圖片解像度過高 (${(imageToSendToClipDrop.size / (1024*1024)).toFixed(1)}MB)，無法處理。請使用較小圖片。`;
                 } else if (error.message.includes("Failed to fetch")) {
                     clipDropErrorMsg = "無法連接 ClipDrop API，請檢查網絡或稍後再試。";
                 }
                 setUiError(clipDropErrorMsg);
                throw new Error(clipDropErrorMsg); // Make ClipDrop error fatal
            }
            const processedImageDataUrl = await blobToDataUrl(processedImageBlob);
            setProgress(75);
            console.log("Background replaced.");

            // --- 6. Framing ---
            setProgressText("最後一步，加個靚相框...🖼️");
            console.log("Framing image...");
            const framedDataUrl = await frameImage(processedImageDataUrl);
            setFinalFramedImage(framedDataUrl);
            setProgress(85);
            console.log("Image framed.");

            // --- 7. Uploading ---
            setProgressText("將靚相放上雲端...☁️");
            setIsUploading(true);
            console.log("Uploading framed image to GCS...");
            try {
                const uploadedUrl = await uploadFramedImageToGcs(framedDataUrl, animalName);
                setFinalGcsUrl(uploadedUrl);
                setProgress(100);
                setProgressText('魔法變身完成! 相已上傳! ✨🎉');
                console.log("Magic complete! Image uploaded to GCS:", uploadedUrl);
                toast({ title: "✨ 魔法相框變身完成 ✨", description: "靚相已經整好兼擺上雲端！" });
            } catch (uploadError: any) {
                console.error("Error uploading framed image to GCS:", uploadError);
                const uploadErrorMsg = `圖片已生成但上傳雲端失敗: ${uploadError.message}. 你仍然可以下載本地圖片。`;
                 setUiError(uploadErrorMsg); // Non-fatal upload error
                setProgress(95); // Indicate completion but with issue
                setProgressText('魔法變身完成，但上傳失敗...😢');
                toast({ title: "變身完成但上傳失敗", description: uploadErrorMsg, variant: "destructive" });
                 // NOTE: finalFramedImage is still set, so download/print should work locally
            } finally {
                setIsUploading(false);
            }

        } catch (error: any) {
            // Catch fatal errors (initial image load, ClipDrop failure)
            console.error("Fatal error during generation process:", error);
            const displayError = uiError || `唔好意思, 出咗啲問題: ${error.message || 'An unknown error occurred.'}. 請一陣再試啦。`;
            if (!uiError) { // Only set UI error if not already set by a specific step
                setUiError(displayError);
            }
            setProgressText('魔法失敗咗...😢');
            toast({ title: "變身失敗", description: displayError, variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };


    // Download Handler
    const handleDownload = () => {
        if (!finalFramedImage) {
            toast({ title: "未有圖片", description: "請先生成最終圖片。", variant: "destructive" });
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
        }
    };

    // Print Handler
    const handlePrint = () => {
        if (!finalFramedImage) {
            toast({ title: "未有圖片", description: "請先生成最終圖片先可以列印。", variant: "destructive" });
            return;
        }
        window.print();
    };

    // Style Selection Handlers
     const handleCategoryChange = (category: Category, checked: boolean | "indeterminate") => {
         setSelectedCategories(prevCats => {
             const newCats = checked === true
                 ? [...prevCats, category]
                 : prevCats.filter(c => c !== category);

             // Filter selectedTags to only include tags from the *newly* selected categories
             const allowedTags = newCats.flatMap(cat => categories[cat]);
             setSelectedTags(prevTags => prevTags.filter(tag => allowedTags.includes(tag)));

             return newCats;
         });
     };

    const handleTagChange = (tag: string, checked: boolean | "indeterminate") => {
        setSelectedTags(prevTags =>
            checked === true ? [...prevTags, tag] : prevTags.filter(t => t !== tag)
        );
    };

    // Derived State
    const showWebcam = isWebcamOpen && !capturedImage;
    const canGenerate = !!(previewImageSrc) && selectedCategories.length > 0 && selectedTags.length > 0 && !!apiKeys.clipdropKey && !!animalName && (!removeImageBackground || !!apiKeys.removeBgKey); // Updated condition
    const qrCodeValue = finalGcsUrl; // QR code should always point to the GCS URL
    const qrUploadUrl = `https://upload-photo-dot-comfyuiserver2024.uc.r.appspot.com/?userName=${encodeURIComponent(animalName || 'Pet')}`;


    return (
        <TooltipProvider>
            <GenerationOverlay
                isGenerating={isGenerating}
                isUploading={isUploading}
                progressText={progressText}
                progress={progress}
                finalGcsUrl={finalGcsUrl}
            />

            <div className="container mx-auto p-4 max-w-4xl relative">
                <FallingSakura />
                <SettingsDialog
                    isOpen={isSettingsDialogOpen}
                    setIsOpen={setIsSettingsDialogOpen}
                    tempApiKeyInput={tempApiKeyInput}
                    setTempApiKeyInput={setTempApiKeyInput}
                    tempRemoveBgApiKeyInput={tempRemoveBgApiKeyInput} // Pass remove.bg key
                    setTempRemoveBgApiKeyInput={setTempRemoveBgApiKeyInput} // Pass setter
                    onSave={handleSaveSettings}
                />
                 {/* Settings Button */}
                 <div className="absolute top-4 right-4 z-20 non-printable settings-button-container">
                     <Button
                         variant="outline"
                         size="icon"
                         onClick={() => setIsSettingsDialogOpen(true)}
                         disabled={keysLoading} // Disable while loading keys
                     >
                         <Cog className={`h-4 w-4 ${keysLoading ? 'animate-spin' : ''}`} />
                         <span className="sr-only">設定</span>
                     </Button>
                 </div>


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
                        <Card className="non-printable">
                            <CardHeader>
                                <CardTitle className="text-xl">1. 揀相 &amp; 揀 Style</CardTitle>
                                <CardDescription>上載、影相或用QR Code提供靚相，再揀你想要嘅背景主題同風格！</CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <ImageInputSection
                                    animalName={animalName}
                                    previewImageSrc={previewImageSrc}
                                    showWebcam={showWebcam}
                                    isWebcamOpen={isWebcamOpen}
                                    hasCameraPermission={hasCameraPermission}
                                    videoRef={videoRef}
                                    handleImageUpload={handleImageUpload}
                                    startWebcam={startWebcam}
                                    captureImage={captureImage}
                                    stopWebcam={stopWebcam}
                                    qrUploadUrl={qrUploadUrl}
                                    fetchedGcsImages={fetchedGcsImages}
                                    selectedGcsImage={selectedGcsImage}
                                    handleSelectGcsImage={handleSelectGcsImage}
                                    isFetchingGcsImages={isFetchingGcsImages}
                                    gcsFetchError={gcsFetchError}
                                    fetchImagesFromGCS={fetchImagesFromGCS}
                                    toast={toast}
                                    setUiError={setUiError}
                                    setCapturedImage={setCapturedImage}
                                    setUploadedImage={setUploadedImage}
                                    setCurrentObjectUrl={setCurrentObjectUrl}
                                    removeImageBackground={removeImageBackground} // Pass state
                                    setRemoveImageBackground={setRemoveImageBackground} // Pass setter
                                />
                                <StyleSelectionSection
                                    animalName={animalName}
                                    setAnimalName={setAnimalName}
                                    selectedCategories={selectedCategories}
                                    selectedTags={selectedTags}
                                    handleCategoryChange={handleCategoryChange}
                                    handleTagChange={handleTagChange}
                                    categories={categories} // Pass down categories
                                />
                            </CardContent>
                        </Card>

                        <GenerationControlSection
                            onGenerate={handleGenerateMagic}
                            disabled={!canGenerate || isGenerating || isUploading}
                            uiError={uiError}
                            isGenerating={isGenerating}
                            isUploading={isUploading}
                        />

                        <ResultsSection
                            finalFramedImage={finalFramedImage}
                            finalGcsUrl={finalGcsUrl}
                            generatedStory={generatedStory}
                            animalName={animalName}
                            qrCodeValue={qrCodeValue}
                            onDownload={handleDownload}
                            onPrint={handlePrint}
                            onReset={handleReset}
                            isGenerating={isGenerating}
                            isUploading={isUploading}
                            toast={toast}
                            setUiError={setUiError}
                            setFinalFramedImage={setFinalFramedImage} // Pass setter for error handling
                            setFinalGcsUrl={setFinalGcsUrl} // Pass setter for error handling
                        />

                        {/* Hidden canvas for framing */}
                        <canvas ref={finalCanvasRef} className="hidden"></canvas>

                    </CardContent>
                    <CardFooter className="text-center text-xs text-muted-foreground justify-center non-printable pt-6">
                        Powered by ClipDrop, Remove.bg & Google AI. Inspired by Montara. ✨
                    </CardFooter>
                </Card>

                 <PrintableArea finalFramedImage={finalFramedImage} animalName={animalName} />

            </div>
        </TooltipProvider>
    );
}
