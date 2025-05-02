'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, Printer, QrCode, RotateCcw, PartyPopper } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

interface ResultsSectionProps {
    finalFramedImage: string | null;
    finalGcsUrl: string | null;
    generatedStory: string;
    animalName: string;
    qrCodeValue: string | null; // Can be Data URL or GCS URL
    onDownload: () => void;
    onPrint: () => void;
    onReset: () => void;
    isGenerating: boolean;
    isUploading: boolean;
    toast: (options: any) => void; // Simplified toast type
    setUiError: (error: string | null) => void;
    // Add setters to clear results on image loading error
    setFinalFramedImage: (image: string | null) => void;
    setFinalGcsUrl: (url: string | null) => void;
}

const ResultsSection: React.FC<ResultsSectionProps> = ({
    finalFramedImage,
    finalGcsUrl,
    generatedStory,
    animalName,
    qrCodeValue,
    onDownload,
    onPrint,
    onReset,
    isGenerating,
    isUploading,
    toast,
    setUiError,
    setFinalFramedImage,
    setFinalGcsUrl
}) => {
    if ((!finalFramedImage && !generatedStory) || isGenerating || isUploading) {
        return null; // Don't render if no results or still processing
    }

    return (
        <Card className="non-printable">
            <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2"><PartyPopper size={24} className="text-green-500" /> 3. 噹噹噹噹！睇下成果 🎉</CardTitle>
                <CardDescription>你嘅專屬魔法相框同故仔整好啦！</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-6">
                {finalFramedImage && (
                    <div className="w-full max-w-[400px] md:max-w-[500px] mx-auto">
                        <Label className="text-lg font-semibold text-center block mb-2 text-pink-700">🖼️ 魔法相框:</Label>
                        <img
                            src={finalFramedImage}
                            alt={`Framed photo of ${animalName}`}
                            width={1410} // Set intrinsic size for print layout
                            height={2250}
                            className="rounded-lg border-4 border-pink-200 shadow-xl object-contain bg-muted w-full h-auto"
                            onError={(e) => {
                                console.error("Error loading final framed image:", e);
                                toast({ title: "圖片載入錯誤", description: "無法顯示最終圖片。", variant: "destructive" });
                                setUiError("無法顯示最終圖片。");
                                setFinalFramedImage(null); // Clear local image state
                                setFinalGcsUrl(null); // Clear GCS URL state
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
                {finalFramedImage && (
                    <Button onClick={onDownload} variant="secondary">
                        <Download className="mr-2 h-4 w-4" /> 下載靚相
                    </Button>
                )}
                {finalGcsUrl && ( // Only show print/QR if GCS upload was successful and image exists
                    <>
                        <Button onClick={onPrint} variant="secondary">
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
                                {qrCodeValue ? ( // Use the specific qrCodeValue which comes from finalGcsUrl
                                    <div className="flex justify-center py-4 bg-white p-2 rounded-md">
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
                 <Button onClick={onReset} variant="outline" className="text-red-600 border-red-300 hover:bg-red-50">
                    <RotateCcw className="mr-2 h-4 w-4" /> 清空再玩
                </Button>
            </CardFooter>
        </Card>
    );
};

export default ResultsSection;
