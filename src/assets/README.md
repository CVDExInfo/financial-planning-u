# Assets Directory

This directory contains all application assets organized by type:

- `images/` - Logo, icons, screenshots, diagrams
- `video/` - Demo videos, tutorials, presentations  
- `audio/` - Sound effects, notification sounds
- `documents/` - PDF templates, user guides, specs

## Usage

Always import assets explicitly rather than using string paths:

```typescript
import logo from '@/assets/images/logo.png';
import demoVideo from '@/assets/video/demo.mp4';

// Use in JSX
<img src={logo} alt="Company Logo" />
<video src={demoVideo} controls />
```

## Guidelines

- Use WebP format for images when possible for better compression
- Optimize all assets for web delivery
- Include alt text and descriptions for accessibility
- Keep file names descriptive and kebab-case