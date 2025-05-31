import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    let text = ""

    if (file.type === "text/plain") {
      text = await file.text()
    } else if (file.type === "application/pdf") {
      // For PDF files, we'll use a simple approach
      // In a real implementation, you'd use a PDF parsing library
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      // Simple text extraction - this is a basic implementation
      // For production, you'd want to use a proper PDF parser
      const decoder = new TextDecoder("utf-8")
      const rawText = decoder.decode(uint8Array)

      // Extract readable text (this is very basic)
      text = rawText
        .replace(/[^\x20-\x7E\n]/g, " ")
        .replace(/\s+/g, " ")
        .trim()

      // If no readable text found, return an error
      if (text.length < 50) {
        return NextResponse.json(
          { error: "Could not extract readable text from PDF. Please try a text-based PDF or convert to .txt format." },
          { status: 400 },
        )
      }
    } else {
      return NextResponse.json({ error: "Unsupported file type. Please upload a PDF or text file." }, { status: 400 })
    }

    // Clean up the text
    text = text.replace(/\s+/g, " ").trim()

    if (text.length < 10) {
      return NextResponse.json({ error: "File appears to be empty or contains no readable text" }, { status: 400 })
    }

    return NextResponse.json({ text })
  } catch (error) {
    console.error("Error extracting text:", error)
    return NextResponse.json({ error: "Failed to process file" }, { status: 500 })
  }
}
