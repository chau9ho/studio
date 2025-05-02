'use server';
 /**
  * @fileOverview Generates a sakura-themed image prompt based on user-selected category and tags.
  *
  * - generateSakuraPrompt - A function that generates the image prompt.
  * - GenerateSakuraPromptInput - The input type for the generateSakuraPrompt function.
  * - GenerateSakuraPromptOutput - The return type for the generateSakuraPrompt function.
  */

 import {ai} from '@/ai/ai-instance';
 import {z} from 'genkit';
 import { GenkitError } from 'genkit';

 const GenerateSakuraPromptInputSchema = z.object({
   category: z.string().describe('The category of the background.'),
   // Updated description to reflect multiple tags as a comma-separated string
   tags: z.string().describe('Comma-separated tags associated with the background.'),
 });
 export type GenerateSakuraPromptInput = z.infer<typeof GenerateSakuraPromptInputSchema>;

 const GenerateSakuraPromptOutputSchema = z.object({
   prompt: z.string().describe('The generated sakura-themed image prompt in English.'),
 });
 export type GenerateSakuraPromptOutput = z.infer<typeof GenerateSakuraPromptOutputSchema>;

 export async function generateSakuraPrompt(input: GenerateSakuraPromptInput): Promise<GenerateSakuraPromptOutput> {
    try {
      // Check if the specific model needed is available
      const models = await ai.listModels();
      const requiredModel = 'googleai/gemini-2.0-flash'; // Or whichever model this prompt uses
      if (!models.includes(requiredModel)) {
        console.error(`Required model ${requiredModel} not available or configured.`);
        throw new Error(`AI model (${requiredModel}) is not available or configured. Please check your API key and configuration.`);
      }

      return await generateSakuraPromptFlow(input);
    } catch (error: any) {
        // Catch errors from the flow execution, including initialization issues
       console.error("Error executing generateSakuraPromptFlow:", error);

        // Check if the error indicates an unconfigured model or API issue
         if (error instanceof GenkitError && (error.status === 'UNAVAILABLE' || error.status === 'INVALID_ARGUMENT')) {
             // Provide a user-friendly message for common configuration/API key issues
             throw new Error("AI model is unavailable or configured incorrectly. Please check your GOOGLE_GENAI_API_KEY and ensure it's valid and the model is available.");
        } else if (error.message && (error.message.includes("AI model is not configured") || error.message.includes("not available"))) {
            // Catch the specific error thrown previously if still relevant
            throw new Error(error.message);
        }
       // Re-throw other errors
       throw new Error(`Failed to generate prompt: ${error.message || 'Unknown AI error'}`);
    }
 }

 const prompt = ai.definePrompt({
   name: 'generateSakuraPrompt',
   model: 'googleai/gemini-2.0-flash', // Specify the model for this prompt
   input: {
     schema: z.object({
       category: z.string().describe('The category of the background.'),
        // Updated description for input schema
       tags: z.string().describe('Comma-separated tags associated with the background.'),
     }),
   },
   output: {
     schema: z.object({
        // Ensure output description matches the requested format
       prompt: z.string().describe('The generated sakura-themed image prompt in English.'),
     }),
   },
    // Updated prompt instruction for stronger emphasis on sakura and handling multiple tags
   prompt: `Generate a vivid, background-only image prompt. This prompt MUST creatively incorporate sakura (cherry blossom) elements, regardless of the category or tags. The final prompt should be in English and suitable for an image generation model like ClipDrop. Do not include people or animals in the background description itself.\n\nCategory: {{{category}}}\nTags: {{{tags}}}\n\nEnsure sakura elements are naturally integrated or prominently featured.`,
 });

 const generateSakuraPromptFlow = ai.defineFlow<
   typeof GenerateSakuraPromptInputSchema,
   typeof GenerateSakuraPromptOutputSchema
 >(
   {
     name: 'generateSakuraPromptFlow',
     inputSchema: GenerateSakuraPromptInputSchema,
     outputSchema: GenerateSakuraPromptOutputSchema,
   },
   async input => {
      // No try-catch needed here for the prompt call itself if errors are handled in the wrapper
      const {output} = await prompt(input); // Call the specific prompt
      // Ensure output is not null or undefined before returning
      if (!output) {
          throw new Error("Failed to generate prompt: No output from prompt.");
      }
       console.log("Generated background prompt:", output.prompt); // Log the generated prompt
      return output;
   }
 );
