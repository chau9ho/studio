/**
 * @fileOverview Service functions for interacting with the ClipDrop API and handling image data conversions.
 */

import { resizeImageIfNeeded } from '@/lib/imageUtils'; // Import resize utility
import { MAX_IMAGE_DIMENSION } from '@/components/app/SakuraPetFramesApp'; // Import max dimension constant

/**
 * Represents the response from the ClipDrop API replace-background endpoint.
 */
export interface ClipDropResponse {
  /**
   * The processed image as a Blob.
   */
  image: Blob;
}


/**
 * Replaces the background of an image using the ClipDrop API replace-background endpoint.
 * Attempts to resize the image if it exceeds ClipDrop's dimension limits before sending.
 *
 * @param imageFile The image file (as File or Blob) to process.
 * @param prompt The text prompt describing the desired background.
 * @param apiKey Your ClipDrop API key.
 * @returns A promise that resolves to a ClipDropResponse containing the processed image Blob.
 * @throws {Error} If the API key is missing, the API call fails, or the response is invalid.
 */
export async function replaceBackground(
  imageFile: File | Blob,
  prompt: string,
  apiKey: string
): Promise<ClipDropResponse> {

  if (!apiKey) {
    throw new Error("ClipDrop API key is required.");
  }
  if (!imageFile) {
      throw new Error("Image file is required.");
  }
   if (!prompt) {
       throw new Error("Prompt is required.");
   }

   let imageToSend = imageFile;

   // --- Optional: Resize check before sending to ClipDrop ---
   // ClipDrop might handle resizing, but pre-resizing can sometimes prevent 400 errors
   // This requires converting Blob to DataURL first, which adds overhead.
   // Consider enabling this if you frequently hit dimension limits.
   /*
   try {
       const dataUrl = await blobToDataUrl(imageFile); // Convert Blob/File to DataURL
       const { resizedBlob } = await resizeImageIfNeeded(dataUrl, MAX_IMAGE_DIMENSION);
       if (resizedBlob.size < imageFile.size) {
           console.log(`Pre-resized image for ClipDrop from ${imageFile.size} to ${resizedBlob.size} bytes.`);
           imageToSend = resizedBlob;
       }
   } catch (resizeError: any) {
        console.warn(`Could not pre-check/resize image for ClipDrop: ${resizeError.message}. Sending original.`);
        // Continue with the original image if resizing check fails
   }
   */
   // --- End Optional Resize ---


  const formData = new FormData();
  // Ensure the blob has a filename, required by some APIs
  const fileName = imageToSend instanceof File ? imageToSend.name : 'image_for_clipdrop.png';
  formData.append('image_file', imageToSend, fileName);
  formData.append('prompt', prompt);

  let response: Response;

  try {
    console.log(`Sending image (${(imageToSend.size / (1024*1024)).toFixed(2)} MB) to ClipDrop API...`);
    response = await fetch('https://clipdrop-api.co/replace-background/v1', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      // Handle error responses more robustly
      let errorBody = `ClipDrop API Error (${response.status})`;
      let errorDetails = '';
      try {
          const errorJson = await response.json();
           errorDetails = errorJson.error || JSON.stringify(errorJson);
      } catch (e) {
           try {
             const textResponse = await response.text();
             errorDetails = textResponse;
           } catch (textError) {
               errorDetails = 'Could not read error details.';
           }
      }
      errorBody += `: ${errorDetails}`;
      console.error("ClipDrop API Error Response:", errorBody);
      throw new Error(errorBody); // Throw the detailed error
    }

    // Expecting the image data directly as the response body
    const imageBlob = await response.blob();

    // Validate the response Blob type
     if (!imageBlob || !imageBlob.type.startsWith('image/')) {
        console.error("ClipDrop API returned invalid content type:", imageBlob?.type);
        throw new Error(`ClipDrop API returned unexpected content type: ${imageBlob?.type || 'unknown'}`);
     }

      console.log(`ClipDrop processed image received. Type: ${imageBlob.type}, Size: ${imageBlob.size} bytes.`);
    return {
      image: imageBlob,
    };

  } catch (error: any) {
    // Catch network errors or errors thrown above
    console.error("Error calling ClipDrop API:", error);
     let errorMessage = `ClipDrop API request failed: ${error.message || 'Unknown error'}`;
     // Refine common error messages based on the caught error
     if (errorMessage.includes("API Error (401)") || errorMessage.includes("API Error (403)")) {
        errorMessage = "ClipDrop API Key 無效或已過期，請檢查設定。";
     } else if (errorMessage.includes("API Error (429)")) {
         errorMessage = "ClipDrop API 使用量已達上限，請稍後再試。";
     } else if (errorMessage.includes("API Error (400)") && (errorMessage.includes("resolution exceeds") || errorMessage.includes("max pixels"))) {
         errorMessage = `圖片解像度過高 (${(imageToSend.size / (1024*1024)).toFixed(1)}MB)，無法處理。請使用較小圖片。`;
     } else if (errorMessage.includes("Failed to fetch")) {
         errorMessage = "無法連接 ClipDrop API，請檢查網絡或稍後再試。";
     }
    throw new Error(errorMessage); // Re-throw standardized error
  }
}

// Keep image utility functions separate (moved to lib/imageUtils.ts)
// bufferToBlob, dataUrlToBlob, blobToDataUrl
