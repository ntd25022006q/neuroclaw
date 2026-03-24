'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Send, 
  Bot, 
  User, 
  Settings, 
  Shield, 
  Zap, 
  Globe, 
  Terminal,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Wrench,
  Cpu,
  MessageSquare
} from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: {
    toolCallsExecuted?: number
    iterations?: number
    duration?: number
    errors?: string[]
  }
}

interface ProviderStatus {
  ollama: { available: boolean; free: boolean; local: boolean; description: string }
  huggingface: { available: boolean; free: boolean; local: boolean; description: string }
  openai: { available: boolean; free: boolean; local: boolean; requiresApiKey?: boolean; description: string }
  anthropic: { available: boolean; free: boolean; local: boolean; requiresApiKey?: boolean; description: string }
}

interface Tool {
  id: string
  name: string
  description: string
  category: string
  enabled: boolean
  permissions: {
    level: string
    requiresConfirmation: boolean
    riskLevel: string
  }
}

export default function NeuroClawDashboard() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null)
  const [tools, setTools] = useState<Tool[]>([])
  const [selectedProvider, setSelectedProvider] = useState('ollama')
  const [selectedModel, setSelectedModel] = useState('llama3.2:latest')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch provider status on mount
  useEffect(() => {
    fetchProviderStatus()
    fetchTools()
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchProviderStatus = async () => {
    try {
      const response = await fetch('/api/neuroclaw/providers?action=status')
      const data = await response.json()
      if (data.success) {
        setProviderStatus(data.providers)
      }
    } catch (error) {
      console.error('Failed to fetch provider status:', error)
    }
  }

  const fetchTools = async () => {
    try {
      const response = await fetch('/api/neuroclaw/tools')
      const data = await response.json()
      if (data.success) {
        setTools(data.tools)
      }
    } catch (error) {
      console.error('Failed to fetch tools:', error)
    }
  }

  const createSession = async () => {
    try {
      const response = await fetch('/api/neuroclaw/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'user-' + Date.now(),
          llmConfig: {
            provider: selectedProvider,
            model: selectedModel
          }
        })
      })
      const data = await response.json()
      if (data.success) {
        setSessionId(data.session.id)
        addSystemMessage('Session created. Ready to chat!')
      }
    } catch (error) {
      console.error('Failed to create session:', error)
      addSystemMessage('Failed to create session. Please try again.')
    }
  }

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    if (!sessionId) {
      await createSession()
      // Wait a bit for session to be ready
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/neuroclaw/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId || 'temp',
          message: inputMessage
        })
      })

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'Sorry, I could not process your request.',
        timestamp: new Date(),
        metadata: data.metadata
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Failed to send message:', error)
      addSystemMessage('Failed to get response. Please check if Ollama is running.')
    } finally {
      setIsLoading(false)
    }
  }

  const addSystemMessage = (content: string) => {
    const systemMessage: Message = {
      id: Date.now().toString(),
      role: 'system',
      content,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, systemMessage])
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const getRiskBadgeColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'bg-green-500/20 text-green-700 dark:text-green-400'
      case 'medium': return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
      case 'high': return 'bg-orange-500/20 text-orange-700 dark:text-orange-400'
      case 'critical': return 'bg-red-500/20 text-red-700 dark:text-red-400'
      default: return 'bg-gray-500/20 text-gray-700 dark:text-gray-400'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  NeuroClaw
                </h1>
                <p className="text-xs text-slate-400">Multi-Agent AI Framework</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {providerStatus && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={
                    providerStatus.ollama.available 
                      ? 'border-green-500 text-green-400' 
                      : 'border-red-500 text-red-400'
                  }>
                    <Cpu className="w-3 h-3 mr-1" />
                    Ollama: {providerStatus.ollama.available ? 'Online' : 'Offline'}
                  </Badge>
                </div>
              )}
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50">
                <Shield className="w-3 h-3 mr-1" />
                Security-First
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="chat" className="space-y-4">
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="chat" className="data-[state=active]:bg-slate-700">
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="tools" className="data-[state=active]:bg-slate-700">
              <Wrench className="w-4 h-4 mr-2" />
              Tools
            </TabsTrigger>
            <TabsTrigger value="providers" className="data-[state=active]:bg-slate-700">
              <Cpu className="w-4 h-4 mr-2" />
              Providers
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-slate-700">
              <Shield className="w-4 h-4 mr-2" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* Chat Tab */}
          <TabsContent value="chat" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Chat Area */}
              <div className="lg:col-span-3">
                <Card className="bg-slate-800/50 border-slate-700 h-[600px] flex flex-col">
                  <CardHeader className="border-b border-slate-700 py-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Chat with NeuroClaw</CardTitle>
                      <div className="flex items-center gap-2">
                        <select 
                          value={selectedProvider}
                          onChange={(e) => setSelectedProvider(e.target.value)}
                          className="bg-slate-700 border-slate-600 rounded px-2 py-1 text-sm"
                        >
                          <option value="ollama">Ollama (Local)</option>
                          <option value="huggingface">HuggingFace (Free)</option>
                        </select>
                        <Input
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          placeholder="Model name"
                          className="w-40 h-8 bg-slate-700 border-slate-600"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {messages.length === 0 && (
                        <div className="text-center text-slate-400 py-8">
                          <Bot className="w-16 h-16 mx-auto mb-4 opacity-50" />
                          <p className="text-lg mb-2">Welcome to NeuroClaw!</p>
                          <p className="text-sm">Start a conversation to begin. Make sure Ollama is running for local inference.</p>
                        </div>
                      )}
                      
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex gap-3 ${
                            message.role === 'user' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {message.role === 'assistant' && (
                            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Bot className="w-4 h-4" />
                            </div>
                          )}
                          
                          <div
                            className={`max-w-[80%] rounded-xl px-4 py-3 ${
                              message.role === 'user'
                                ? 'bg-purple-500/20 border border-purple-500/30'
                                : message.role === 'system'
                                ? 'bg-slate-700/50 border border-slate-600'
                                : 'bg-slate-700/50 border border-slate-600'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            {message.metadata && (
                              <div className="mt-2 pt-2 border-t border-slate-600 flex gap-4 text-xs text-slate-400">
                                <span>Tools: {message.metadata.toolCallsExecuted}</span>
                                <span>Iterations: {message.metadata.iterations}</span>
                                <span>Duration: {message.metadata.duration}ms</span>
                              </div>
                            )}
                          </div>
                          
                          {message.role === 'user' && (
                            <div className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {isLoading && (
                        <div className="flex gap-3 justify-start">
                          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin" />
                          </div>
                          <div className="bg-slate-700/50 rounded-xl px-4 py-3">
                            <p className="text-sm text-slate-400">Thinking...</p>
                          </div>
                        </div>
                      )}
                      
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                  
                  <div className="p-4 border-t border-slate-700">
                    <div className="flex gap-2">
                      <Input
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type your message..."
                        className="bg-slate-700 border-slate-600"
                        disabled={isLoading}
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={isLoading || !inputMessage.trim()}
                        className="bg-purple-500 hover:bg-purple-600"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
              
              {/* Sidebar */}
              <div className="space-y-4">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      Quick Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start bg-slate-700/50 border-slate-600"
                      onClick={() => setInputMessage('Search the web for latest AI news')}
                    >
                      <Globe className="w-4 h-4 mr-2" />
                      Web Search
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start bg-slate-700/50 border-slate-600"
                      onClick={() => setInputMessage('Calculate 15% of 2500')}
                    >
                      <Terminal className="w-4 h-4 mr-2" />
                      Calculator
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start bg-slate-700/50 border-slate-600"
                      onClick={() => setInputMessage('Analyze the sentiment of: "I love this new AI tool, it is amazing!"')}
                    >
                      <Info className="w-4 h-4 mr-2" />
                      Text Analysis
                    </Button>
                  </CardContent>
                </Card>
                
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Session Info</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Session ID:</span>
                        <span className="font-mono text-xs">{sessionId ? sessionId.slice(0, 20) + '...' : 'Not created'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Messages:</span>
                        <span>{messages.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Provider:</span>
                        <span>{selectedProvider}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Tools Tab */}
          <TabsContent value="tools">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="w-5 h-5" />
                  Available Tools
                </CardTitle>
                <CardDescription>
                  Tools the AI agent can use to accomplish tasks. Each tool has different permission levels.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tools.map((tool) => (
                    <Card key={tool.id} className="bg-slate-700/50 border-slate-600">
                      <CardHeader className="py-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{tool.name}</CardTitle>
                          <div className="flex gap-1">
                            <Badge className={getRiskBadgeColor(tool.permissions.riskLevel)}>
                              {tool.permissions.riskLevel}
                            </Badge>
                            {tool.permissions.requiresConfirmation && (
                              <Badge className="bg-yellow-500/20 text-yellow-400">
                                <AlertTriangle className="w-3 h-3" />
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="py-2">
                        <p className="text-xs text-slate-400 mb-2">{tool.description}</p>
                        <div className="flex items-center justify-between text-xs">
                          <Badge variant="outline" className="border-slate-500 text-slate-400">
                            {tool.category}
                          </Badge>
                          <div className="flex items-center gap-1">
                            {tool.enabled ? (
                              <CheckCircle className="w-3 h-3 text-green-400" />
                            ) : (
                              <XCircle className="w-3 h-3 text-red-400" />
                            )}
                            <span className="text-slate-400">
                              {tool.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Providers Tab */}
          <TabsContent value="providers">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="w-5 h-5" />
                  LLM Providers
                </CardTitle>
                <CardDescription>
                  Configure and manage LLM providers. Free providers (Ollama, HuggingFace) require no API key.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {providerStatus && Object.entries(providerStatus).map(([name, info]) => (
                    <Card key={name} className="bg-slate-700/50 border-slate-600">
                      <CardHeader className="py-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm capitalize">{name}</CardTitle>
                          <div className="flex gap-1">
                            {info.free && (
                              <Badge className="bg-green-500/20 text-green-400">Free</Badge>
                            )}
                            {info.local && (
                              <Badge className="bg-blue-500/20 text-blue-400">Local</Badge>
                            )}
                            {info.requiresApiKey && (
                              <Badge className="bg-yellow-500/20 text-yellow-400">API Key</Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="py-2">
                        <p className="text-xs text-slate-400 mb-3">{info.description}</p>
                        <div className="flex items-center gap-2">
                          {info.available ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-400" />
                              <span className="text-sm text-green-400">Available</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-red-400" />
                              <span className="text-sm text-red-400">
                                {info.requiresApiKey ? 'Requires API Key' : 'Not Available'}
                              </span>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                <Separator className="my-6 bg-slate-700" />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Setup Instructions</h3>
                  
                  <Card className="bg-slate-700/50 border-slate-600">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Ollama (Recommended for Free Usage)</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2">
                      <pre className="text-xs bg-slate-900 p-3 rounded overflow-x-auto">
{`# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.2

# Ollama will automatically run on localhost:11434`}
                      </pre>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-slate-700/50 border-slate-600">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">HuggingFace (Free Tier)</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2">
                      <pre className="text-xs bg-slate-900 p-3 rounded overflow-x-auto">
{`# Optional: Get API key for higher rate limits
# Visit: https://huggingface.co/settings/tokens

# Set environment variable
export HUGGINGFACE_API_KEY=your_token_here`}
                      </pre>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security Features
                </CardTitle>
                <CardDescription>
                  NeuroClaw is designed with security-first principles to prevent unauthorized actions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Permission System</h3>
                    <div className="space-y-3">
                      {[
                        { icon: Shield, title: 'Action Confirmation', desc: 'Dangerous actions require explicit user approval before execution' },
                        { icon: AlertTriangle, title: 'Risk Levels', desc: 'Each tool is categorized by risk level (low, medium, high, critical)' },
                        { icon: Settings, title: 'Granular Policies', desc: 'Set custom policies for each tool and action type' },
                        { icon: Terminal, title: 'Audit Logging', desc: 'All actions and permission decisions are logged for review' }
                      ].map((feature, idx) => (
                        <div key={idx} className="flex gap-3">
                          <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                            <feature.icon className="w-5 h-5 text-purple-400" />
                          </div>
                          <div>
                            <h4 className="font-medium text-sm">{feature.title}</h4>
                            <p className="text-xs text-slate-400">{feature.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Key Differences from OpenClaw</h3>
                    <div className="space-y-3">
                      {[
                        { check: true, text: 'No automatic tool installation from external sources' },
                        { check: true, text: 'All dangerous actions require user confirmation by default' },
                        { check: true, text: 'Rate limiting per tool to prevent abuse' },
                        { check: true, text: 'Sandboxed code execution environment' },
                        { check: true, text: 'Clear permission prompts with risk explanations' },
                        { check: true, text: 'Session-based permission scoping' }
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          {item.check ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400" />
                          )}
                          <span className="text-sm">{item.text}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <div className="flex gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                        <div>
                          <h4 className="font-medium text-yellow-400">Security Notice</h4>
                          <p className="text-xs text-slate-300 mt-1">
                            While NeuroClaw implements strong security measures, always review tool permissions 
                            and be cautious with AI agents that have system access. This is a development version 
                            and should be tested thoroughly before production use.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
