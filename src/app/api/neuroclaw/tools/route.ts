/**
 * NeuroClaw Tools API
 * Get available tools and their information
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNeuroClaw } from '@/lib/neuroclaw/manager';
import { TOOL_CATEGORIES, getToolsByCategory, getToolsByRiskLevel } from '@/lib/neuroclaw/tools/registry';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const riskLevel = searchParams.get('riskLevel');
    const toolId = searchParams.get('toolId');

    const neuroClaw = getNeuroClaw();
    
    // Get specific tool
    if (toolId) {
      const tools = neuroClaw.getAvailableTools();
      const tool = tools.find(t => t.id === toolId);
      
      if (!tool) {
        return NextResponse.json(
          { success: false, error: 'Tool not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        tool
      });
    }

    // Get tools by category
    if (category) {
      const tools = getToolsByCategory(category as keyof typeof TOOL_CATEGORIES);
      return NextResponse.json({
        success: true,
        tools,
        category: TOOL_CATEGORIES[category as keyof typeof TOOL_CATEGORIES]
      });
    }

    // Get tools by risk level
    if (riskLevel) {
      const tools = getToolsByRiskLevel(riskLevel as 'low' | 'medium' | 'high' | 'critical');
      return NextResponse.json({
        success: true,
        tools,
        riskLevel
      });
    }

    // Get all tools
    const tools = neuroClaw.getAvailableTools();
    const grouped = {
      byCategory: {} as Record<string, typeof tools>,
      byRiskLevel: {
        low: [] as typeof tools,
        medium: [] as typeof tools,
        high: [] as typeof tools,
        critical: [] as typeof tools
      }
    };

    for (const tool of tools) {
      // Group by category
      if (!grouped.byCategory[tool.category]) {
        grouped.byCategory[tool.category] = [];
      }
      grouped.byCategory[tool.category].push(tool);

      // Group by risk level
      grouped.byRiskLevel[tool.permissions.riskLevel].push(tool);
    }

    return NextResponse.json({
      success: true,
      tools,
      categories: TOOL_CATEGORIES,
      grouped
    });
  } catch (error) {
    console.error('Tools fetch error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get tools' 
      },
      { status: 500 }
    );
  }
}
