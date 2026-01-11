import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { aiAPI } from '../../services/api'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Snackbar from '../ui/Snackbar'
import './AIAssistant.css'

const AIAssistant = ({ deviceId = null, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Ahoj! Jsem MolekulAI asistent. Můžu ti pomoci pochopit jak aplikace funguje a mohu generovat shrnutí nasbíraných dat.',
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
      // Focus input when opened
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, messages])

  const handleSend = async () => {
    const message = inputValue.trim()
    if (!message || isLoading) return

    // Add user message
    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    setError('')

    try {
      const response = await aiAPI.chat(message, deviceId)
      
      if (response.data.status === 'success') {
        const assistantMessage = {
          role: 'assistant',
          content: response.data.response,
          timestamp: new Date(),
          dataUsed: response.data.dataUsed
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        throw new Error(response.data.message || 'Failed to get response')
      }
    } catch (err) {
      console.error('AI chat error:', err)
      const errorMessage = {
        role: 'assistant',
        content: `Omlouvám se, došlo k chybě: ${err.response?.data?.message || err.message || 'Neznámá chyba'}. Zkus to prosím znovu.`,
        timestamp: new Date(),
        isError: true
      }
      setMessages(prev => [...prev, errorMessage])
      setError(err.response?.data?.message || err.message || 'Nepodařilo se odeslat zprávu')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleAssistant = () => {
    setIsOpen(!isOpen)
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        className={`ai-assistant-fab ${isOpen ? 'ai-assistant-fab--active' : ''}`}
        onClick={toggleAssistant}
        aria-label="Otevřít MolekulAI asistenta"
        title="MolekulAI asistent"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H6L4 18V4H20V16Z" fill="currentColor"/>
          <path d="M7 9H17V11H7V9ZM7 12H14V14H7V12Z" fill="currentColor"/>
        </svg>
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className={`ai-assistant-overlay ${className}`} onClick={(e) => {
          if (e.target === e.currentTarget) setIsOpen(false)
        }}>
          <Card variant="elevated" elevation={3} className="ai-assistant-panel">
            <div className="ai-assistant-header">
              <h3>MolekulAI Assistant</h3>
              <Button
                variant="text"
                size="small"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                <X strokeWidth={2} size={20} />
              </Button>
            </div>

            <div className="ai-assistant-messages">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`ai-assistant-message ai-assistant-message--${msg.role} ${msg.isError ? 'ai-assistant-message--error' : ''}`}
                >
                  <div className="ai-assistant-message-content">
                    {msg.content}
                  </div>
                  <div className="ai-assistant-message-time">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="ai-assistant-message ai-assistant-message--assistant">
                  <div className="ai-assistant-message-content ai-assistant-loading">
                    <span className="ai-assistant-typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="ai-assistant-input-container">
              <textarea
                ref={inputRef}
                className="ai-assistant-input"
                placeholder="Ask me anything about your data or application..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                rows={2}
                disabled={isLoading}
              />
              <Button
                variant="filled"
                color="primary"
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                className="ai-assistant-send-button"
              >
                Send
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Error Snackbar */}
      {error && (
        <Snackbar
          message={error}
          type="error"
          onClose={() => setError('')}
          duration={5000}
        />
      )}
    </>
  )
}

export default AIAssistant

