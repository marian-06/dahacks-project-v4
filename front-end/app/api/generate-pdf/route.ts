import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { summary, flashcards, title } = await request.json()

    // Create a simple HTML template for the PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Study Guide</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              margin: 40px;
              color: #333;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #333;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .title {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .subtitle {
              font-size: 16px;
              color: #666;
            }
            .section {
              margin-bottom: 30px;
            }
            .section-title {
              font-size: 20px;
              font-weight: bold;
              margin-bottom: 15px;
              color: #2563eb;
            }
            .flashcard {
              border: 1px solid #ddd;
              border-radius: 8px;
              padding: 15px;
              margin-bottom: 15px;
              background-color: #f9f9f9;
            }
            .question {
              font-weight: bold;
              margin-bottom: 8px;
              color: #1f2937;
            }
            .answer {
              color: #4b5563;
            }
            .summary-text {
              text-align: justify;
              line-height: 1.8;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Study Guide</div>
            <div class="subtitle">Generated from: ${title}</div>
          </div>
          
          <div class="section">
            <div class="section-title">📝 Summary</div>
            <div class="summary-text">${summary}</div>
          </div>
          
          <div class="section">
            <div class="section-title">🎯 Flashcards</div>
            ${flashcards
              .map(
                (card: any, index: number) => `
              <div class="flashcard">
                <div class="question">Q${index + 1}: ${card.question}</div>
                <div class="answer">A: ${card.answer}</div>
              </div>
            `,
              )
              .join("")}
          </div>
        </body>
      </html>
    `

    // Convert HTML to PDF using browser APIs
    // This is a simplified approach - in production you'd use a proper PDF library
    const blob = new Blob([htmlContent], { type: "text/html" })

    // For this MVP, we'll return the HTML as a downloadable file
    // In a real implementation, you'd use a PDF generation library
    const pdfBlob = new Blob([htmlContent], { type: "application/pdf" })

    return new NextResponse(pdfBlob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="study-guide.pdf"',
      },
    })
  } catch (error) {
    console.error("Error generating PDF:", error)
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 })
  }
}
