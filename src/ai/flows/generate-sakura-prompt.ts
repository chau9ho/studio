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
     const {output} = await prompt(input);
     // Ensure output is not null or undefined before returning
     if (!output) {
         throw new Error("Failed to generate prompt: No output from prompt.");
     }
     return output;
   }
 );