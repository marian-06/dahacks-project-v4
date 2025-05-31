"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Upload, FileText, Download, Loader2, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Pomodoro from "@/components/Pomodoro"

interface ProcessedContent {
  summary: string
  flashcards: Array<{ question: string; answer: string }>
  pdfUrl: string
  audioUrl?: string
}

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ProcessedContent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      const validTypes = ["application/pdf", "text/plain"]
      if (validTypes.includes(selectedFile.type)) {
        setFile(selectedFile)
        setError(null)
      } else {
        setError("Please upload a PDF or text file")
      }
    }
  }

  const generateAudio = async (text: string): Promise<string> => {
    return new Promise((resolve) => {
      // Use Web Speech API for text-to-speech
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.rate = 0.8
        utterance.pitch = 1
        utterance.volume = 1

        // Create a simple audio blob (this is a simplified approach)
        const audioBlob = new Blob([text], { type: "audio/mpeg" })
        const audioUrl = URL.createObjectURL(audioBlob)
        resolve(audioUrl)
      } else {
        // Fallback: create a text file with instructions
        const textBlob = new Blob(
          [`Audio Summary:\n\n${text}\n\nNote: Use your device's text-to-speech feature to listen to this content.`],
          { type: "text/plain" },
        )
        const textUrl = URL.createObjectURL(textBlob)
        resolve(textUrl)
      }
    })
  }

  const processFile = async () => {
    if (!file) return

    setIsProcessing(true)
    setProgress(0)
    setError(null)

    try {
      // Step 1: Upload and extract text
      setProgress(20)
      const formData = new FormData()
      formData.append("file", file)

      const extractResponse = await fetch("/api/extract-text", {
        method: "POST",
        body: formData,
      })

      if (!extractResponse.ok) {
        const errorData = await extractResponse.json()
        throw new Error(errorData.error || "Failed to extract text from file")
      }

      const { text } = await extractResponse.json()

      // Step 2: Generate content with OpenAI
      setProgress(50)
      const generateResponse = await fetch("/api/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json()
        throw new Error(errorData.error || "Failed to generate study materials")
      }

      const { summary, flashcards } = await generateResponse.json()

      // Step 3: Generate PDF
      setProgress(75)
      const pdfResponse = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary, flashcards, title: file.name }),
      })

      if (!pdfResponse.ok) {
        throw new Error("Failed to generate PDF")
      }

      const pdfBlob = await pdfResponse.blob()
      const pdfUrl = URL.createObjectURL(pdfBlob)

      // Step 4: Generate audio
      setProgress(90)
      const audioUrl = await generateAudio(summary)

      setProgress(100)
      setResult({ summary, flashcards, pdfUrl, audioUrl })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsProcessing(false)
    }
  }

  const downloadFile = (url: string, filename: string) => {
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const playAudio = () => {
    if (result?.summary && "speechSynthesis" in window) {
      // Cancel any ongoing speech
      speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(result.summary)
      utterance.rate = 0.8
      utterance.pitch = 1
      utterance.volume = 1
      
      // Add event listeners
      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      
      speechSynthesis.speak(utterance)
    }
  }

  const stopAudio = () => {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel()
      setIsPlaying(false)
    }
  }

  // Cleanup speech synthesis when component unmounts
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        speechSynthesis.cancel()
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Finals Survival Kit Generator</h1>
          <p className="text-lg text-gray-600">
            Transform your notes into flashcards, summaries, and audio study guides
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card className="mb-6 md:mb-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Your Study Materials
              </CardTitle>
              <CardDescription>
                Upload a PDF or text file containing your notes, syllabus, or study materials
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input type="file" accept=".pdf,.txt" onChange={handleFileUpload} className="hidden" id="file-upload" />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
                    <p className="text-xs text-gray-500">PDF or TXT files only</p>
                  </label>
                </div>

                {file && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium">{file.name}</span>
                    <Button onClick={processFile} disabled={isProcessing} className="ml-4">
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Generate Study Kit"
                      )}
                    </Button>
                  </div>
                )}

                {isProcessing && (
                  <div className="space-y-2">
                    <Progress value={progress} className="w-full" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-start">
            <Pomodoro />
          </div>
        </div>

        {result && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Study Kit is Ready!</CardTitle>
                <CardDescription>Download your personalized study materials below</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <Button
                    onClick={() => downloadFile(result.pdfUrl, "study-guide.html")}
                    className="w-full"
                    variant="outline"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Study Guide
                  </Button>
                  <Button 
                    onClick={isPlaying ? stopAudio : playAudio} 
                    className="w-full" 
                    variant="outline"
                  >
                    {isPlaying ? (
                      <>
                        <VolumeX className="w-4 h-4 mr-2" />
                        Stop Audio
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 mr-2" />
                        Play Audio Summary
                      </>
                    )}
                  </Button>
                  {result.audioUrl && (
                    <Button
                      onClick={() => downloadFile(result.audioUrl!, "summary-text.txt")}
                      className="w-full"
                      variant="outline"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Text
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Summary Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 leading-relaxed">{result.summary}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Flashcards Preview</CardTitle>
                <CardDescription>{result.flashcards.length} flashcards generated</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.flashcards.slice(0, 3).map((card, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="font-medium text-gray-900 mb-2">Q: {card.question}</div>
                      <div className="text-gray-700">A: {card.answer}</div>
                    </div>
                  ))}
                  {result.flashcards.length > 3 && (
                    <p className="text-sm text-gray-500 text-center">
                      And {result.flashcards.length - 3} more flashcards in your study guide...
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
