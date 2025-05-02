'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WandSparkles, Sparkles } from 'lucide-react';

interface GenerationControlSectionProps {
    onGenerate: () => void;
    disabled: boolean;
    uiError: string | null;
    isGenerating: boolean;
    isUploading: boolean;
}

const GenerationControlSection: React.FC<GenerationControlSectionProps> = ({
    onGenerate,
    disabled,
    uiError,
    isGenerating,
    isUploading,
}) => {
    const canGenerate = !disabled && !isGenerating && !isUploading; // Simplified condition

    return (
        <Card className="non-printable">
            <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2"><Sparkles size={24} className="text-yellow-500" /> 2. 施展魔法 ✨</CardTitle>
                <CardDescription>撳個掣，魔法就會開始！</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
                <Button
                    onClick={onGenerate}
                    disabled={disabled} // Use the passed disabled prop directly
                    className={`w-full text-xl py-6 font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-teal-500 hover:from-pink-600 hover:via-purple-600 hover:to-teal-600 text-white shadow-lg rounded-full transition duration-300 ease-in-out transform hover:scale-105 active:scale-95 disabled:from-gray-400 disabled:via-gray-500 disabled:to-gray-600 disabled:scale-100 disabled:cursor-not-allowed ${canGenerate ? 'animate-subtle-pulse' : ''}`}
                >
                    <WandSparkles className="mr-3 h-7 w-7" />
                    開始變身！ (Make Magic!)
                </Button>
                {uiError && !isGenerating && !isUploading && ( // Only show error when not busy
                    <Alert variant="destructive" className="w-full">
                        <AlertTitle>哎呀！魔法失敗咗！</AlertTitle>
                        <AlertDescription>{uiError}</AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
};

export default GenerationControlSection;
