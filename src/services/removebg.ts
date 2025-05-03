/**
 * @fileOverview Service function for interacting with the Remove.bg API.
 */

import { dataUrlToBlob } from '@/lib/imageUtils'; // Assuming you have this utility

/**
 * Removes the background from an image using the Remove.bg API.
 *
 * @param imageFile The image file (as File or Blob) to process.
 * @param apiKey Your Remove.bg API key.
 * @returns A promise that resolves to an ArrayBuffer containing the processed image data (typically PNG).
 * @throws {Error} If the API key is missing, the API call fails, or the response is invalid.
 */
export async function removeBackgroundWithRemoveBg(
  imageFile: File | Blob,
  apiKey: string
): Promise<ArrayBuffer> {

  if (!apiKey) {
    throw new Error("Remove.bg API key is required.");
  }
  if (!imageFile) {
      throw new Error("Image file is required for Remove.bg.");
  }

  const formData = new FormData();
  formData.append("size", "auto"); // Or specify a size like 'preview', 'hd', etc.

  // Ensure the blob has a filename if it's not a File object
  const fileName = imageFile instanceof File ? imageFile.name : 'image_to_remove_bg.png'; // Provide a default name
  formData.append('image_file', imageFile, fileName);

  let response: Response; // Declare response outside try block

  try {
    console.log(`Sending image (${(imageFile.size / (1024*1024)).toFixed(2)} MB) to Remove.bg API...`);
    response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      let errorBody = `Remove.bg API Error (${response.status})`;
      let errorDetails = '';
      try {
          // Remove.bg often returns errors in the response body as JSON
          const errorJson = await response.json();
           errorDetails = errorJson.errors?.[0]?.title || JSON.stringify(errorJson);
           errorBody += `: ${errorDetails}`;
      } catch (e) {
           // If JSON parsing fails, try to get text response
           try {
             const textResponse = await response.text();
             errorDetails = textResponse;
              errorBody += `: ${errorDetails}`;
           } catch (textError) {
              errorBody += ' - Could not read error details.';
           }
      }
       console.error("Remove.bg API Error Response:", errorBody);
       // Check for common specific errors
       if (response.status === 402) { // Payment Required / Credits exhausted
            throw new Error("Remove.bg API Error: Insufficient credits.");
       }
        if (response.status === 400 && errorDetails.includes("Unable to detect foreground")) {
             throw new Error("Remove.bg API Error: Could not detect the main subject in the image.");
        }
       throw new Error(errorBody); // Throw the detailed error
    }

    // Expecting the image data directly as the response body (ArrayBuffer)
    const imageArrayBuffer = await response.arrayBuffer();

    if (!imageArrayBuffer || imageArrayBuffer.byteLength === 0) {
         console.error("Remove.bg API returned empty response body.");
         throw new Error("Remove.bg API returned empty image data.");
    }

     console.log(`Remove.bg processed image received (${(imageArrayBuffer.byteLength / (1024*1024)).toFixed(2)} MB).`);
    return imageArrayBuffer; // Return the ArrayBuffer

  } catch (error: any) {
    // Catch network errors or errors thrown above
    console.error("Error calling Remove.bg API:", error);

    let errorMessage = "Remove.bg API request failed";
    if (error.message.includes("Failed to fetch")) {
        errorMessage += ": Could not connect to the API. Check your network connection or if there are Cross-Origin (CORS) restrictions.";
         console.warn("Hint: 'Failed to fetch' can sometimes indicate a CORS issue. Consider backend integration for API keys.");
    } else if (error.message.includes("API Error")) {
         // Use the detailed error message thrown from the response check or specific errors
         errorMessage = error.message;
    } else {
        errorMessage += `: ${error.message || 'Unknown error'}`;
    }

    throw new Error(errorMessage);
  }
}
