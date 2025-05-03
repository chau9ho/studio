/**
 * @fileOverview Utility functions for handling image data conversions (Blob, Data URL, etc.).
 */

/**
 * Converts a data URL string (e.g., 'data:image/png;base64,...') to a Blob.
 *
 * @param dataUrl The data URL string.
 * @returns A promise that resolves to the Blob.
 * @throws {Error} If the data URL is invalid or fetch fails.
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
    if (!dataUrl || !dataUrl.startsWith('data:')) {
        throw new Error("Invalid data URL provided to dataUrlToBlob.");
    }
    try {
        // Use fetch API for robust conversion, handles various image types
        const response = await fetch(dataUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch data URL: ${response.statusText} (${response.status})`);
        }
        const blob = await response.blob();
        if (!blob || blob.size === 0) {
             throw new Error("Fetched Blob is empty or invalid.");
        }
        console.log(`Converted Data URL to Blob. Type: ${blob.type}, Size: ${blob.size} bytes.`);
        return blob;
    } catch (error: any) {
         console.error("Error converting data URL to Blob:", error);
         throw new Error(`Could not convert data URL to Blob: ${error.message || error}`);
    }
}

/**
* Converts a Blob to a Base64 encoded Data URL string.
*
* @param blob The Blob to convert.
* @returns A promise that resolves to the Data URL string.
* @throws {Error} If the Blob is invalid or FileReader fails.
*/
export function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!(blob instanceof Blob)) {
            return reject(new Error("Invalid Blob provided to blobToDataUrl."));
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                console.log(`Converted Blob (Type: ${blob.type}, Size: ${blob.size}) to Data URL.`);
                resolve(reader.result);
            } else {
                reject(new Error("FileReader did not return a string result."));
            }
        };
        reader.onerror = (error) => {
             console.error("FileReader error in blobToDataUrl:", error);
            reject(new Error(`FileReader failed: ${reader.error?.message || 'Unknown error'}`));
        };
        reader.readAsDataURL(blob);
    });
}

/**
 * Resizes an image represented by a Data URL while maintaining aspect ratio.
 *
 * @param imageDataUrl The Data URL of the image to resize.
 * @param maxDimension The maximum allowed width or height.
 * @returns A promise that resolves to an object containing the resized Data URL and Blob.
 * @throws {Error} If resizing fails or the canvas element is unavailable.
 */
 export const resizeImageIfNeeded = (
    imageDataUrl: string,
    maxDimension: number
): Promise<{ resizedDataUrl: string; resizedBlob: Blob }> => {
    return new Promise((resolve, reject) => {
        const resizeCanvas = document.createElement('canvas'); // Create canvas dynamically
        const ctx = resizeCanvas.getContext('2d');
        if (!ctx) {
            return reject(new Error("Could not get resize canvas context."));
        }

        const img = new window.Image();
        img.onload = async () => {
            const { naturalWidth: width, naturalHeight: height } = img;
            console.log(`Original image dimensions: ${width}x${height}`);

            if (width <= maxDimension && height <= maxDimension) {
                console.log("Image is within size limits, no resize needed.");
                try {
                    const blob = await dataUrlToBlob(imageDataUrl);
                    resolve({ resizedDataUrl: imageDataUrl, resizedBlob: blob });
                } catch (error) {
                    reject(new Error("Failed to convert original Data URL to Blob."));
                }
                return;
            }

            console.log(`Image exceeds ${maxDimension}px limit, resizing...`);

            let newWidth = width;
            let newHeight = height;
            const ratio = width / height;

            if (width > maxDimension) {
                newWidth = maxDimension;
                newHeight = newWidth / ratio;
            }
            // Check height again after adjusting width
            if (newHeight > maxDimension) {
                newHeight = maxDimension;
                newWidth = newHeight * ratio;
            }

            newWidth = Math.floor(newWidth);
            newHeight = Math.floor(newHeight);

            console.log(`New image dimensions: ${newWidth}x${newHeight}`);

            resizeCanvas.width = newWidth;
            resizeCanvas.height = newHeight;

            try {
                ctx.clearRect(0, 0, newWidth, newHeight);
                ctx.drawImage(img, 0, 0, newWidth, newHeight);
                // Use JPEG for better compression, adjust quality as needed
                const resizedDataUrl = resizeCanvas.toDataURL('image/jpeg', 0.9);
                console.log("Image resized successfully.");
                const resizedBlob = await dataUrlToBlob(resizedDataUrl);
                resolve({ resizedDataUrl, resizedBlob });
            } catch (error: any) {
                console.error("Error resizing image:", error);
                reject(new Error(`Failed to resize image: ${error.message || error}`));
            }
        };
        img.onerror = (e) => {
            console.error("Failed to load image for resizing check:", e);
            reject(new Error("Failed to load image for resizing check."));
        };

        // Validate input Data URL
        if (imageDataUrl && typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image')) {
            img.src = imageDataUrl;
        } else {
            reject(new Error("Invalid image source provided for resizing check."));
        }
    });
};

/**
 * Converts a Buffer to a Blob.
 * Useful if image data originates as a Node.js Buffer (server-side).
 * This might not be directly usable in standard browser environments unless using specific libraries or frameworks.
 *
 * @param buffer The image buffer.
 * @param mimeType The MIME type of the image (e.g., 'image/png', 'image/jpeg').
 * @returns The image as a Blob.
 */
export function bufferToBlob(buffer: Buffer, mimeType: string): Blob {
    if (!buffer || !mimeType) {
        throw new Error("Buffer and mimeType are required for bufferToBlob conversion.");
    }
    // Ensure Buffer is correctly converted to ArrayBuffer for Blob constructor
    const arrayBuffer = Uint8Array.from(buffer).buffer;
    return new Blob([arrayBuffer], { type: mimeType });
}
