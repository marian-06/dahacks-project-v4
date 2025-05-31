import { type NextRequest, NextResponse } from "next/server"
import { openai } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { z } from "zod"

const StudyMaterialSchema = z.object({
  summary: z.string().describe("A concise summary of the study material"),
  flashcards: z
    .array(
      z.object({
        question: z.string().describe("A study question"),
        answer: z.string().describe("The answer to the question"),
      }),
    )
    .describe("Array of flashcard questions and answers"),
})

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text || text.length < 10) {
      return NextResponse.json({ error: "No text provided for processing" }, { status: 400 })
    }

    // Truncate text if too long (to stay within token limits)
    const maxLength = 8000
    const processedText = text.length > maxLength ? text.substring(0, maxLength) + "..." : text

    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: StudyMaterialSchema,
      prompt: `
        You are an expert study guide creator. Based on the following study material, create:
        
        1. A comprehensive but concise summary (2-3 paragraphs) that captures the key concepts and important details
        2. 8-12 flashcards with clear questions and detailed answers that would help a student prepare for an exam
        
        Make sure the flashcards cover the most important concepts, definitions, and facts from the material.
        
        Study Material:
        ${processedText}
      `,
    })

    return NextResponse.json(result.object)
  } catch (error) {
    console.error("Error generating content:", error)
    return NextResponse.json({ error: "Failed to generate study materials. Please try again." }, { status: 500 })
  }
}
