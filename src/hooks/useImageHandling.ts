import { useState, useEffect, useCallback } from 'react';
import type { ToastFunction } from '@/hooks/use-toast'; // Adjust import path if needed
import { blobToDataUrl } from '@/lib/imageUtils';

export function useImageHandling(toast: ToastFunction) {
    const [uploadedImage, setUploadedImage] = useState<File | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null); // Data URL from webcam or GCS fetch
    const [currentObjectUrl, setCurrentObjectUrl] = useState<string | null>(null); // Blob URL for uploaded file

    // Cleanup Object URL
    useEffect(() => {
        return () => {
            if (currentObjectUrl) {
                URL.revokeObjectURL(currentObjectUrl);
                console.log("Revoked Object URL:", currentObjectUrl);
            }
        };
    }, [currentObjectUrl]);

    const clearImageSources = useCallback(() => {
        setUploadedImage(null);
        setCapturedImage(null);
        if (currentObjectUrl) {
            URL.revokeObjectURL(currentObjectUrl);
            setCurrentObjectUrl(null);
        }
        console.log("Cleared all active image sources (upload, capture, object URL).");
    }, [currentObjectUrl]);

    const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        clearImageSources(); // Clear previous sources before handling new upload

        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];

            if (!file.type.startsWith('image/')) {
                toast({ title: "檔案類型錯誤", description: "請上載有效嘅圖片檔案。", variant: "destructive" });
                event.target.value = ''; // Reset file input
                return;
            }

            setUploadedImage(file);
            const objectUrl = URL.createObjectURL(file);
            setCurrentObjectUrl(objectUrl);
            console.log("Image uploaded and Object URL created:", objectUrl);
        }
         // Reset file input value to allow re-uploading the same file
         // Do this regardless of success/failure to ensure onChange triggers next time
         if (event.target) {
            event.target.value = '';
         }
    }, [clearImageSources, toast]);

    const getCurrentImageDataUrl = useCallback((): Promise<string | null> => {
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
                    reject(new Error("Could not read uploaded image file."));
                }
            } else {
                resolve(null); // No image source available
            }
        });
    }, [capturedImage, uploadedImage, toast]);

    // Derive current image source for preview
    const previewImageSrc = capturedImage || currentObjectUrl;

    return {
        uploadedImage,
        setUploadedImage,
        capturedImage,
        setCapturedImage,
        currentObjectUrl,
        setCurrentObjectUrl,
        handleImageUpload,
        getCurrentImageDataUrl,
        clearImageSources,
        previewImageSrc,
    };
}
