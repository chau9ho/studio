import { useState, useEffect, useCallback } from 'react';
import type { ToastFunction } from '@/hooks/use-toast'; // Adjust if path differs

type ApiKeysState = {
  clipdropKey: string;
  removeBgKey: string; // Added remove.bg key
};

// Default API Keys
const DEFAULT_CLIPDROP_KEY = process.env.NEXT_PUBLIC_CLIPDROP_API_KEY || 'dbe3bc24b88a9804d1dee978f6cb30f168886d7ababf3e09c76b81d3767beac1b305f6997c1a7d163766ac2ef54981bc';
const DEFAULT_REMOVEBG_KEY = process.env.NEXT_PUBLIC_REMOVEBG_API_KEY || 'Yg2nvrfYnafGoNHCbcogsXbU'; // Added default remove.bg key

const SETTINGS_KEY = 'sakuraPetFramesSettings';

export function useApiKeys(toast?: ToastFunction) { // Make toast optional
    const [apiKeys, setApiKeys] = useState<ApiKeysState>({ clipdropKey: '', removeBgKey: '' });
    const [tempApiKeyInput, setTempApiKeyInput] = useState<string>('');
    const [tempRemoveBgApiKeyInput, setTempRemoveBgApiKeyInput] = useState<string>(''); // State for remove.bg temp input
    const [isLoading, setIsLoading] = useState<boolean>(true); // Loading state

    // Load keys on mount
    useEffect(() => {
        setIsLoading(true);
        try {
            const storedSettings = localStorage.getItem(SETTINGS_KEY);
            let loadedClipdropKey = DEFAULT_CLIPDROP_KEY;
            let loadedRemoveBgKey = DEFAULT_REMOVEBG_KEY;
            let savedClipdropInput = '';
            let savedRemoveBgInput = '';

            if (storedSettings) {
                const parsedSettings = JSON.parse(storedSettings);

                // Load ClipDrop key
                if (parsedSettings.clipdropKey && parsedSettings.clipdropKey.trim() !== '') {
                    loadedClipdropKey = parsedSettings.clipdropKey;
                    savedClipdropInput = parsedSettings.clipdropKey; // Store what was saved for input field
                    console.log("Loaded ClipDrop key from localStorage.");
                } else {
                    console.log("Using default ClipDrop key (saved key was empty or missing).");
                }

                // Load Remove.bg key
                if (parsedSettings.removeBgKey && parsedSettings.removeBgKey.trim() !== '') {
                    loadedRemoveBgKey = parsedSettings.removeBgKey;
                    savedRemoveBgInput = parsedSettings.removeBgKey; // Store what was saved
                    console.log("Loaded Remove.bg key from localStorage.");
                } else {
                    console.log("Using default Remove.bg key (saved key was empty or missing).");
                }
            } else {
                console.log("No settings found in localStorage, using default keys.");
            }

            setApiKeys({ clipdropKey: loadedClipdropKey, removeBgKey: loadedRemoveBgKey });
            setTempApiKeyInput(savedClipdropInput); // Set input based on saved value, not default
            setTempRemoveBgApiKeyInput(savedRemoveBgInput); // Set input based on saved value

        } catch (error) {
            console.error("Failed to parse stored settings:", error);
            localStorage.removeItem(SETTINGS_KEY); // Clear corrupted data
            // Load defaults if parsing fails
            setApiKeys({ clipdropKey: DEFAULT_CLIPDROP_KEY, removeBgKey: DEFAULT_REMOVEBG_KEY });
            setTempApiKeyInput('');
            setTempRemoveBgApiKeyInput('');
            toast?.({ title: "Error", description: "Could not load saved settings. Cleared potentially corrupted data.", variant: "destructive" });
        } finally {
             setIsLoading(false);
        }
    }, [toast]); // Dependency on toast

    // Save keys function
    const handleSaveSettings = useCallback(() => {
        try {
            // Determine the keys to actually use (saved input or default)
             const clipdropKeyToUse = tempApiKeyInput.trim() || DEFAULT_CLIPDROP_KEY;
             const removeBgKeyToUse = tempRemoveBgApiKeyInput.trim() || DEFAULT_REMOVEBG_KEY;

             // Prepare data for localStorage (store the user's input, even if empty)
            const dataToStore = {
                clipdropKey: tempApiKeyInput.trim(),
                removeBgKey: tempRemoveBgApiKeyInput.trim(),
                // Preserve other settings like animalName if they exist
                 ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')),
            };


            localStorage.setItem(SETTINGS_KEY, JSON.stringify(dataToStore));

            // Update the active API keys state
            setApiKeys({ clipdropKey: clipdropKeyToUse, removeBgKey: removeBgKeyToUse });

            toast?.({ title: "設定已儲存", description: "API Keys 已經儲存好。" });
            return true; // Indicate success

        } catch (error) {
            console.error("Failed to save settings:", error);
            toast?.({ title: "儲存失敗", description: "無法儲存設定。", variant: "destructive" });
            return false; // Indicate failure
        }
    }, [tempApiKeyInput, tempRemoveBgApiKeyInput, toast]);

    return {
        apiKeys,
        tempApiKeyInput,
        setTempApiKeyInput,
        tempRemoveBgApiKeyInput, // Expose remove.bg temp key state
        setTempRemoveBgApiKeyInput, // Expose setter
        handleSaveSettings,
        isLoading, // Expose loading state
    };
}
