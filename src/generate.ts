/**
 * Generate OpenSCAD code from feature spec using LM Studio LLM
 */

import type { FeatureSpec, PipelineConfig } from './types.js';

export async function generateOpenSCAD(
  featureSpec: FeatureSpec,
  config: PipelineConfig
): Promise<string> {
  const apiKey = process.env.LM_API_KEY;
  if (!apiKey) {
    throw new Error('LM_API_KEY environment variable not set');
  }

  // Build prompt for LLM
  const prompt = buildOpenSCADPrompt(featureSpec);

  console.log(`   Calling LM Studio at ${config.lmStudioEndpoint}...`);

  // Call LM Studio API (OpenAI-compatible)
  const response = await fetch(`${config.lmStudioEndpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.lmStudioModel,
      messages: [
        {
          role: 'system',
          content: 'You are an expert CAD engineer. Generate clean, well-structured OpenSCAD code based on dimensional specifications. Use only basic primitives (cube, cylinder, sphere) and CSG operations (union, difference, intersection). Include comments explaining the design intent.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: config.llmTemperature,
      max_tokens: config.llmMaxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LM Studio API error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json() as {
    choices?: Array<{
      message: {
        content: string;
      };
    }>;
  };
  
  if (!data.choices || data.choices.length === 0) {
    throw new Error('LM Studio returned no choices');
  }

  let openscadCode = data.choices[0].message.content;

  // Extract code from markdown code blocks if present
  const codeBlockMatch = openscadCode.match(/```(?:openscad)?\n([\s\S]*?)\n```/);
  if (codeBlockMatch) {
    openscadCode = codeBlockMatch[1];
  }

  // Validate basic syntax
  if (!openscadCode.includes('cube') && !openscadCode.includes('cylinder') && !openscadCode.includes('sphere')) {
    console.warn('   ⚠️  Generated code may not contain valid primitives');
  }

  return openscadCode.trim();
}

function buildOpenSCADPrompt(featureSpec: FeatureSpec): string {
  const { dimensions, features, boundingBox } = featureSpec;

  let prompt = `Generate OpenSCAD code for a mechanical part with the following specifications:

**Overall Dimensions:**
- Length: ${dimensions.length.toFixed(2)} mm
- Width: ${dimensions.width.toFixed(2)} mm
- Height: ${dimensions.height.toFixed(2)} mm

**Bounding Box:**
- Min: (${boundingBox.min.x.toFixed(2)}, ${boundingBox.min.y.toFixed(2)}, ${boundingBox.min.z.toFixed(2)})
- Max: (${boundingBox.max.x.toFixed(2)}, ${boundingBox.max.y.toFixed(2)}, ${boundingBox.max.z.toFixed(2)})

**Detected Features:**
`;

  if (features.length === 0) {
    prompt += `- No distinct features detected. Model as a simple box with the above dimensions.\n`;
  } else {
    for (const feature of features) {
      if (feature.type === 'plane') {
        prompt += `- Plane: normal (${feature.normal.x.toFixed(2)}, ${feature.normal.y.toFixed(2)}, ${feature.normal.z.toFixed(2)}), ${feature.inliers} inliers\n`;
      } else if (feature.type === 'cylinder') {
        prompt += `- Cylinder: radius ${feature.radius.toFixed(2)} mm, axis (${feature.axis.x.toFixed(2)}, ${feature.axis.y.toFixed(2)}, ${feature.axis.z.toFixed(2)}), center (${feature.center.x.toFixed(2)}, ${feature.center.y.toFixed(2)}, ${feature.center.z.toFixed(2)}), ${feature.inliers} inliers\n`;
      } else if (feature.type === 'hole') {
        prompt += `- Hole: radius ${feature.radius.toFixed(2)} mm, depth ${feature.depth.toFixed(2)} mm, center (${feature.center.x.toFixed(2)}, ${feature.center.y.toFixed(2)}, ${feature.center.z.toFixed(2)})\n`;
      }
    }
  }

  prompt += `
**Requirements:**
1. Use SI units (millimeters)
2. Center the part at the origin
3. Use descriptive variable names
4. Add comments to explain the geometry
5. Use CSG operations (difference, union, intersection) to create the final part
6. For cylinders with detected axes, orient them correctly
7. If multiple planes are detected, they likely represent a box-like base
8. Generate ONLY the OpenSCAD code, no explanations

Output the complete OpenSCAD code that can be compiled to STEP format.`;

  return prompt;
}
