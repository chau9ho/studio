# **App Name**: Sakura Pet Frames

## Core Features:

- Background Prompt Generation: Generate an image background prompt based on user-selected categories and tags, infused with sakura elements, using the provided GPT API endpoint (lmzh.top/v1/chat/completions). The prompt will be in English and will be used as input for the ClipDrop API.
- Animal Feature Analysis: Analyze uploaded or webcam captured animal images using the Vision Model API (lmzh.top/v1/chat/completions) to identify and describe the animal's features in Cantonese.  This information will be used by the story generation tool.
- Cantonese Story Generation: Generate a short (100字) Cantonese story featuring the identified animal in the generated sakura-themed background, using the provided GPT API endpoint (lmzh.top/v1/chat/completions). The story will incorporate the animal's features and the chosen background scenario.
- Image Processing and Framing: Allow users to upload animal photos or take pictures using their webcam. Integrate with ClipDrop API to replace the background of the image with a sakura-themed background generated based on the prompt. Place the resulting image within a 1410x2250 px white frame (frame.png) for 4R printing, starting the image placement at H 300.

## Style Guidelines:

- Primary color: Soft pastel pink (#FCDDE0) to evoke the feeling of cherry blossoms.
- Secondary color: Light beige (#F5F5DC) for a clean, gentle background.
- Accent: Light teal (#70BDBD) for interactive elements like buttons and links.
- Clear and readable font optimized for both Traditional Chinese and English.
- Simple, outlined icons with a touch of Japanese aesthetic.
- Clean and minimalistic layout with generous whitespace to focus on the generated images and stories.
- Subtle, elegant transitions and animations to enhance the user experience without being distracting.