'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SettingsDialogProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    tempApiKeyInput: string;
    setTempApiKeyInput: (key: string) => void;
    tempRemoveBgApiKeyInput: string; // Added remove.bg key prop
    setTempRemoveBgApiKeyInput: (key: string) => void; // Added setter prop
    onSave: () => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({
    isOpen,
    setIsOpen,
    tempApiKeyInput,
    setTempApiKeyInput,
    tempRemoveBgApiKeyInput, // Destructure new prop
    setTempRemoveBgApiKeyInput, // Destructure new setter
    onSave,
}) => {

     const handleSaveAndClose = () => {
         const success = onSave(); // Call the save function provided by the hook
         if (success) {
             setIsOpen(false); // Close dialog only if save was successful
         }
     };


    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            {/* Trigger is handled outside */}
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>設定</DialogTitle>
                    <DialogDescription>
                        管理 API Keys。如果留空，會使用預設 Key (可能有使用限制)。
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* ClipDrop API Key Input */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="clipdrop-key-input" className="text-right text-sm">
                            ClipDrop Key
                        </Label>
                        <Input
                            id="clipdrop-key-input"
                            value={tempApiKeyInput}
                            onChange={(e) => setTempApiKeyInput(e.target.value)}
                            placeholder="貼上 ClipDrop Key"
                            className="col-span-3"
                            type="password"
                        />
                    </div>
                     <Alert variant="default" className="col-span-4 text-xs p-2">
                        <AlertDescription>
                             冇 Key? <a href="https://clipdrop.co/apis" target="_blank" rel="noopener noreferrer" className="underline">去 ClipDrop 免費申請</a>.
                        </AlertDescription>
                    </Alert>

                     {/* Remove.bg API Key Input */}
                     <div className="grid grid-cols-4 items-center gap-4 mt-4">
                         <Label htmlFor="removebg-key-input" className="text-right text-sm">
                             Remove.bg Key
                         </Label>
                         <Input
                             id="removebg-key-input"
                             value={tempRemoveBgApiKeyInput}
                             onChange={(e) => setTempRemoveBgApiKeyInput(e.target.value)}
                             placeholder="貼上 Remove.bg Key"
                             className="col-span-3"
                             type="password"
                         />
                     </div>
                    <Alert variant="default" className="col-span-4 text-xs p-2">
                         <AlertDescription>
                             用作移除圖片背景。冇 Key? <a href="https://www.remove.bg/api" target="_blank" rel="noopener noreferrer" className="underline">去 Remove.bg 申請</a>.
                         </AlertDescription>
                     </Alert>


                </div>
                <DialogFooter>
                    <Button type="button" onClick={handleSaveAndClose}>儲存並關閉</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SettingsDialog;
