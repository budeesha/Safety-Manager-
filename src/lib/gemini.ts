import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeIncidentImage(imageBase64: string, mimeType: string, plantContext: string = ""): Promise<string> {
  const imagePart = {
    inlineData: {
      mimeType,
      data: imageBase64,
    },
  };
  const textPart = {
    text: `You are an expert industrial safety officer. Analyze this image for safety hazards. 
    Use the following plant-specific knowledge context if relevant:
    ${plantContext}
    
    Identify the primary hazard, the potential risk, and a brief recommended action.`,
  };
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [imagePart, textPart] }
  });
  
  return response.text ?? "";
}

export async function chatAboutIncident(
  chatHistory: { role: 'user'|'model', content: string }[],
  newMessage: string,
  imageBase64: string,
  mimeType: string,
  plantContext: string = ""
): Promise<string> {
  const contents = chatHistory.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.content }]
  }));
  
  // We provide the image as part of the system instruction or initial context if possible,
  // but to be safe, we'll just append it to the current message if the history is small, 
  // or use system instructions. Let's just create a prompt that includes the new message.
  
  const currentMsgParts: any[] = [
    { text: newMessage },
    { inlineData: { mimeType, data: imageBase64 } }
  ];
  
  contents.push({ role: 'user', parts: currentMsgParts });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: contents as any,
    config: {
      systemInstruction: `You are an expert safety officer assistant. Help the user construct a formal, accurate safety incident statement based on the image. 
      Ask clarifying questions if needed. Be concise.
      
      Plant Context:
      ${plantContext}`,
    }
  });

  return response.text ?? "";
}

export async function generateDeepAnalysis(finalStatement: string, imageBase64: string, mimeType: string, plantContext: string = "") {
  const prompt = `Based on the following safety incident statement and the attached image, generate a deep analysis.
  
  Plant Context (Use this for specific equipment naming and protocols):
  ${plantContext}
  
  Incident Statement:
  ${finalStatement}
  
  Provide the response in JSON format.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { 
      parts: [
        { text: prompt },
        { inlineData: { mimeType, data: imageBase64 } }
      ] 
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          fishbone: {
            type: Type.OBJECT,
            description: "Root causes categorized by the 6 Ms.",
            properties: {
              Man: { type: Type.ARRAY, items: { type: Type.STRING } },
              Machine: { type: Type.ARRAY, items: { type: Type.STRING } },
              Material: { type: Type.ARRAY, items: { type: Type.STRING } },
              Method: { type: Type.ARRAY, items: { type: Type.STRING } },
              Measurement: { type: Type.ARRAY, items: { type: Type.STRING } },
              Environment: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["Man", "Machine", "Material", "Method", "Measurement", "Environment"]
          },
          closures: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Specific industry standard safety closures or rules violated."
          },
          documentation: {
            type: Type.STRING,
            description: "A highly formal, industry-standard safety incident report in Markdown."
          }
        },
        required: ["fishbone", "closures", "documentation"]
      }
    }
  });

  return JSON.parse(response.text ?? "{}");
}

export async function refineIncidentSection(
  sectionType: string,
  content: string,
  userInstruction?: string,
  plantContext: string = ""
): Promise<string> {
  const prompt = `You are an expert safety consultant. Refine the following "${sectionType}" of a safety incident report.
  
  Original Content:
  ${content}
  
  User Instruction/Edits:
  ${userInstruction || "Just polish and make it professional while keeping the original meaning."}
  
  Plant Context:
  ${plantContext}
  
  Ensure the tone is professional, technical, and accurate. Do not add made-up facts.
  Output ONLY the refined content.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [{ text: prompt }] },
  });

  return response.text ?? "";
}

export async function updateFishboneViaChat(
  currentFishbone: any,
  userMessage: string,
  plantContext: string = ""
): Promise<any> {
  const prompt = `You are an expert safety analyst. Update the following Fishbone (6Ms) JSON data based on the user's instructions.
  
  Current Fishbone Data:
  ${JSON.stringify(currentFishbone)}
  
  User Message:
  "${userMessage}"
  
  Plant Context:
  ${plantContext}
  
  Return the updated JSON following the same schema.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [{ text: prompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          Man: { type: Type.ARRAY, items: { type: Type.STRING } },
          Machine: { type: Type.ARRAY, items: { type: Type.STRING } },
          Material: { type: Type.ARRAY, items: { type: Type.STRING } },
          Method: { type: Type.ARRAY, items: { type: Type.STRING } },
          Measurement: { type: Type.ARRAY, items: { type: Type.STRING } },
          Environment: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["Man", "Machine", "Material", "Method", "Measurement", "Environment"]
      }
    }
  });

  return JSON.parse(response.text ?? JSON.stringify(currentFishbone));
}

export async function summarizeKnowledgeChat(category: string, chatHistory: { role: 'user' | 'model'; content: string }[]): Promise<string> {
  const prompt = `Based on the following interview regarding a "${category}" entry for an industrial safety knowledge base, summarize all the collected details into a clear, professional technical specification. 
  
  Use professional technical language. Focus on identifying critical equipment, protocols, and failure modes that an AI safety officer should know about.
  
  Interview History:
  ${chatHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
  
  Output ONLY the summarized content. Use Markdown for structure if needed.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [{ text: prompt }] },
  });

  return response.text ?? "";
}
