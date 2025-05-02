'use client';

import React from 'react';
import { Loader2, CloudUpload } from 'lucide-react';
import { Progress } from "@/components/ui/progress"; // Import Progress component

interface GenerationOverlayProps {
    isGenerating: boolean;
    isUploading: boolean;
    progressText: string;
    progress: number;
    finalGcsUrl: string | null; // Used to determine final message
}

const GenerationOverlay: React.FC<GenerationOverlayProps> = ({
    isGenerating,
    isUploading,
    progressText,
    progress,
    finalGcsUrl,
}) => {
    if (!isGenerating && !isUploading) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm"
            style={{ backgroundImage: "url('/background1.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
            <div className="text-center p-8 rounded-lg bg-card/80 backdrop-blur-sm shadow-2xl max-w-md mx-auto">
                {isUploading ? (
                    <CloudUpload className="h-16 w-16 animate-pulse text-teal-500 mx-auto mb-6" />
                ) : (
                    <Loader2 className="h-16 w-16 animate-spin text-pink-500 mx-auto mb-6" />
                )}
                <p className="text-2xl font-bold text-pink-600 mb-2 animate-pulse">{progressText || (isUploading ? '上傳緊...' : '魔法變身中...')}</p>
                <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700 overflow-hidden shadow-inner relative border border-pink-200">
                    {/* Sparkle effect */}
                    <div className="absolute top-0 left-0 h-full w-full overflow-hidden rounded-full">
                        {Array.from({ length: 15 }).map((_, i) => (
                            <div
                                key={i}
                                className="absolute h-1.5 w-1.5 bg-white rounded-full opacity-70"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    top: `${Math.random() * 100}%`,
                                    animation: `sparkle ${1 + Math.random() * 1}s infinite alternate ease-in-out`,
                                    animationDelay: `${Math.random() * 1}s`,
                                }}
                            />
                        ))}
                    </div>
                    <Progress
                        value={progress}
                        className="h-4 w-full border border-pink-200 bg-gray-200 dark:bg-gray-700 shadow-inner"
                        indicatorClassName="bg-gradient-to-r from-pink-400 via-purple-500 to-teal-400 transition-all duration-500 ease-out"
                        aria-label="Generation Progress"
                    />
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                    {progress < 100 ? '請稍等片刻...' : (finalGcsUrl ? '變身完成！相已上傳！' : (isUploading ? '上傳緊...' : '變身完成！'))}
                </p>
            </div>
            {/* Ensure sparkle animation is defined, could be in global CSS or here */}
            <style jsx>{`
                @keyframes sparkle {
                  0% { transform: scale(0.5); opacity: 0.5; }
                  100% { transform: scale(1); opacity: 1; }
                }
              `}</style>
        </div>
    );
};

export default GenerationOverlay;
