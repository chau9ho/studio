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
    // Check if a model is configured before proceeding
    if (!ai.model) {
        console.warn("Attempted to call generateSakuraPromptFlow without a configured AI model. Check API key setup.");
        // Throw a specific error to signal failure clearly
        throw new Error("AI model is not configured. Please check your Google AI API key settings in the application.");
    }
   return generateSakuraPromptFlow(input);
 }

 const prompt = ai.definePrompt({
   name: 'generateSakuraPrompt',
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
      try {
        // The check in the wrapper function should prevent this call if no model exists
        const {output} = await prompt(input); // This uses the default model from ai-instance
        // Ensure output is not null or undefined before returning
        if (!output) {
            throw new Error("Failed to generate prompt: No output from prompt.");
        }
        return output;
      } catch (error: any) {
        // Catch potential errors during the prompt call (e.g., API issues)
        console.error("Error during prompt execution in generateSakuraPromptFlow:", error);
        // Re-throw or handle as appropriate
        throw new Error(`Failed to generate prompt: ${error.message || 'Unknown AI error'}`);
      }
   }
 );
