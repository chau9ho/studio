import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import type {Plugin} from 'genkit';

const plugins: Plugin<any>[] = [];

// Only add the Google AI plugin if the API key is present
if (process.env.GOOGLE_GENAI_API_KEY && process.env.GOOGLE_GENAI_API_KEY !== 'DISABLED') {
  plugins.push(
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
    })
  );
  console.log("Google AI Plugin initialized.");
} else {
    console.warn("GOOGLE_GENAI_API_KEY is not set or is 'DISABLED'. Google AI plugin will not be initialized. AI features requiring this plugin will be disabled or use placeholders.");
}


export const ai = genkit({
  promptDir: './prompts', // Assuming you might have prompts here later
  plugins: plugins,
  // Default model - specify a model that exists even if the plugin isn't loaded
  // This avoids errors if no plugins are loaded but `ai.generate` is called.
  // However, calls will fail if the specified model requires a non-loaded plugin.
  model: plugins.length > 0 ? 'googleai/gemini-2.0-flash' : undefined,
  logLevel: 'debug', // Optional: for more detailed logging during development
  enableTracing: true, // Optional: for better debugging
});
