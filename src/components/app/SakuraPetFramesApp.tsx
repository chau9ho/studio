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

// ClipDrop service and helpers
import { replaceBackground, dataUrlToBlob, blobToDataUrl } from '@/services/clipdrop';

// Server Action imports
import { listPetImages, fetchGcsImageAsDataUrl, uploadFramedImageToGcs } from '@/actions/gcsActions';

// Types
type ApiKeys = {
  clipdropKey: string;
};

// Default API Key
const DEFAULT_CLIPDROP_KEY = process.env.NEXT_PUBLIC_CLIPDROP_API_KEY || 'dbe3bc24b88a9804d1dee978f6cb30f168886d7ababf3e09c76b81d3767beac1b305f6997c1a7d163766ac2ef54981bc';

// Categories and Tags (Moved from StyleSelectionSection for central access)
export type Category = '世界名勝' | '季節景色' | '氣氛情調' | '藝術風格';

export const categories: Record<Category, string[]> = {
    世界名勝: ['巴黎鐵塔', '自由女神像', '羅馬競技場', '萬里長城', '悉尼歌劇院', '埃及金字塔', '泰姬陵', '馬丘比丘', '大峽谷', '富士山', '聖彼得大教堂'],
    季節景色: ['春日櫻花', '夏日海灘', '秋天紅葉', '冬季雪景', '春雨綿綿', '夏日向日葵', '秋收稻田', '冬日聖誕', '春季花海', '夏季星空', '秋日夕陽'],
    氣氛情調: ['浪漫溫馨', '神秘幽暗', '歡樂熱鬧', '寧靜平和', '夢幻迷離', '復古懷舊', '緊張刺激', '奇幻冒險', '溫暖治癒', '孤獨冷清', '活力四射'],
    藝術風格: ['印象派油畫', '水彩畫風', '卡通漫畫', '賽博朋克', '蒸汽朋克', '巴洛克華麗', '極簡現代', '復古像素', '浮世繪風', '哥德式黑暗', '超現實主義'],
};


// Frame and Content Constants
const FRAME_WIDTH = 1410;
const FRAME_HEIGHT = 2250;
const TARGET_CONTENT_WIDTH = 1410;
const TARGET_CONTENT_HEIGHT = 1369;
const TARGET_CONTENT_START_Y = 610;

// ClipDrop dimension limit
const MAX_IMAGE_DIMENSION = 2048;

// Canvas for resizing
let resizeCanvas: HTMLCanvasElement | null = null;
if (typeof window !== 'undefined') {
    resizeCanvas = document.createElement('canvas');
    console.log("Resize canvas created.");
}

