import { type NextRequest, NextResponse } from "next/server"
import { openai } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { z } from "zod"

const FeynmanResponseSchema = z.object({
  feedback: z.string().describe("Feedback on the user's explanation, including corrections and missing concepts."),
  flashcards: z
    .array(
      z.object({
        question: z.string().describe("A study question about a missed or misunderstood concept."),
        answer: z.string().describe("The answer to the question."),
      })
    )
    .describe("Array of flashcards for missed/incorrect material."),
})

export async function POST(request: NextRequest) {
  try {
    const { studyMaterial, explanation } = await request.json()

    if (!studyMaterial || !explanation) {
      return NextResponse.json({ error: "Missing study material or explanation." }, { status: 400 })
    }

    // Truncate to stay within token limits
    const maxLength = 8000
    const processedMaterial = studyMaterial.length > maxLength ? studyMaterial.substring(0, maxLength) + "..." : studyMaterial
    const processedExplanation = explanation.length > maxLength ? explanation.substring(0, maxLength) + "..." : explanation

    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: FeynmanResponseSchema,
      prompt: `
You are an expert tutor. The user is trying to explain the study material below in their own words (Feynman Technique). Your job is to:
- Compare the user's explanation to the study material.
- Identify any concepts, facts, or details the user missed or got wrong.
- Give clear, constructive feedback ("feedback") on what was missing or incorrect, and what was well explained.
- Generate 4-8 flashcards (Q&A) for the concepts the user missed or misunderstood, based on the study material.

STUDY MATERIAL:
${processedMaterial}

USER EXPLANATION:
${processedExplanation}

Respond in this JSON format:
- feedback: string (corrections, missing points, and praise if appropriate)
- flashcards: array of { question, answer } for missed/incorrect concepts only
      `,
    })

    return NextResponse.json(result.object)
  } catch (error) {
    console.error("Error in Feynman endpoint:", error)
    return NextResponse.json({ error: "Failed to process Feynman Technique. Please try again." }, { status: 500 })
  }
} 