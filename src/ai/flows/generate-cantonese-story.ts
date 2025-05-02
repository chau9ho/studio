'use server';

 /**
  * @fileOverview Generates a short Cantonese story about the animal in a Sakura-themed setting.
  *
  * - generateCantoneseStory - A function that handles the story generation process.
  * - GenerateCantoneseStoryInput - The input type for the generateCantoneseStory function.
  * - GenerateCantoneseStoryOutput - The return type for the generateCantoneseStory function.
  */

 import {ai} from '@/ai/ai-instance';
 import {z} from 'genkit';
 import { GenkitError } from 'genkit'; // Corrected import path

 const GenerateCantoneseStoryInputSchema = z.object({
   animalName: z.string().describe('The name of the animal.'),
   animalDescription: z.string().describe('A description of the animal in Cantonese.'),
   backgroundDescription: z.string().describe('A description of the background, including sakura elements.'),
 });
 export type GenerateCantoneseStoryInput = z.infer<
   typeof GenerateCantoneseStoryInputSchema
 >;

 const GenerateCantoneseStoryOutputSchema = z.object({
   story: z.string().describe('A short Cantonese story about the animal.'),
 });
 export type GenerateCantoneseStoryOutput = z.infer<
   typeof GenerateCantoneseStoryOutputSchema
 >;

 export async function generateCantoneseStory(
   input: GenerateCantoneseStoryInput
 ): Promise<GenerateCantoneseStoryOutput> {
    // Implicit check via ai.generate in the flow
    try {
         // Ensure a model is available before attempting the flow.
        if (!ai.listModels().find(m => m.startsWith('googleai/'))) { // Check if any Google AI model is configured
             throw new Error("AI model (Google AI) is not configured. Please ensure the GOOGLE_GENAI_API_KEY is correctly set in your environment variables.");
        }
       return await generateCantoneseStoryFlow(input);
    } catch (error: any) {
        // Catch errors from the flow execution, including initialization issues
        console.error("Error executing generateCantoneseStoryFlow:", error);

        // Check if the error indicates an unconfigured model or API issue
         if (error instanceof GenkitError && (error.status === 'UNAVAILABLE' || error.status === 'INVALID_ARGUMENT')) {
             // Provide a user-friendly message for common configuration/API key issues
             throw new Error("AI model is unavailable or configured incorrectly. Please check your GOOGLE_GENAI_API_KEY and ensure it's valid.");
        } else if (error.message && error.message.includes("AI model is not configured")) {
             // Catch the specific error thrown above if still relevant
            throw new Error(error.message);
        }
        // Re-throw other errors
        throw new Error(`Failed to generate story: ${error.message || 'Unknown AI error'}`);
    }
 }

 const prompt = ai.definePrompt({
   name: 'generateCantoneseStoryPrompt',
    model: 'googleai/gemini-2.0-flash', // Specify the model for this prompt
   input: {
     schema: z.object({
       animalName: z.string().describe('The name of the animal.'),
       animalDescription: z.string().describe('A description of the animal in Cantonese.'),
       backgroundDescription: z
         .string()
         .describe('A description of the background, including sakura elements.'),
     }),
   },
   output: {
     schema: z.object({
       story: z.string().describe('A short Cantonese story about the animal.'),
     }),
   },
   prompt: `你係一位用廣東話寫故仔嘅作家，請根據提供既動物名稱、描述同場景寫一段約100字既故事。

 動物名: {{{animalName}}}
 描述: {{{animalDescription}}}
 場景: {{{backgroundDescription}}}`,
 });

 const generateCantoneseStoryFlow = ai.defineFlow<
   typeof GenerateCantoneseStoryInputSchema,
   typeof GenerateCantoneseStoryOutputSchema
 >(
   {
     name: 'generateCantoneseStoryFlow',
     inputSchema: GenerateCantoneseStoryInputSchema,
     outputSchema: GenerateCantoneseStoryOutputSchema,
   },
   async input => {
      // No try-catch needed here for the prompt call itself if errors are handled in the wrapper
      const {output} = await prompt(input); // Call the specific prompt
      // Ensure output is not null or undefined before returning
      if (!output) {
          throw new Error("Failed to generate story: No output from prompt.");
      }
      return output;
   }
 );
