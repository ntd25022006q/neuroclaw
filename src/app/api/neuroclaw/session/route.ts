/**
 * NeuroClaw Session API
 * Create and manage sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNeuroClaw } from '@/lib/neuroclaw/manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { 
      userId = 'anonymous',
      systemPrompt,
      tools,
      llmConfig 
    } = body;

    const neuroClaw = getNeuroClaw();
    
    const session = await neuroClaw.createSession({
      userId,
      systemPrompt,
      tools,
      llmConfig
    });

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        userId: session.userId,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt
      }
    });
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create session' 
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
      session: {
        id: session.id,
        userId: session.userId,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        expiresAt: session.expiresAt,
        messageCount: session.messages.length
      }
    });
  } catch (error) {
    console.error('Session fetch error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get session' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    neuroClaw.endSession(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Session ended'
    });
  } catch (error) {
    console.error('Session deletion error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to end session' 
      },
      { status: 500 }
    );
  }
}
