'use server';

 /**
  * @fileOverview Analyzes the characteristics of an animal in an image and describes it in Cantonese.
  *
  * - analyzeAnimalFeatures - A function that handles the animal feature analysis process.
  * - AnalyzeAnimalFeaturesInput - The input type for the analyzeAnimalFeatures function.
  * - AnalyzeAnimalFeaturesOutput - The return type for the analyzeAnimalFeatures function.
  */

 import {ai} from '@/ai/ai-instance';
 import {z} from 'genkit';
 import { GenkitError } from 'genkit'; // Corrected import path

 const AnalyzeAnimalFeaturesInputSchema = z.object({
   photoDataUri: z
     .string()
     .describe(
       "A photo of an animal, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
     ),
 });
 export type AnalyzeAnimalFeaturesInput = z.infer<typeof AnalyzeAnimalFeaturesInputSchema>;

 const AnalyzeAnimalFeaturesOutputSchema = z.object({
   animalDescription: z
     .string()
     .describe('A description of the animal in Cantonese, including its appearance.'),
 });
 export type AnalyzeAnimalFeaturesOutput = z.infer<typeof AnalyzeAnimalFeaturesOutputSchema>;

 export async function analyzeAnimalFeatures(
   input: AnalyzeAnimalFeaturesInput
 ): Promise<AnalyzeAnimalFeaturesOutput> {
    // The AI model availability is checked implicitly when calling the flow.
    // ai.generate checks for configured models internally in Genkit v1.x.
    try {
        // Ensure a model is available before attempting the flow.
        // Note: ai.model might not be sufficient if the prompt requires a specific model type (e.g., multimodal)
        // A more robust check might involve trying a small test generation or checking capabilities.
        if (!ai.listModels().find(m => m.startsWith('googleai/'))) { // Check if any Google AI model is configured
             throw new Error("AI model (Google AI) is not configured. Please ensure the GOOGLE_GENAI_API_KEY is correctly set in your environment variables.");
        }
        return await analyzeAnimalFeaturesFlow(input);
    } catch (error: any) {
         // Catch errors from the flow execution, including initialization issues
        console.error("Error executing analyzeAnimalFeaturesFlow:", error);

        // Check if the error indicates an unconfigured model or API issue
        if (error instanceof GenkitError && (error.status === 'UNAVAILABLE' || error.status === 'INVALID_ARGUMENT')) {
             // Provide a user-friendly message for common configuration/API key issues
             throw new Error("AI model is unavailable or configured incorrectly. Please check your GOOGLE_GENAI_API_KEY and ensure it's valid.");
        } else if (error.message && error.message.includes("AI model is not configured")) {
             // Catch the specific error thrown above if still relevant
            throw new Error(error.message);
        }
        // Re-throw other errors
        throw new Error(`Failed to analyze animal features: ${error.message || 'Unknown AI error'}`);
    }
 }

 const prompt = ai.definePrompt({
   name: 'analyzeAnimalFeaturesPrompt',
   model: 'googleai/gemini-2.0-flash', // Specify the model for this prompt
   input: {
     schema: z.object({
       photoDataUri: z
         .string()
         .describe(
           "A photo of an animal, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
         ),
     }),
   },
   output: {
     schema: z.object({
       animalDescription: z
         .string()
         .describe('A description of the animal in Cantonese, including its appearance.'),
     }),
   },
   prompt: `請用廣東話講解呢張相入邊嘅動物係咩，簡單描述外型，例如：黃色既家貓、白色柴犬等。

    {{media url=photoDataUri}}`,
 });

 const analyzeAnimalFeaturesFlow = ai.defineFlow<
   typeof AnalyzeAnimalFeaturesInputSchema,
   typeof AnalyzeAnimalFeaturesOutputSchema
 >({
   name: 'analyzeAnimalFeaturesFlow',
   inputSchema: AnalyzeAnimalFeaturesInputSchema,
   outputSchema: AnalyzeAnimalFeaturesOutputSchema,
 },
 async input => {
    // No try-catch needed here for the prompt call itself if errors are handled in the wrapper
    const {output} = await prompt(input); // Call the specific prompt
    // Ensure output is not null or undefined before returning
    if (!output) {
        throw new Error("Failed to analyze animal: No output from prompt.");
    }
   return output!;
 });