export default function SakuraPetFramesApp() {
    const { toast } = useToast();
    const [apiKeys, setApiKeys] = useState<ApiKeys>({ clipdropKey: '' }); // Initialize empty, load from effect
    const [tempApiKeyInput, setTempApiKeyInput] = useState<string>('');
    const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState<boolean>(false);
    const [animalName, setAnimalName] = useState<string>('');
    const [uploadedImage, setUploadedImage] = useState<File | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [fetchedGcsImages, setFetchedGcsImages] = useState<string[]>([]);
    const [selectedGcsImage, setSelectedGcsImage] = useState<string | null>(null);
    const [isFetchingGcsImages, setIsFetchingGcsImages] = useState<boolean>(false);
    const [gcsFetchError, setGcsFetchError] = useState<string | null>(null);
    const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [generatedStory, setGeneratedStory] = useState<string>('');
    const [finalFramedImage, setFinalFramedImage] = useState<string | null>(null);
    const [finalGcsUrl, setFinalGcsUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [progressText, setProgressText] = useState<string>('');
    const [uiError, setUiError] = useState<string | null>(null);
    const [isWebcamOpen, setIsWebcamOpen] = useState<boolean>(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const [currentObjectUrl, setCurrentObjectUrl] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const finalCanvasRef = useRef<HTMLCanvasElement>(null);
    const frameImageRef = useRef<HTMLImageElement | null>(null);
    const captureCanvasRef = useRef<HTMLCanvasElement>(null);

    // Cleanup Object URL
    useEffect(() => {
        return () => {
            if (currentObjectUrl) {
                URL.revokeObjectURL(currentObjectUrl);
                console.log("Revoked Object URL:", currentObjectUrl);
                setCurrentObjectUrl(null);
            }
        };
    }, [currentObjectUrl]);

    // Load API keys, animal name, and frame image on mount
    useEffect(() => {
        // Load settings
        const storedSettings = localStorage.getItem('sakuraPetFramesSettings');
        let loadedKey = DEFAULT_CLIPDROP_KEY;
        let loadedName = '';

        if (storedSettings) {
            try {
                const parsedSettings = JSON.parse(storedSettings);
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
        setTempApiKeyInput(loadedKey === DEFAULT_CLIPDROP_KEY ? '' : loadedKey); // Only show saved key in input if it's not the default
        setAnimalName(loadedName);

        // Load frame image
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
    }, [toast]);

    // Save API keys and animal name
    const handleSaveSettings = () => {
        try {
            const keyToSave = tempApiKeyInput.trim();
            const finalKeyToUse = keyToSave || DEFAULT_CLIPDROP_KEY;

            const dataToStore = JSON.stringify({ clipdropKey: keyToSave, animalName }); // Store user input (even if empty)
            localStorage.setItem('sakuraPetFramesSettings', dataToStore);

            setApiKeys({ clipdropKey: finalKeyToUse }); // Update active key state

            toast({ title: "設定已儲存", description: "寵物名同 ClipDrop API Key 已經儲存好。" });
            setIsSettingsDialogOpen(false);
        } catch (error) {
            console.error("Failed to save settings:", error);
            toast({ title: "儲存失敗", description: "無法儲存設定。", variant: "destructive" });
        }
    };

    const clearAllStates = () => {
        setUploadedImage(null);
        setCapturedImage(null);
        setFetchedGcsImages([]);
        setSelectedGcsImage(null);
        setGcsFetchError(null);
        setFinalFramedImage(null);
        setFinalGcsUrl(null);
        setGeneratedStory('');
        setSelectedCategories([]);
        setSelectedTags([]);
        setUiError(null);
        setProgress(0);
        setProgressText('');
        setIsGenerating(false);
        setIsFetchingGcsImages(false);
        setIsUploading(false);
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
            setUploadedImage(null);
            setCapturedImage(null);
            setSelectedGcsImage(null);
            setFinalFramedImage(null);
            setFinalGcsUrl(null);
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
                setUploadedImage(null);
                setSelectedGcsImage(null);
                setCapturedImage(dataUrl);
                setFinalFramedImage(null);
                setFinalGcsUrl(null);
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

    // Cleanup webcam stream on unmount
    useEffect(() => {
        return () => {
            stopWebcam();
        };
    }, [stopWebcam]);

    // Fetch images from GCS
    const fetchImagesFromGCS = useCallback(async () => {
        if (!animalName) {
            setFetchedGcsImages([]);
            setGcsFetchError(null);
            return;
        }
        setIsFetchingGcsImages(true);
        setGcsFetchError(null);
        setFetchedGcsImages([]);
        setSelectedGcsImage(null);

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

    // Trigger GCS fetch on animal name change (debounced)
    useEffect(() => {
        const handler = setTimeout(() => {
            if (animalName) {
                fetchImagesFromGCS();
            } else {
                setFetchedGcsImages([]);
                setSelectedGcsImage(null);
                setGcsFetchError(null);
            }
        }, 500);

        return () => {
            clearTimeout(handler);
        };
    }, [animalName, fetchImagesFromGCS]);

    // Handle selecting a GCS image
    const handleSelectGcsImage = async (imageUrl: string) => {
        setSelectedGcsImage(imageUrl);
        setUiError(null);
        setUploadedImage(null);
        setCapturedImage(null); // Clear direct capture first
        setFinalFramedImage(null);
        setFinalGcsUrl(null);
        if (currentObjectUrl) {
            URL.revokeObjectURL(currentObjectUrl);
            setCurrentObjectUrl(null);
        }

        setProgressText("由雲端載入緊圖片...");
        setProgress(5);
        try {
            const dataUrl = await fetchGcsImageAsDataUrl(imageUrl);
            if (!dataUrl) {
                throw new Error("Server action returned empty data URL.");
            }
            setCapturedImage(dataUrl); // Set capturedImage with the data URL from GCS
            console.log("Selected GCS image loaded as Data URL via server action:", imageUrl);
            toast({ title: "圖片已選取", description: "已選取並載入雲端圖片。" });
            setProgress(0);
            setProgressText('');
        } catch (error: any) {
            console.error("Error loading selected GCS image via server action:", error);
            const errorMsg = `無法載入選定嘅圖片: ${error.message}`;
            toast({ title: "載入失敗", description: errorMsg, variant: "destructive" });
            setUiError(errorMsg);
            setSelectedGcsImage(null);
            setCapturedImage(null); // Clear capture on error
            setProgress(0);
            setProgressText('');
        }
    };

    // Get current image source as Data URL
    const getCurrentImageAsDataUrl = (): Promise<string | null> => {
        return new Promise(async (resolve, reject) => {
            if (capturedImage) { // Handles webcam and SELECTED GCS image
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

    // Resize image if needed
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
                setProgressText("張相太大喇，幫你變細啲先...");

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

                resizeCanvas.width = newWidth;
                resizeCanvas.height = newHeight;

                try {
                    ctx.clearRect(0, 0, newWidth, newHeight);
                    ctx.drawImage(img, 0, 0, newWidth, newHeight);
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

    // Frame the image
    const frameImage = (processedImageSrc: string): Promise<string> => {
        return new Promise<string>((resolve, reject) => {
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
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height); // Draw the white frame
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

        let initialImageDataUrl: string | null = null;
        try {
            initialImageDataUrl = await getCurrentImageAsDataUrl();
            if (!initialImageDataUrl) {
                throw new Error("No image source available (upload, webcam, or GCS selection).");
            }
        } catch (error: any) {
            console.error("Error getting current image data URL:", error);
            setUiError(`讀取圖片失敗: ${error.message}. 請重試。`);
            setIsGenerating(false);
            toast({ title: "圖片錯誤", description: `讀取圖片失敗: ${error.message}`, variant: "destructive" });
            return;
        }

        if (selectedCategories.length === 0 || selectedTags.length === 0) {
            toast({ title: "未揀好", description: "請選擇一個背景主題同至少一個風格。", variant: "destructive" });
            setUiError("請選擇背景主題同至少一個風格。");
            setIsGenerating(false);
            return;
        }
        if (!apiKeys.clipdropKey) {
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
                resizedResult = await resizeImageIfNeeded(initialImageDataUrl, MAX_IMAGE_DIMENSION);
            } catch (error: any) {
                console.error("Error during image resize check:", error);
                setUiError(`圖片處理出錯: ${error.message}`);
                throw error;
            }
            const { resizedDataUrl: finalImageDataUrl, resizedBlob: finalImageBlob } = resizedResult;

            setProgress(10);
            setProgressText("唸緊咒語變靚背景...🌸");
            console.log("Generating background prompt...");
            let promptResult;
            const tagsString = selectedTags.join(', ');
            try {
                promptResult = await generateSakuraPrompt({ category: selectedCategories[0] || '世界名勝', tags: tagsString });
                if (!promptResult || !promptResult.prompt) throw new Error("Empty response from prompt generation");
            } catch (error: any) {
                console.error("Error generating prompt:", error);
                setUiError(`生成背景提示出錯: ${error.message}. 請檢查 AI 配置或稍後再試。`);
                throw error;
            }
            const bgPrompt = promptResult.prompt;
            setProgress(25);
            console.log("Background prompt generated:", bgPrompt);

            setProgressText("用魔法睇清楚你隻寵物...🧐");
            console.log("Analyzing animal features...");
            let analysisResult;
            try {
                analysisResult = await analyzeAnimalFeatures({ photoDataUri: finalImageDataUrl });
                if (!analysisResult || !analysisResult.animalDescription) throw new Error("Empty response from animal analysis");
            } catch (error: any) {
                console.error("Error analyzing animal:", error);
                setUiError(`分析動物特徵出錯: ${error.message}. 請檢查 AI 配置或稍後再試。`);
                throw error;
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
                    backgroundDescription: bgPrompt,
                });
                if (!storyResult || !storyResult.story) throw new Error("Empty response from story generation");
            } catch (error: any) {
                console.error("Error generating story:", error);
                setUiError(`寫故仔出錯: ${error.message}. 請檢查 AI 配置或稍後再試。`);
                throw error;
            }
            setGeneratedStory(storyResult.story);
            setProgress(60);
            console.log("Story generated.");

            setProgressText("施展緊背景替換魔法...🪄");
            console.log("Replacing background via ClipDrop...");
            let clipdropResponse;
            try {
                clipdropResponse = await replaceBackground(finalImageBlob, bgPrompt, apiKeys.clipdropKey);
                if (!clipdropResponse || !clipdropResponse.image) throw new Error("Invalid response from ClipDrop");
            } catch (error: any) {
                console.error("Error processing image with ClipDrop:", error);
                setUiError("唔好意思, 背景替換出錯，請一陣再試啦。");
                if (error.message.includes("API Error (401)") || error.message.includes("API Error (403)")) {
                    setUiError("ClipDrop API Key 無效或已過期，請檢查設定。");
                } else if (error.message.includes("API Error (429)")) {
                    setUiError("ClipDrop API 使用量已達上限，請稍後再試。");
                } else if (error.message.includes("API Error (400)") && error.message.includes("resolution exceeds")) {
                    setUiError("圖片解像度過高，即使嘗試調整後仍無法處理。");
                } else if (error.message.includes("Failed to fetch")) {
                    setUiError("無法連接 ClipDrop API，請檢查網絡或稍後再試。");
                }
                throw error;
            }
            const processedImageBlob = clipdropResponse.image;
            const processedImageDataUrl = await blobToDataUrl(processedImageBlob);
            setProgress(75);
            console.log("Background replaced.");

            setProgressText("最後一步，加個靚相框...🖼️");
            console.log("Framing image...");
            const framedDataUrl = await frameImage(processedImageDataUrl);
            setFinalFramedImage(framedDataUrl);
            setProgress(85);
            console.log("Image framed.");

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
                setUiError(`圖片已生成但上傳雲端失敗: ${uploadError.message}. 你仍然可以下載本地圖片。`);
                setProgress(95);
                setProgressText('魔法變身完成，但上傳失敗...😢');
                toast({ title: "變身完成但上傳失敗", description: `圖片已生成但上傳雲端失敗: ${uploadError.message}`, variant: "destructive" });
            } finally {
                setIsUploading(false);
            }

        } catch (error: any) {
            console.error("Error during generation process:", error);
            const displayError = uiError || `唔好意思, 出咗啲問題: ${error.message || 'An unknown error occurred.'}. 請一陣再試啦。`;
            if (!uiError) {
                setUiError(displayError);
            }
            setProgressText('魔法失敗咗...😢');
            toast({ title: "變身失敗", description: displayError, variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
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
        window.print();
        console.log("Print dialog should be open.");
    };

    // Handle multiple category selection
    const handleCategoryChange = (category: Category, checked: boolean | "indeterminate") => {
        setSelectedCategories(prevCats => {
            if (checked === true) {
                return [...prevCats, category];
            } else {
                return prevCats.filter(c => c !== category);
            }
        });
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


    // Derive current image source for preview
    const previewImageSrc = capturedImage || currentObjectUrl;
    const showWebcam = isWebcamOpen && !capturedImage;
    const canGenerate = !!(uploadedImage || capturedImage) && selectedCategories.length > 0 && selectedTags.length > 0 && !!apiKeys.clipdropKey && !!animalName;
    const qrCodeValue = finalGcsUrl || finalFramedImage;
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
                    onSave={handleSaveSettings}
                />
                <Button
                    variant="outline"
                    size="icon"
                    className="absolute top-4 right-4 z-20 non-printable"
                    onClick={() => setIsSettingsDialogOpen(true)}
                >
                    <Cog className="h-4 w-4" />
                    <span className="sr-only">設定</span>
                </Button>

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
                            setFinalFramedImage={setFinalFramedImage}
                            setFinalGcsUrl={setFinalGcsUrl}
                        />

                        {/* Hidden canvases */}
                        <canvas ref={finalCanvasRef} className="hidden"></canvas>
                        <canvas ref={captureCanvasRef} className="hidden"></canvas>

                    </CardContent>
                    <CardFooter className="text-center text-xs text-muted-foreground justify-center non-printable pt-6">
                        Powered by ClipDrop & Google AI. Inspired by Montara. ✨
                    </CardFooter>
                </Card>

                <PrintableArea finalFramedImage={finalFramedImage} animalName={animalName} />

            </div>
        </TooltipProvider>
    );
}
