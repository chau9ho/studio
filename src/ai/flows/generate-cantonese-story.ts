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
    // Check if a model is configured before proceeding
    if (!ai.model) {
        console.warn("Attempted to call generateCantoneseStoryFlow without a configured AI model. Check API key setup.");
        // Throw a specific error to signal failure clearly
        throw new Error("AI model is not configured. Please check your Google AI API key settings in the application.");
    }
   return generateCantoneseStoryFlow(input);
 }

 const prompt = ai.definePrompt({
   name: 'generateCantoneseStoryPrompt',
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
      try {
        // The check in the wrapper function should prevent this call if no model exists
         const {output} = await prompt(input); // Uses default model from ai-instance
         // Ensure output is not null or undefined before returning
         if (!output) {
             throw new Error("Failed to generate story: No output from prompt.");
         }
         return output;
      } catch (error: any) {
            // Catch potential errors during the prompt call (e.g., API issues)
            console.error("Error during prompt execution in generateCantoneseStoryFlow:", error);
            // Re-throw or handle as appropriate
            throw new Error(`Failed to generate story: ${error.message || 'Unknown AI error'}`);
      }
   }
 );
