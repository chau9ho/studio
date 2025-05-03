import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';
import { listPetImages, fetchGcsImageAsDataUrl } from '@/actions/gcsActions';
import type { ToastFunction } from '@/hooks/use-toast'; // Adjust path if needed

export function useGCS(
    animalName: string,
    toast: ToastFunction,
    // Setters from other hooks to clear state when GCS image is selected
    setCapturedImage: Dispatch<SetStateAction<string | null>>,
    setCurrentObjectUrl: Dispatch<SetStateAction<string | null>>,
    setUploadedImage: Dispatch<SetStateAction<File | null>>
) {
    const [fetchedGcsImages, setFetchedGcsImages] = useState<string[]>([]);
    const [selectedGcsImage, setSelectedGcsImage] = useState<string | null>(null);
    const [isFetchingGcsImages, setIsFetchingGcsImages] = useState<boolean>(false);
    const [gcsFetchError, setGcsFetchError] = useState<string | null>(null);

    const fetchImagesFromGCS = useCallback(async (showToast = true) => {
        if (!animalName) {
            setFetchedGcsImages([]);
            setGcsFetchError(null);
            setSelectedGcsImage(null); // Clear selection if name clears
            return;
        }
        setIsFetchingGcsImages(true);
        setGcsFetchError(null);
         // Don't clear selection on manual refresh, only on name change or error
         // setSelectedGcsImage(null);

        try {
            console.log(`Fetching images for animal: ${animalName}`);
            const urls = await listPetImages(animalName);
            setFetchedGcsImages(urls); // Update the list

             // Check if the currently selected image is still in the fetched list
             if (selectedGcsImage && !urls.includes(selectedGcsImage)) {
                 console.log("Previously selected GCS image is no longer present. Clearing selection.");
                 setSelectedGcsImage(null); // Clear selection if it disappeared
                 setCapturedImage(null); // Also clear the associated captured data
             }

            if (showToast) {
                if (urls.length === 0) {
                    toast({ title: "搵唔到相", description: `喺雲端搵唔到 ${animalName} 嘅相。` });
                } else {
                     // Only show success toast on manual refresh, not on initial load/name change
                     // toast({ title: "搵到相喇！", description: `搵到 ${urls.length} 張 ${animalName} 嘅相。` });
                }
            }
            console.log("Fetched image URLs:", urls);
        } catch (error: any) {
            console.error("Error fetching images from GCS:", error);
            const errorMsg = `無法由雲端載入圖片: ${error.message}`;
            setGcsFetchError(errorMsg);
             setSelectedGcsImage(null); // Clear selection on fetch error
             setCapturedImage(null); // Also clear the associated captured data
             if (showToast) {
                toast({ title: "載入失敗", description: errorMsg, variant: "destructive" });
             }
        } finally {
            setIsFetchingGcsImages(false);
        }
    }, [animalName, toast, selectedGcsImage, setCapturedImage]); // Add selectedGcsImage and setCapturedImage dependency

    // Trigger GCS fetch on animal name change (debounced)
    useEffect(() => {
        const handler = setTimeout(() => {
            // Fetch without toast on automatic name change
            fetchImagesFromGCS(false);
        }, 500); // Debounce time

        return () => {
            clearTimeout(handler);
        };
    }, [animalName, fetchImagesFromGCS]);


    // Handle selecting a GCS image
     const handleSelectGcsImage = useCallback(async (imageUrl: string) => {
         setSelectedGcsImage(imageUrl); // Mark as selected visually first
         setGcsFetchError(null); // Clear previous fetch errors

         // Clear other image sources
         setUploadedImage(null);
         setCapturedImage(null); // Clear direct capture/previous GCS fetch
         setCurrentObjectUrl(prev => {
             if (prev) URL.revokeObjectURL(prev);
             return null;
         });

         // Show loading state (maybe use generation progress?)
         // setProgressText("由雲端載入緊圖片...");
         // setProgress(5);
         console.log(`Attempting to load selected GCS image: ${imageUrl}`);

         try {
             const dataUrl = await fetchGcsImageAsDataUrl(imageUrl);
             if (!dataUrl) {
                 throw new Error("Server action returned empty data URL.");
             }
             setCapturedImage(dataUrl); // Set capturedImage with the data URL from GCS
             console.log("Selected GCS image loaded as Data URL via server action.");
             toast({ title: "圖片已選取", description: "已選取並載入雲端圖片。" });
             // Clear progress state if used
             // setProgress(0);
             // setProgressText('');
         } catch (error: any) {
             console.error("Error loading selected GCS image via server action:", error);
             const errorMsg = `無法載入選定嘅圖片: ${error.message}`;
             toast({ title: "載入失敗", description: errorMsg, variant: "destructive" });
             // Clear selection and captured data on error
             setSelectedGcsImage(null);
             setCapturedImage(null);
             // Clear progress state if used
             // setProgress(0);
             // setProgressText('');
         }
     }, [setUploadedImage, setCapturedImage, setCurrentObjectUrl, toast]); // Dependencies


    return {
        fetchedGcsImages,
        // setFetchedGcsImages, // No longer needed externally?
        selectedGcsImage,
        setSelectedGcsImage, // Expose setter
        isFetchingGcsImages,
        gcsFetchError,
        fetchImagesFromGCS,
        handleSelectGcsImage,
    };
}
