'use server';

/**
 * @fileOverview Server actions for interacting with Google Cloud Storage.
 */
import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto'; // For generating unique filenames

// Load credentials if the environment variable is set
let storageConfig = {};
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log(`Loading GCS credentials from: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
    storageConfig = { keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS };
} else {
    console.warn("GOOGLE_APPLICATION_CREDENTIALS environment variable is not set. GCS client will attempt to use Application Default Credentials (ADC).");
}

const BUCKET_NAME = 'motherday'; // The GCS bucket name
const OUTPUT_FOLDER_PREFIX = 'motherday/Output/PET/'; // Target folder for framed images

// Initialize GCS client.
// For local development, ensure GOOGLE_APPLICATION_CREDENTIALS env var is set.
// On GCP (Cloud Run, App Engine, etc.), ADC should work automatically if the service account has permissions.
let storage: Storage;
try {
    storage = new Storage(storageConfig);
    console.log("Google Cloud Storage client initialized successfully.");
} catch (error: any) {
    console.error("Failed to initialize Google Cloud Storage client:", error);
    // Set storage to null or handle appropriately to prevent further errors
    // depending on how you want the app to behave if GCS is unavailable.
    // For now, let operations fail downstream if storage is not initialized.
}


/**
 * Lists image files in the specified GCS bucket that match the animalName prefix.
 *
 * @param animalName The name of the animal used as a prefix for filtering images.
 * @returns A promise that resolves to an array of public URLs for the matching images, sorted by creation time descending.
 * @throws {Error} If there's an error listing files or GCS client is not initialized.
 */
export async function listPetImages(animalName: string): Promise<string[]> {
    if (!storage) {
        throw new Error("Google Cloud Storage client is not initialized. Check server logs.");
    }

    if (!animalName || typeof animalName !== 'string' || animalName.trim() === '') {
        console.warn("listPetImages called with empty or invalid animalName.");
        return []; // Return empty array if animalName is invalid
    }

     // Use the raw animalName as the prefix for searching user uploads, not the output folder
    const searchPrefix = `${animalName.trim()}_`;

    console.log(`Listing images in bucket '${BUCKET_NAME}' with prefix '${searchPrefix}' (excluding output folder)...`);

    try {
        const [files] = await storage.bucket(BUCKET_NAME).getFiles({ prefix: searchPrefix });

        console.log(`Found ${files.length} files matching prefix '${searchPrefix}'.`);

        // Filter out potential "directory" objects and files inside the OUTPUT_FOLDER_PREFIX
        const imageFiles = files.filter(file =>
            !file.name.endsWith('/') && !file.name.startsWith(OUTPUT_FOLDER_PREFIX)
        );

         // Sort files by creation time, newest first
        imageFiles.sort((a, b) => {
            const timeA = a.metadata?.timeCreated ? new Date(a.metadata.timeCreated).getTime() : 0;
            const timeB = b.metadata?.timeCreated ? new Date(b.metadata.timeCreated).getTime() : 0;
            return timeB - timeA; // Descending order
        });


        const urls = imageFiles.map(file => `https://storage.googleapis.com/${BUCKET_NAME}/${file.name}`);
        console.log(`Returning URLs for selection: ${JSON.stringify(urls)}`);
        return urls;
    } catch (error: any) {
        console.error(`Error listing files in GCS bucket '${BUCKET_NAME}' with prefix '${searchPrefix}':`, error);
        // Check for specific permission errors
        if (error.code === 403) {
             console.error("Permission denied accessing GCS bucket. Ensure the service account has 'roles/storage.objectViewer' or similar.");
             throw new Error("Permission denied accessing Google Cloud Storage. Check server configuration.");
        }
         if (error.code === 404) {
            console.error(`Bucket '${BUCKET_NAME}' not found.`);
             throw new Error(`Storage bucket '${BUCKET_NAME}' not found. Check configuration.`);
         }
         if (error.message?.includes('Could not refresh access token')) {
            console.error("Authentication error: Could not refresh access token. Verify GOOGLE_APPLICATION_CREDENTIALS or ADC setup.");
            throw new Error("Authentication error accessing Google Cloud Storage. Please check server credentials setup.");
         }
        throw new Error(`Failed to list images from Google Cloud Storage: ${error.message || 'Unknown GCS error'}`);
    }
}

/**
 * Fetches an image from a GCS URL and returns it as a Base64 Data URL.
 * This runs on the server to avoid client-side CORS issues.
 *
 * @param imageUrl The public URL of the image in GCS.
 * @returns A promise that resolves to the image as a Data URL string.
 * @throws {Error} If fetching or conversion fails.
 */
