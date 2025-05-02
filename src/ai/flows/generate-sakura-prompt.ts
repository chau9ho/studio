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
 import { GenkitError } from 'genkit'; // Corrected import path

 const GenerateSakuraPromptInputSchema = z.object({
   category: z.string().describe('The category of the background.'),
   tags: z.string().describe('The tags associated with the background.'),
 });
 export type GenerateSakuraPromptInput = z.infer<typeof GenerateSakuraPromptInputSchema>;

 const GenerateSakuraPromptOutputSchema = z.object({
   prompt: z.string().describe('The generated sakura-themed image prompt.'),
 });
 export type GenerateSakuraPromptOutput = z.infer<typeof GenerateSakuraPromptOutputSchema>;

 export async function generateSakuraPrompt(input: GenerateSakuraPromptInput): Promise<GenerateSakuraPromptOutput> {
    // Implicit check via ai.generate in the flow
    try {
        // Ensure a model is available before attempting the flow.
        if (!ai.listModels().find(m => m.startsWith('googleai/'))) { // Check if any Google AI model is configured
             throw new Error("AI model (Google AI) is not configured. Please ensure the GOOGLE_GENAI_API_KEY is correctly set in your environment variables.");
        }
      return await generateSakuraPromptFlow(input);
    } catch (error: any) {
        // Catch errors from the flow execution, including initialization issues
       console.error("Error executing generateSakuraPromptFlow:", error);

        // Check if the error indicates an unconfigured model or API issue
         if (error instanceof GenkitError && (error.status === 'UNAVAILABLE' || error.status === 'INVALID_ARGUMENT')) {
             // Provide a user-friendly message for common configuration/API key issues
             throw new Error("AI model is unavailable or configured incorrectly. Please check your GOOGLE_GENAI_API_KEY and ensure it's valid.");
        } else if (error.message && error.message.includes("AI model is not configured")) {
             // Catch the specific error thrown above if still relevant
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
       tags: z.string().describe('The tags associated with the background.'),
     }),
   },
   output: {
     schema: z.object({
       prompt: z.string().describe('The generated sakura-themed image prompt.'),
     }),
   },
   prompt: `You generate vivid background-only image prompts that always include sakura elements creatively. No people or animals. Always in English.\n\nCategory: {{{category}}}\nTags: {{{tags}}}`,
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
      return output;
   }
 );
