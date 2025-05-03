
import { useState, useCallback, useRef, useEffect, RefObject, Dispatch, SetStateAction } from 'react'; // Added useRef import
import type { ToastFunction } from '@/hooks/use-toast'; // Adjust if path differs

// Define the setters that might need to be called
type Setters = {
    setCapturedImage: Dispatch<SetStateAction<string | null>>;
    setCurrentObjectUrl: Dispatch<SetStateAction<string | null>>;
    setUploadedImage: Dispatch<SetStateAction<File | null>>;
    setSelectedGcsImage: Dispatch<SetStateAction<string | null>>;
};

export function useWebcam(
    videoRef: RefObject<HTMLVideoElement>,
    setCapturedImage: Dispatch<SetStateAction<string | null>>,
    setCurrentObjectUrl: Dispatch<SetStateAction<string | null>>, // Need this setter
    setUploadedImage: Dispatch<SetStateAction<File | null>>, // Need this setter
    setSelectedGcsImage: Dispatch<SetStateAction<string | null>>, // Need this setter
    toast: ToastFunction
) {
    const [isWebcamOpen, setIsWebcamOpen] = useState<boolean>(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const captureCanvasRef = useRef<HTMLCanvasElement | null>(null); // Internal canvas for capture

    // Create canvas element if it doesn't exist (client-side only)
    useEffect(() => {
        if (typeof window !== 'undefined' && !captureCanvasRef.current) {
            captureCanvasRef.current = document.createElement('canvas');
            console.log("Webcam capture canvas created.");
        }
    }, []);


    const stopWebcam = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
            setIsWebcamOpen(false);
            console.log("Webcam stopped.");
        }
    }, [stream, videoRef]);

    const startWebcam = useCallback(async () => {
        setHasCameraPermission(null); // Reset permission status
        setIsWebcamOpen(false); // Ensure webcam is marked closed initially
        console.log("Attempting to start webcam...");

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            toast({ title: "瀏覽器唔支援", description: "你嘅瀏覽器唔支援攝錄鏡頭功能。", variant: "destructive" });
            setHasCameraPermission(false);
            return;
        }

        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 } }, // Request preferred resolution
                audio: false
            });
            setStream(mediaStream);
            setHasCameraPermission(true);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                videoRef.current.play().catch(e => console.error("Video play failed:", e)); // Ensure video plays
                setIsWebcamOpen(true); // Mark webcam as open *after* setting srcObject
                console.log("Webcam started successfully.");
            } else {
                 console.warn("Video ref not available when stream was ready.");
                 // Stop the stream if the ref isn't ready
                 mediaStream.getTracks().forEach(track => track.stop());
                 setHasCameraPermission(false); // Can't proceed without video element
                 toast({ title: "元件錯誤", description: "無法顯示鏡頭畫面。", variant: "destructive" });
            }
        } catch (err: any) {
            console.error("Error accessing webcam:", err);
            let description = "無法開啟鏡頭，請檢查權限或裝置。";
            if (err.name === 'NotAllowedError') {
                description = "你已拒絕鏡頭權限，請喺瀏覽器設定允許。";
            } else if (err.name === 'NotFoundError') {
                 description = "搵唔到鏡頭裝置。";
            } else if (err.name === 'NotReadableError') {
                description = "無法讀取鏡頭影像，可能已被其他程式佔用。";
            }
            setHasCameraPermission(false);
            toast({ title: "鏡頭錯誤", description, variant: "destructive" });
            setIsWebcamOpen(false);
        }
    }, [videoRef, toast]);


    const captureImage = useCallback(() => {
        if (videoRef.current && captureCanvasRef.current && isWebcamOpen) {
            const canvas = captureCanvasRef.current;
            const video = videoRef.current;

            // Set canvas dimensions to match video stream dimensions
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');

            if (context) {
                // Clear previous image sources before setting new one
                setUploadedImage(null);
                setSelectedGcsImage(null);
                setCurrentObjectUrl(prev => {
                    if (prev) URL.revokeObjectURL(prev);
                    return null;
                });

                // Draw current video frame onto canvas
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/png'); // Capture as PNG

                setCapturedImage(dataUrl); // Set the captured image state
                console.log("Image captured from webcam.");
                stopWebcam(); // Close webcam after capture
            } else {
                console.error("Failed to get canvas context for capture");
                toast({ title: "拍攝失敗", description: "無法從鏡頭拍攝圖片。", variant: "destructive" });
            }
        } else {
             console.warn("Capture attempt failed: Video ref, canvas ref, or webcam not ready.", { videoReady: !!videoRef.current, canvasReady: !!captureCanvasRef.current, webcamOpen: isWebcamOpen });
             toast({ title: "拍攝失敗", description: "鏡頭或元件未準備好拍攝。", variant: "destructive" });
        }
    }, [videoRef, isWebcamOpen, setCapturedImage, stopWebcam, toast, setUploadedImage, setSelectedGcsImage, setCurrentObjectUrl]);

    // Cleanup webcam stream on unmount
    useEffect(() => {
        return () => {
            stopWebcam();
        };
    }, [stopWebcam]);


    return {
        startWebcam,
        stopWebcam,
        captureImage,
        isWebcamOpen,
        hasCameraPermission,
        videoRef, // Return ref for component use
    };
}

// Dummy useRef for captureCanvasRef initialization outside hook if needed elsewhere
// This ensures the ref object exists even if the hook isn't used immediately.
const dummyCaptureCanvasRef = { current: typeof window !== 'undefined' ? document.createElement('canvas') : null };

