'use server';

/**
 * @fileOverview Server actions for interacting with Google Cloud Storage.
 */
import { Storage } from '@google-cloud/storage';

const BUCKET_NAME = 'motherday'; // The GCS bucket name

// Initialize GCS client.
// For local development, ensure GOOGLE_APPLICATION_CREDENTIALS env var is set.
// On GCP (Cloud Run, App Engine, etc.), ADC should work automatically if the service account has permissions.
let storage: Storage;
try {
    storage = new Storage();
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

    const prefix = `${animalName.trim()}_`; // Use trimmed name and add underscore

    console.log(`Listing images in bucket '${BUCKET_NAME}' with prefix '${prefix}'...`);

    try {
        const [files] = await storage.bucket(BUCKET_NAME).getFiles({ prefix });

        console.log(`Found ${files.length} files matching prefix '${prefix}'.`);

        // Filter out potential "directory" objects if using prefixes that simulate folders
        const imageFiles = files.filter(file => !file.name.endsWith('/'));

         // Sort files by creation time, newest first
        imageFiles.sort((a, b) => {
            const timeA = a.metadata?.timeCreated ? new Date(a.metadata.timeCreated).getTime() : 0;
            const timeB = b.metadata?.timeCreated ? new Date(b.metadata.timeCreated).getTime() : 0;
            return timeB - timeA; // Descending order
        });


        const urls = imageFiles.map(file => `https://storage.googleapis.com/${BUCKET_NAME}/${file.name}`);
        console.log(`Returning URLs: ${JSON.stringify(urls)}`);
        return urls;
    } catch (error: any) {
        console.error(`Error listing files in GCS bucket '${BUCKET_NAME}' with prefix '${prefix}':`, error);
        // Check for specific permission errors
        if (error.code === 403) {
             console.error("Permission denied accessing GCS bucket. Ensure the service account has 'roles/storage.objectViewer' or similar.");
             throw new Error("Permission denied accessing Google Cloud Storage. Check server configuration.");
        }
         if (error.code === 404) {
            console.error(`Bucket '${BUCKET_NAME}' not found.`);
             throw new Error(`Storage bucket '${BUCKET_NAME}' not found. Check configuration.`);
         }
        throw new Error(`Failed to list images from Google Cloud Storage: ${error.message || 'Unknown GCS error'}`);
    }
}
