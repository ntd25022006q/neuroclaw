/**
 * NeuroClaw Chat API
 * Handle chat messages and get AI responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNeuroClaw } from '@/lib/neuroclaw/manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { 
      sessionId,
      message,
      options = {}
    } = body;

    if (!sessionId || !message) {
      return NextResponse.json(
        { success: false, error: 'Session ID and message are required' },
        { status: 400 }
      );
    }

    const neuroClaw = getNeuroClaw();
    
    const result = await neuroClaw.chat(sessionId, message, {
      maxIterations: options.maxIterations,
      onThinking: (thought) => {
        // Could emit to websocket for real-time updates
        console.log('[Thinking]', thought);
      }
    });

    return NextResponse.json({
      success: result.success,
      response: result.response,
      metadata: {
        toolCallsExecuted: result.toolCallsExecuted,
        iterations: result.iterations,
        duration: result.duration,
        errors: result.errors
      }
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process chat' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const neuroClaw = getNeuroClaw();
    const session = neuroClaw.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      messages: session.messages
    });
  } catch (error) {
    console.error('Chat history fetch error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get chat history' 
      },
      { status: 500 }
    );
  }
}
