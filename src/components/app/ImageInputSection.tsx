'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { Upload, Camera, QrCode, RefreshCw, Loader2, X, CheckCircle2, Wand2 } from 'lucide-react'; // Added Wand2
import { QRCodeCanvas } from 'qrcode.react';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip

interface ImageInputSectionProps {
    animalName: string;
    previewImageSrc: string | null;
    showWebcam: boolean;
    isWebcamOpen: boolean;
    hasCameraPermission: boolean | null;
    videoRef: React.RefObject<HTMLVideoElement>;
    handleImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    startWebcam: () => void;
    captureImage: () => void;
    stopWebcam: () => void;
    qrUploadUrl: string;
    fetchedGcsImages: string[];
    selectedGcsImage: string | null;
    handleSelectGcsImage: (url: string) => void;
    isFetchingGcsImages: boolean;
    gcsFetchError: string | null;
    fetchImagesFromGCS: () => void;
    toast: (options: any) => void;
    setUiError: (error: string | null) => void;
    setCapturedImage: (image: string | null) => void;
    setUploadedImage: (file: File | null) => void;
    setCurrentObjectUrl: (url: string | null) => void;
    removeImageBackground: boolean; // State for remove.bg option
    setRemoveImageBackground: (value: boolean) => void; // Setter for remove.bg option
}

const ImageInputSection: React.FC<ImageInputSectionProps> = ({
    animalName,
    previewImageSrc,
    showWebcam,
    isWebcamOpen,
    hasCameraPermission,
    videoRef,
    handleImageUpload,
    startWebcam,
    captureImage,
    stopWebcam,
    qrUploadUrl,
    fetchedGcsImages,
    selectedGcsImage,
    handleSelectGcsImage,
    isFetchingGcsImages,
    gcsFetchError,
    fetchImagesFromGCS,
    toast,
    setUiError,
    setCapturedImage,
    setUploadedImage,
    setCurrentObjectUrl,
    removeImageBackground, // Receive state
    setRemoveImageBackground, // Receive setter
}) => {
    return (
        <div className="space-y-4">
            <Label className="font-semibold text-lg text-purple-600">A. 你嘅得意寵物相</Label>
            <Tabs defaultValue="upload">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="upload"><Upload className="mr-2 h-4 w-4 inline" />上載</TabsTrigger>
                    <TabsTrigger value="webcam"><Camera className="mr-2 h-4 w-4 inline" />拍攝</TabsTrigger>
                    <TabsTrigger value="qrcode"><QrCode className="mr-2 h-4 w-4 inline" />雲端</TabsTrigger>
                </TabsList>

                {/* Upload Tab */}
                <TabsContent value="upload">
                    <div className="space-y-2 pt-2">
                        <Label htmlFor="picture" className="text-sm text-muted-foreground">揀張相 (JPG, PNG, etc.)</Label>
                        <Input id="picture" type="file" accept="image/*" onChange={handleImageUpload} />
                    </div>
                </TabsContent>

                {/* Webcam Tab */}
                <TabsContent value="webcam">
                    <div className="space-y-2 pt-2">
                        {!isWebcamOpen && (
                            <Button onClick={startWebcam} variant="outline" disabled={hasCameraPermission === false}>
                                <Camera className="mr-2 h-4 w-4" /> 開鏡頭
                            </Button>
                        )}
                        <div className={`relative aspect-video bg-muted rounded-md overflow-hidden ${!showWebcam ? 'hidden' : ''}`}>
                             {/* Always render video tag to avoid ref issues */}
                            <video ref={videoRef} playsInline muted className={`w-full h-full object-cover ${!showWebcam ? 'hidden' : ''}`}></video>
                            {isWebcamOpen && (
                                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-2">
                                    <Button onClick={captureImage} size="icon" variant="destructive" title="影相">
                                        <Camera />
                                    </Button>
                                    <Button onClick={stopWebcam} size="icon" variant="secondary" title="關閉鏡頭">
                                        <X />
                                    </Button>
                                </div>
                            )}
                        </div>
                        {hasCameraPermission === false && ( // Simplified condition
                            <Alert variant="destructive">
                                <AlertTitle>鏡頭權限被拒</AlertTitle>
                                <AlertDescription>
                                    請喺瀏覽器設定允許使用鏡頭，然後重新整理頁面。
                                </AlertDescription>
                            </Alert>
                        )}
                         {hasCameraPermission === null && isWebcamOpen && ( // Show when requesting permission
                             <p className="text-sm text-muted-foreground">要求鏡頭權限中...</p>
                         )}
                    </div>
                </TabsContent>

                {/* Cloud/QR Code Tab */}
                <TabsContent value="qrcode">
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
                                <Button onClick={() => fetchImagesFromGCS(true)} variant="ghost" size="sm" disabled={isFetchingGcsImages || !animalName} title="重新整理雲端圖片">
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
                                                    loading="lazy"
                                                    onError={(e) => { e.currentTarget.style.display = 'none'; /* Hide broken images */ }}
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

            {/* Image Preview and Options */}
            {previewImageSrc && (
                 <div className="mt-4 space-y-3">
                     <div>
                         <Label>預覽:</Label>
                         <img
                             src={previewImageSrc}
                             alt="已上載、拍攝或由雲端選取嘅寵物相"
                             width={300}
                             height={225}
                             className="rounded-md border mt-1 object-contain bg-muted shadow-md max-w-full h-auto" // Use object-contain
                             data-ai-hint="pet animal"
                             onError={(e) => {
                                 console.error("Error loading preview image:", e, previewImageSrc);
                                 toast({ title: "圖片載入錯誤", description: "無法顯示預覽圖片。", variant: "destructive" });
                                 setUiError("無法顯示預覽圖片。");
                                 // Clear the problematic source
                                 if (previewImageSrc.startsWith('blob:')) {
                                     setUploadedImage(null);
                                     setCurrentObjectUrl(null);
                                     URL.revokeObjectURL(previewImageSrc);
                                 } else if (previewImageSrc.startsWith('data:')) {
                                     setCapturedImage(null); // Clear data URL state (webcam or fetched GCS)
                                 }
                             }}
                         />
                     </div>

                     {/* Background Removal Checkbox */}
                     <div className="flex items-center space-x-2 pt-2">
                         <Checkbox
                             id="remove-background"
                             checked={removeImageBackground}
                             onCheckedChange={(checked) => setRemoveImageBackground(Boolean(checked))} // Ensure boolean value
                             className="border-teal-300 data-[state=checked]:bg-teal-500 data-[state=checked]:text-white"
                         />
                          <Label htmlFor="remove-background" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1">
                             <Wand2 size={16} className="text-teal-600" />
                             <Tooltip>
                                 <TooltipTrigger asChild>
                                     <span className="cursor-help underline decoration-dashed decoration-teal-400">
                                         移除背景?
                                     </span>
                                 </TooltipTrigger>
                                 <TooltipContent className="max-w-xs text-xs">
                                     <p>勾選此項會使用 Remove.bg API 嘗試移除圖片背景，令寵物更突出。需要喺「設定」輸入 Remove.bg API Key。</p>
                                 </TooltipContent>
                             </Tooltip>
                         </Label>
                     </div>
                 </div>
            )}
        </div>
    );
};

export default ImageInputSection;