export async function fetchGcsImageAsDataUrl(imageUrl: string): Promise<string> {
    if (!storage) { // Added check for storage initialization
        throw new Error("Google Cloud Storage client is not initialized. Check server logs.");
    }
    if (!imageUrl || !imageUrl.startsWith('https://storage.googleapis.com/')) {
        throw new Error("Invalid GCS image URL provided.");
    }

    // Extract bucket name and file path from URL
    const urlParts = new URL(imageUrl);
    const pathParts = urlParts.pathname.split('/');
    const bucketName = pathParts[1]; // First part after the slash is the bucket name
    const filePath = pathParts.slice(2).join('/'); // The rest is the file path

    if (!bucketName || !filePath) {
         throw new Error("Could not parse bucket name or file path from URL.");
    }

    console.log(`Fetching GCS image from bucket '${bucketName}', path '${filePath}'`);

    try {
        // Use the GCS client library to download the file content
        const [fileContent] = await storage.bucket(bucketName).file(filePath).download();

        // Get metadata to determine content type
        const [metadata] = await storage.bucket(bucketName).file(filePath).getMetadata();
        const contentType = metadata.contentType || 'image/png'; // Default to png if not set

        // Convert Buffer to Base64 Data URL
        const dataUrl = `data:${contentType};base64,${fileContent.toString('base64')}`;

        console.log(`Successfully fetched and converted GCS image to Data URL (size: ${dataUrl.length} chars).`);
        return dataUrl;

    } catch (error: any) {
        console.error(`Error fetching or converting GCS image from URL (${imageUrl}):`, error);
         // Check for specific permission errors
        if (error.code === 403) {
             console.error("Permission denied fetching GCS object. Ensure the service account has 'roles/storage.objectViewer' or similar.");
             throw new Error("Permission denied fetching image from Google Cloud Storage.");
        }
         if (error.code === 404) {
             console.error(`File '${filePath}' not found in bucket '${bucketName}'.`);
             throw new Error(`Image not found in storage: ${filePath}`);
         }
          if (error.message?.includes('Could not refresh access token')) {
              console.error("Authentication error: Could not refresh access token during fetch. Verify GOOGLE_APPLICATION_CREDENTIALS or ADC setup.");
              throw new Error("Authentication error accessing Google Cloud Storage. Please check server credentials setup.");
          }
        throw new Error(`Failed to process GCS image: ${error.message || 'Unknown GCS error'}`);
    }
}


/**
 * Uploads a framed image (as a Base64 Data URL) to Google Cloud Storage.
 *
 * @param dataUrl The Base64 Data URL of the image to upload.
 * @param animalName The name of the animal, used for generating the filename.
 * @returns A promise that resolves to the public URL of the uploaded image.
 * @throws {Error} If the upload fails or the GCS client is not initialized.
 */
export async function uploadFramedImageToGcs(dataUrl: string, animalName: string): Promise<string> {
    if (!storage) {
        throw new Error("Google Cloud Storage client is not initialized. Check server logs.");
    }
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        throw new Error("Invalid Data URL provided for upload.");
    }
     if (!animalName || typeof animalName !== 'string' || animalName.trim() === '') {
        // Use a default name if none provided, but log a warning
        console.warn("uploadFramedImageToGcs called with empty or invalid animalName. Using 'unknown_pet'.");
        animalName = 'unknown_pet';
    }

    // Extract image data and type from Data URL
    const matches = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        throw new Error("Could not parse Data URL.");
    }
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    const fileExtension = mimeType.split('/')[1] || 'png'; // Default to png

    // Generate a unique filename: animalName + randomUUID + extension
    const uniqueId = randomUUID().replace(/-/g, ''); // Remove hyphens for cleaner name
    const fileName = `${animalName.trim()}_${uniqueId}.${fileExtension}`;
    const filePath = `${OUTPUT_FOLDER_PREFIX}${fileName}`; // Include the target folder path

    console.log(`Uploading framed image to GCS: Bucket='${BUCKET_NAME}', Path='${filePath}'`);

    const file = storage.bucket(BUCKET_NAME).file(filePath);

    try {
        // Upload the buffer
        await file.save(buffer, {
            metadata: {
                contentType: mimeType,
                // Optional: Add custom metadata if needed
                // metadata: { source: 'SakuraPetFramesApp' }
            },
            // Ensure the file is resumable for robustness, especially for larger files
            resumable: true,
        });

        console.log(`File uploaded successfully to ${filePath}.`);

         // Attempt to make the file publicly readable in a separate try...catch
         try {
             console.log(`Making ${filePath} public...`);
             await file.makePublic();
             console.log(`File is now public at ${filePath}`);
         } catch (publicError: any) {
             // Log the error but *don't* re-throw. The core upload succeeded
             console.error(`Error making file public (${filePath}):`, publicError);
             console.warn("Could not make the uploaded image public, but the upload itself succeeded.");
             // Depending on the app's needs, you might want to:
             // - Add metadata to the object indicating it needs to be made public later.
             // - Trigger a background task to retry making it public.
             // For this app, we'll proceed and return the URL, assuming public access isn't strictly required immediately
             // or can be handled manually if needed.
         }

        const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${filePath}`;
        console.log(`File available at: ${publicUrl}`);

        return publicUrl;

    } catch (error: any) {
        console.error(`Error uploading file to GCS path '${filePath}':`, error);
         // Check for specific permission errors related to the *upload* itself
        if (error.code === 403) {
             console.error("Permission denied writing to GCS bucket/path. Ensure the service account has 'roles/storage.objectCreator' or 'roles/storage.objectAdmin'.");
             throw new Error("Permission denied uploading image to Google Cloud Storage. Check server configuration.");
        }
         if (error.message?.includes('Could not refresh access token')) {
             console.error("Authentication error: Could not refresh access token during upload. Verify GOOGLE_APPLICATION_CREDENTIALS or ADC setup.");
            throw new Error("Authentication error uploading to Google Cloud Storage. Please check server credentials setup.");
         }
         // Throw for other upload-related errors
        throw new Error(`Failed to upload image to Google Cloud Storage: ${error.message || 'Unknown GCS error'}`);
    }
}

