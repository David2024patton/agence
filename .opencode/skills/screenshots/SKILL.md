---
name: screenshots
description: When the user mentions screenshots, images, or "look at this", always check C:\Users\David\Pictures\Screenshots\ for the latest screenshots first. Use the image_describe tool to analyze them.
---

# Screenshot Handling

The user's system saves screenshots to:
- **Windows:** `C:\Users\David\Pictures\Screenshots\`
- **Desktop shortcuts:** `C:\Users\David\Desktop\` (look for `*.png`)

When the user asks about photos, screenshots, or "can you see this":
1. First check `C:\Users\David\Pictures\Screenshots\` for recent files
2. Sort by newest first
3. Use the `image_describe` tool to extract text and describe each image
4. Compare images if the user asks about differences

The `image_describe` tool uses OCR.space (free 25K/month) with fallback to tesseract OCR if available, or Ollama vision models.
