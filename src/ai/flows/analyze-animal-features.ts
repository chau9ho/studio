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
    // Check if a model is configured before proceeding
    if (!ai.model) {
        console.warn("Attempted to call analyzeAnimalFeaturesFlow without a configured AI model. Check API key setup.");
        // Throw a specific error to signal failure clearly
        throw new Error("AI model is not configured. Please check your Google AI API key settings in the application.");
    }
   return analyzeAnimalFeaturesFlow(input);
 }

 const prompt = ai.definePrompt({
   name: 'analyzeAnimalFeaturesPrompt',
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
    try {
        // The check in the wrapper function should prevent this call if no model exists
       const {output} = await prompt(input); // Uses default model from ai-instance
        // Ensure output is not null or undefined before returning
        if (!output) {
            throw new Error("Failed to analyze animal: No output from prompt.");
        }
       return output!;
    } catch (error: any) {
        // Catch potential errors during the prompt call (e.g., API issues)
        console.error("Error during prompt execution in analyzeAnimalFeaturesFlow:", error);
        // Re-throw or handle as appropriate
        throw new Error(`Failed to analyze animal features: ${error.message || 'Unknown AI error'}`);
    }
 });
