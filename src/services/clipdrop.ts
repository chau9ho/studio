/**
 * @fileOverview Service functions for interacting with the ClipDrop API and handling image data conversions.
 */

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
 * IMPORTANT: This function makes a client-side API call. Ensure your API key usage aligns with ClipDrop's terms
 * and consider moving sensitive operations server-side in production environments.
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

  const formData = new FormData();
  // Ensure the blob has a filename, required by some APIs
  const fileName = imageFile instanceof File ? imageFile.name : 'image.png';
  formData.append('image_file', imageFile, fileName);
  formData.append('prompt', prompt);

  try {
    const response = await fetch('https://clipdrop-api.co/replace-background/v1', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        // 'Accept' header for blob is usually not needed, browser handles it.
      },
      body: formData,
    });

    if (!response.ok) {
      let errorBody = `API Error (${response.status})`;
      try {
          // Attempt to parse JSON error response from ClipDrop
          const errorJson = await response.json();
          errorBody += `: ${errorJson.error || JSON.stringify(errorJson)}`;
      } catch (e) {
           // If JSON parsing fails, try to get text response
           try {
             errorBody += `: ${await response.text()}`;
           } catch (textError) {
              // Fallback if text reading also fails
              errorBody += ' - Could not read error details.';
           }
      }
      console.error("ClipDrop API Error Response:", errorBody);
      throw new Error(errorBody);
    }

    // Expecting the image data directly as the response body
    const imageBlob = await response.blob();

    // Validate the response Blob type
     if (!imageBlob || !imageBlob.type.startsWith('image/')) {
        console.error("ClipDrop API returned invalid content type:", imageBlob?.type);
        throw new Error(`ClipDrop API returned unexpected content type: ${imageBlob?.type || 'unknown'}`);
     }


    return {
      image: imageBlob, // Return the Blob directly
    };

  } catch (error: any) {
     // Catch network errors or errors thrown above
    console.error("Error calling ClipDrop API:", error);
    // Re-throw a consistent error format
    throw new Error(`ClipDrop API request failed: ${error.message || error}`);
  }
}

/**
 * Converts a Buffer to a Blob.
 * Useful if image data originates as a Node.js Buffer.
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
        const response = await fetch(dataUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch data URL: ${response.statusText}`);
        }
        const blob = await response.blob();
        if (!blob || blob.size === 0) {
             throw new Error("Fetched Blob is empty or invalid.");
        }
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
