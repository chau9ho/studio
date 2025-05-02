'use client';

import React from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import type { Category } from './SakuraPetFramesApp'; // Import Category type

interface StyleSelectionSectionProps {
    animalName: string;
    setAnimalName: (name: string) => void;
    selectedCategories: Category[];
    selectedTags: string[];
    handleCategoryChange: (category: Category, checked: boolean | "indeterminate") => void;
    handleTagChange: (tag: string, checked: boolean | "indeterminate") => void;
    categories: Record<Category, string[]>; // Receive categories map
}

const StyleSelectionSection: React.FC<StyleSelectionSectionProps> = ({
    animalName,
    setAnimalName,
    selectedCategories,
    selectedTags,
    handleCategoryChange,
    handleTagChange,
    categories,
}) => {
    return (
        <div className="space-y-4">
            <div>
                <Label htmlFor="animalName" className="font-semibold text-lg text-purple-600">B. 寵物嘅大名</Label>
                <Input
                    id="animalName"
                    type="text"
                    placeholder="例如: 毛毛, 旺財"
                    value={animalName}
                    onChange={(e) => setAnimalName(e.target.value)}
                    className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">提示：寵物名會用嚟生成 QR Code 同喺雲端搵相。</p>
            </div>
            <div>
                <Label className="font-semibold text-lg text-purple-600">C. 背景主題 (可選多個)</Label>
                <ScrollArea className="h-24 w-full rounded-md border p-2 mt-1 bg-background/50">
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                        {Object.keys(categories).map((cat) => (
                            <div key={cat} className="flex items-center space-x-2 hover:bg-pink-100 p-1 rounded transition-colors duration-150">
                                <Checkbox
                                    id={`cat-${cat}`}
                                    checked={selectedCategories.includes(cat as Category)}
                                    onCheckedChange={(checked) => handleCategoryChange(cat as Category, checked)}
                                    className="border-pink-300 data-[state=checked]:bg-pink-500 data-[state=checked]:text-white"
                                />
                                <Label htmlFor={`cat-${cat}`} className="text-sm font-normal cursor-pointer select-none">
                                    {cat}
                                </Label>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>
            <div className="space-y-2">
                <Label className="font-semibold text-lg text-purple-600">D. 背景風格 (從所選主題中選擇)</Label>
                <ScrollArea className="h-48 w-full rounded-md border p-4 mt-1 bg-background/50">
                    {selectedCategories.length === 0 ? (
                        <p className="text-sm text-muted-foreground">請先在 C. 選擇至少一個背景主題</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {selectedCategories.map(cat => (
                                <div key={cat} className="mb-4">
                                    <p className="font-semibold text-sm text-gray-700 mb-1">{cat}</p>
                                    {categories[cat].map((tag) => (
                                        <div key={tag} className="flex items-center space-x-2 hover:bg-pink-100 p-1 rounded transition-colors duration-150">
                                            <Checkbox
                                                id={`tag-${tag}`}
                                                checked={selectedTags.includes(tag)}
                                                onCheckedChange={(checked) => handleTagChange(tag, checked)}
                                                className="border-pink-300 data-[state=checked]:bg-pink-500 data-[state=checked]:text-white"
                                            />
                                            <Label htmlFor={`tag-${tag}`} className="text-sm font-normal cursor-pointer select-none">
                                                {tag}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </div>
        </div>
    );
};

export default StyleSelectionSection;
