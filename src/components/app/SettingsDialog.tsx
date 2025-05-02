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
    onSave: () => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({
    isOpen,
    setIsOpen,
    tempApiKeyInput,
    setTempApiKeyInput,
    onSave,
}) => {
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            {/* Trigger is handled outside */}
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>設定</DialogTitle>
                    <DialogDescription>
                        輸入你嘅 ClipDrop API Key。如果留空，會使用預設 Key。
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="clipdrop-key-input" className="text-right">
                            API Key
                        </Label>
                        <Input
                            id="clipdrop-key-input"
                            value={tempApiKeyInput}
                            onChange={(e) => setTempApiKeyInput(e.target.value)}
                            placeholder="貼上你嘅 ClipDrop Key"
                            className="col-span-3"
                            type="password"
                        />
                    </div>
                    <Alert variant="default" className="mt-2">
                        <AlertDescription>
                            冇 Key? <a href="https://clipdrop.co/apis" target="_blank" rel="noopener noreferrer" className="underline">去 ClipDrop 免費申請</a>.
                            <br />
                            留空會用預設 Key (可能有使用限制)。
                        </AlertDescription>
                    </Alert>
                </div>
                <DialogFooter>
                    <Button type="button" onClick={onSave}>儲存設定</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SettingsDialog;
