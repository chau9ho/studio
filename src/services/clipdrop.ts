/**
 * Represents the response from the ClipDrop API.
 */
export interface ClipDropResponse {
  /**
   * The image blob.
   */
  image: Blob;
}


/**
 * Replaces the background of an image using the ClipDrop API.
 * IMPORTANT: This function makes a client-side API call. For production,
 * move this logic to a server action or API route to protect your API key.
 *
 * @param imageFile The image file to process.
 * @param prompt The prompt to use for generating the new background.
 * @param apiKey Your ClipDrop API key.
 * @returns A promise that resolves to the processed image as a Blob.
 */
export async function replaceBackground(
  imageFile: File | Blob, // Accept File or Blob
  prompt: string,
  apiKey: string
): Promise<ClipDropResponse> {

  if (!apiKey) {
    throw new Error("ClipDrop API key is required.");
  }

  const formData = new FormData();
  formData.append('image_file', imageFile);
  formData.append('prompt', prompt);

  try {
    const response = await fetch('https://clipdrop-api.co/replace-background/v1', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        // 'accept' header is set automatically by the browser for Blob responses
      },
      body: formData,
    });

    if (!response.ok) {
      let errorBody = 'Unknown error';
      try {
          // Attempt to read error details from the response
          const errorJson = await response.json();
          errorBody = errorJson.error || JSON.stringify(errorJson);
      } catch (e) {
           errorBody = await response.text();
      }
      throw new Error(`ClipDrop API Error (${response.status}): ${errorBody}`);
    }

    // The response should be the image data directly
    const imageBlob = await response.blob();

    // Ensure the blob has a valid image type
     if (!imageBlob.type.startsWith('image/')) {
        throw new Error(`ClipDrop API returned unexpected content type: ${imageBlob.type}`);
     }


    return {
      image: imageBlob,
    };

  } catch (error) {
    console.error("Error calling ClipDrop API:", error);
    // Re-throw the error so the calling component can handle it
    throw error;
  }
}

/**
 * Converts a Buffer to a Blob.
 * This might be needed if your image capture/upload logic results in a Buffer.
 *
 * @param buffer The image buffer.
 * @param mimeType The MIME type of the image (e.g., 'image/png', 'image/jpeg').
 * @returns The image as a Blob.
 */
export function bufferToBlob(buffer: Buffer, mimeType: string): Blob {
    const arrayBuffer = Uint8Array.from(buffer).buffer;
    return new Blob([arrayBuffer], { type: mimeType });
}


/**
 * Converts a data URL string to a Blob.
 *
 * @param dataUrl The data URL string (e.g., 'data:image/png;base64,...').
 * @returns A promise that resolves to the Blob.
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return blob;
}

/**
* Converts a Blob to a Base64 encoded Data URL string.
*
* @param blob The Blob to convert.
* @returns A promise that resolves to the Data URL string.
*/
export function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
