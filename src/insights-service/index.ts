import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { Env } from './raindrop.gen.js';

/**
 * Insights Service
 * 
 * Handles analytics, pattern detection, and proactive check-ins
 * 
 * Routes:
 * - GET /api/patterns/orphans - Find high-priority items with no connections
 * - GET /api/patterns/hubs - Find highly connected nodes
 * - POST /api/checkins/schedule - Schedule proactive check-ins
 * - GET /api/checkins/trigger - Generate proactive check-in message
 * - GET /api/checkins/status - Get check-in configuration status
 * - GET /api/insights/momentum - Track activity momentum
 * - GET /api/insights/abandoned - Detect abandoned goals
 * - GET /api/insights/consistency - Analyze habit consistency
 */

const app = new Hono<{ Bindings: Env }>();

// Pattern detection: find orphaned nodes (high-weight but no connections)
app.get('/api/patterns/orphans', async (c) => {
  try {
    const searchResult = await c.env.AGENT_MEMORY.searchSemanticMemory('all memories');
    const results = searchResult.documentSearchResponse?.results || [];
    
    const allNodes = new Map<string, any>();
    const connectedNodes = new Set<string>();
    
    // Collect all nodes and track which ones have connections
    results.forEach((result: any) => {
      try {
        const doc = JSON.parse(result.text || '{}');
        const entities = doc.extracted?.entities || [];
        const relationships = doc.extracted?.relationships || [];
        
        // Track all entities
        entities.forEach((e: any) => {
          const key = e.content.toLowerCase();
          if (!allNodes.has(key)) {
            allNodes.set(key, {
              id: e.content,
              type: e.type,
              weight: e.weight || 0.5,
              lastMention: doc.created_at
            });
          }
        });
        
        // Track connected entities
        relationships.forEach((rel: any) => {
          connectedNodes.add(rel.source.toLowerCase());
          connectedNodes.add(rel.target.toLowerCase());
        });
      } catch (e) {
        // Skip malformed results
      }
    });
    
    // Find orphans: nodes with high weight but no connections
    const orphans = Array.from(allNodes.entries())
      .filter(([key, node]) => !connectedNodes.has(key) && node.weight > 0.6)
      .map(([_, node]) => node)
      .sort((a, b) => b.weight - a.weight);
    
    return c.json({
      success: true,
      orphans,
      count: orphans.length,
      insight: orphans.length > 0 
        ? `Found ${orphans.length} high-priority items that aren't connected to any actions or goals`
        : 'All your important thoughts are well connected!'
    });
  } catch (error) {
    return c.json({ 
      error: 'Orphan detection failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Pattern detection: find hub nodes (highly connected)
app.get('/api/patterns/hubs', async (c) => {
  try {
    const searchResult = await c.env.AGENT_MEMORY.searchSemanticMemory('all memories');
    const results = searchResult.documentSearchResponse?.results || [];
    
    const connectionCount = new Map<string, number>();
    const nodeDetails = new Map<string, any>();
    
    // Count connections for each node
    results.forEach((result: any) => {
      try {
        const doc = JSON.parse(result.text || '{}');
        const entities = doc.extracted?.entities || [];
        const relationships = doc.extracted?.relationships || [];
        
        // Store node details
        entities.forEach((e: any) => {
          const key = e.content.toLowerCase();
          if (!nodeDetails.has(key)) {
            nodeDetails.set(key, {
              id: e.content,
              type: e.type
            });
          }
        });
        
        // Count connections
        relationships.forEach((rel: any) => {
          const sourceKey = rel.source.toLowerCase();
          const targetKey = rel.target.toLowerCase();
          
          connectionCount.set(sourceKey, (connectionCount.get(sourceKey) || 0) + 1);
          connectionCount.set(targetKey, (connectionCount.get(targetKey) || 0) + 1);
        });
      } catch (e) {
        // Skip malformed results
      }
    });
    
    // Find hubs: nodes with 3+ connections
    const hubs = Array.from(connectionCount.entries())
      .filter(([_, count]) => count >= 3)
      .map(([key, count]) => ({
        node: nodeDetails.get(key)?.id || key,
        type: nodeDetails.get(key)?.type || 'unknown',
        connections: count,
        centrality: count / Math.max(...Array.from(connectionCount.values()))
      }))
      .sort((a, b) => b.connections - a.connections);
    
    return c.json({
      success: true,
      hubs,
      count: hubs.length,
      insight: hubs.length > 0 && hubs[0]
        ? `${hubs[0].node} is your most central theme with ${hubs[0].connections} connections`
        : 'Build more connections to discover your central themes'
    });
  } catch (error) {
    return c.json({ 
      error: 'Hub detection failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Proactive check-ins system
app.post('/api/checkins/schedule', async (c) => {
  try {
    const { user_id, frequency, preferences } = await c.req.json();
    
    if (!user_id) {
      return c.json({ error: 'user_id is required' }, 400);
    }
    
    const checkinConfig = {
      user_id,
      frequency: frequency || 'weekly', // daily, weekly, monthly
      preferences: preferences || {
        time_of_day: '18:00',
        topics: ['goals', 'habits', 'mood'],
        style: 'encouraging'
      },
      next_checkin: calculateNextCheckin(frequency || 'weekly'),
      active: true,
      created_at: new Date().toISOString()
    };
    
    // Store checkin configuration
    const configKey = `checkin_config_${user_id}`;
    await c.env.AGENT_MEMORY.putSemanticMemory({
      text: JSON.stringify(checkinConfig),
      metadata: { type: 'checkin_config', user_id }
    });
    
    return c.json({
      success: true,
      checkin_config: checkinConfig,
      message: 'Proactive check-ins scheduled successfully'
    });
  } catch (error) {
    return c.json({
      error: 'Failed to schedule check-ins',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.get('/api/checkins/trigger', async (c) => {
  try {
    const userId = c.req.query('user_id') || 'demo_user';
    
    // Generate a proactive check-in message
    const checkinMessage = await generateCheckinMessage(c.env, userId);
    
    return c.json({
      success: true,
      checkin: checkinMessage,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      error: 'Failed to generate check-in',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.get('/api/checkins/status', async (c) => {
  try {
    const userId = c.req.query('user_id');
    
    if (!userId) {
      return c.json({ error: 'user_id is required' }, 400);
    }
    
    // Get checkin configuration
    const configKey = `checkin_config_${userId}`;
    let config = null;
    
    try {
      const searchResult = await c.env.AGENT_MEMORY.searchSemanticMemory(`checkin_config ${userId}`);
      const configData = searchResult.documentSearchResponse?.results?.[0]?.text;
      if (configData) {
        config = JSON.parse(configData);
      }
    } catch (e) {}
    
    const isOverdue = config && new Date() > new Date(config.next_checkin);
    
    return c.json({
      success: true,
      has_checkin_config: !!config,
      config: config,
      is_overdue: isOverdue,
      user_id: userId
    });
  } catch (error) {
    return c.json({
      error: 'Failed to get check-in status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Temporal Analysis: Momentum tracking
app.get('/api/insights/momentum', async (c) => {
  try {
    const searchResult = await c.env.AGENT_MEMORY.searchSemanticMemory('all memories');
    const results = searchResult.documentSearchResponse?.results || [];
    
    const momentumAnalysis = analyzeMomentum(results);
    
    return c.json({
      success: true,
      momentum: momentumAnalysis,
      insights: generateMomentumInsights(momentumAnalysis),
      analyzed_at: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      error: 'Momentum analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Temporal Analysis: Abandoned goals detection
app.get('/api/insights/abandoned', async (c) => {
  try {
    const searchResult = await c.env.AGENT_MEMORY.searchSemanticMemory('goals projects habits');
    const results = searchResult.documentSearchResponse?.results || [];
    
    const abandonedItems = detectAbandonedGoals(results);
    
    return c.json({
      success: true,
      abandoned_goals: abandonedItems,
      insights: generateAbandonedGoalsInsights(abandonedItems),
      analyzed_at: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      error: 'Abandoned goals analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Temporal Analysis: Consistency checking
app.get('/api/insights/consistency', async (c) => {
  try {
    const searchResult = await c.env.AGENT_MEMORY.searchSemanticMemory('all memories');
    const results = searchResult.documentSearchResponse?.results || [];
    
    const consistencyReport = analyzeConsistency(results);
    
    return c.json({
      success: true,
      consistency: consistencyReport,
      insights: generateConsistencyInsights(consistencyReport),
      analyzed_at: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      error: 'Consistency analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Health check
app.get('/health', (c) => {
  return c.json({ 
    service: 'insights-service',
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
});

// Helper Functions
function analyzeMomentum(results: any[]): any {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const momentum = {
    weekly: { entries: 0, topics: new Set(), trend: 'stable' },
    monthly: { entries: 0, topics: new Set(), trend: 'stable' },
    active_goals: [],
    recurring_themes: []
  };
  
  results.forEach(result => {
    try {
      const doc = JSON.parse(result.text || '{}');
      const entryDate = new Date(doc.created_at || result.createdAt || now);
      
      if (entryDate >= oneWeekAgo) {
        momentum.weekly.entries++;
        doc.entities?.forEach((entity: any) => {
          momentum.weekly.topics.add(entity.type + ':' + entity.content);
        });
      }
      
      if (entryDate >= oneMonthAgo) {
        momentum.monthly.entries++;
        doc.entities?.forEach((entity: any) => {
          momentum.monthly.topics.add(entity.type + ':' + entity.content);
        });
      }
      
      doc.entities?.filter((e: any) => e.type === 'goal').forEach((goal: any) => {
        const existing = momentum.active_goals.find((g: any) => g.name === goal.content);
        if (existing) {
          existing.mentions++;
          existing.last_mentioned = entryDate;
        } else {
          momentum.active_goals.push({
            name: goal.content,
            mentions: 1,
            first_mentioned: entryDate,
            last_mentioned: entryDate
          });
        }
      });
    } catch (e) {}
  });
  
  momentum.weekly.trend = momentum.weekly.entries >= 3 ? 'increasing' : momentum.weekly.entries >= 1 ? 'stable' : 'decreasing';
  momentum.monthly.trend = momentum.monthly.entries >= 8 ? 'increasing' : momentum.monthly.entries >= 4 ? 'stable' : 'decreasing';
  
  return momentum;
}

function detectAbandonedGoals(results: any[]): any[] {
  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  
  const goals = new Map();
  
  results.forEach(result => {
    try {
      const doc = JSON.parse(result.text || '{}');
      const entryDate = new Date(doc.created_at || result.createdAt || now);
      
      doc.entities?.filter((e: any) => e.type === 'goal').forEach((goal: any) => {
        const key = goal.content.toLowerCase();
        if (!goals.has(key)) {
          goals.set(key, {
            name: goal.content,
            first_mentioned: entryDate,
            last_mentioned: entryDate,
            mentions: 1,
            weight: goal.weight || 0.5
          });
        } else {
          const existing = goals.get(key);
          existing.mentions++;
          if (entryDate > existing.last_mentioned) {
            existing.last_mentioned = entryDate;
          }
        }
      });
    } catch (e) {}
  });
  
  const abandoned = Array.from(goals.values())
    .filter((goal: any) => 
      goal.weight > 0.6 && 
      goal.last_mentioned < twoWeeksAgo &&
      goal.mentions >= 2
    )
    .sort((a, b) => b.weight - a.weight);
  
  return abandoned;
}

function analyzeConsistency(results: any[]): any {
  const consistency = {
    habit_consistency: {} as Record<string, any>,
    goal_progress: {} as Record<string, any>,
    overall_score: 0
  };
  
  const habits = new Map();
  const goals = new Map();
  
  results.forEach(result => {
    try {
      const doc = JSON.parse(result.text || '{}');
      const entryDate = new Date(doc.created_at || result.createdAt || new Date());
      
      doc.entities?.filter((e: any) => e.type === 'habit').forEach((habit: any) => {
        const key = habit.content.toLowerCase();
        if (!habits.has(key)) {
          habits.set(key, {
            name: habit.content,
            mentions: [entryDate],
            consistency_score: 0
          });
        } else {
          habits.get(key).mentions.push(entryDate);
        }
      });
      
      doc.entities?.filter((e: any) => e.type === 'goal').forEach((goal: any) => {
        const key = goal.content.toLowerCase();
        if (!goals.has(key)) {
          goals.set(key, {
            name: goal.content,
            mentions: [entryDate],
            progress_score: 0
          });
        } else {
          goals.get(key).mentions.push(entryDate);
        }
      });
    } catch (e) {}
  });
  
  habits.forEach((habit, key) => {
    const mentions = habit.mentions.sort((a: Date, b: Date) => a.getTime() - b.getTime());
    let gaps = [];
    for (let i = 1; i < mentions.length; i++) {
      const gap = (mentions[i].getTime() - mentions[i-1].getTime()) / (1000 * 60 * 60 * 24);
      gaps.push(gap);
    }
    
    const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b) / gaps.length : 0;
    const consistencyScore = Math.max(0, 1 - (avgGap / 7));
    
    consistency.habit_consistency[habit.name] = {
      mentions: mentions.length,
      average_gap_days: avgGap,
      consistency_score: consistencyScore
    };
  });
  
  return consistency;
}

function generateMomentumInsights(momentum: any): string[] {
  const insights = [];
  
  if (momentum.weekly.trend === 'increasing') {
    insights.push('📈 Your activity has increased this week - great momentum!');
  } else if (momentum.weekly.trend === 'decreasing') {
    insights.push('📉 Activity has slowed down this week. Consider refocusing on your goals.');
  }
  
  if (momentum.active_goals.length > 3) {
    insights.push('🎯 You have many active goals. Consider prioritizing the top 3 for better focus.');
  }
  
  const highMentionGoals = momentum.active_goals.filter((g: any) => g.mentions >= 3);
  if (highMentionGoals.length > 0) {
    insights.push(`💪 Strong focus on: ${highMentionGoals.map((g: any) => g.name).join(', ')}`);
  }
  
  return insights;
}

function generateAbandonedGoalsInsights(abandoned: any[]): string[] {
  const insights = [];
  
  if (abandoned.length === 0) {
    insights.push('✅ No abandoned goals detected - great consistency!');
  } else {
    insights.push(`⚠️ Found ${abandoned.length} potentially abandoned goal(s)`);
    abandoned.slice(0, 3).forEach((goal: any) => {
      const daysSince = Math.floor((new Date().getTime() - goal.last_mentioned.getTime()) / (1000 * 60 * 60 * 24));
      insights.push(`• "${goal.name}" - last mentioned ${daysSince} days ago`);
    });
  }
  
  return insights;
}

function generateConsistencyInsights(consistency: any): string[] {
  const insights = [];
  
  const habitNames = Object.keys(consistency.habit_consistency);
  if (habitNames.length === 0) {
    insights.push('📝 No habits tracked yet. Consider setting up habit tracking.');
    return insights;
  }
  
  const consistentHabits = habitNames.filter(name => 
    consistency.habit_consistency[name].consistency_score > 0.7
  );
  
  if (consistentHabits.length > 0) {
    insights.push(`🔥 Strong consistency in: ${consistentHabits.join(', ')}`);
  }
  
  const inconsistentHabits = habitNames.filter(name => 
    consistency.habit_consistency[name].consistency_score < 0.3
  );
  
  if (inconsistentHabits.length > 0) {
    insights.push(`⚡ Need more consistency: ${inconsistentHabits.join(', ')}`);
  }
  
  return insights;
}

function calculateNextCheckin(frequency: string): string {
  const now = new Date();
  
  switch (frequency) {
    case 'daily':
      now.setDate(now.getDate() + 1);
      break;
    case 'weekly':
      now.setDate(now.getDate() + 7);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      break;
    default:
      now.setDate(now.getDate() + 7);
  }
  
  return now.toISOString();
}

async function generateCheckinMessage(env: any, userId: string): Promise<any> {
  try {
    const searchResult = await env.AGENT_MEMORY.searchSemanticMemory('recent activities goals');
    const results = searchResult.documentSearchResponse?.results || [];
    
    const momentum = analyzeMomentum(results);
    const abandoned = detectAbandonedGoals(results);
    
    let message = 'Hello! Time for your regular check-in. ';
    
    if (momentum.weekly.trend === 'increasing') {
      message += 'I noticed you\'ve been quite active this week - that\'s fantastic! ';
    } else if (momentum.weekly.trend === 'decreasing') {
      message += 'It looks like things have been quieter lately. That\'s totally normal. ';
    }
    
    if (abandoned.length > 0) {
      message += `I wanted to check in about "${abandoned[0].name}" - I haven\'t heard about it recently. `;
    }
    
    if (momentum.active_goals.length > 0) {
      const topGoal = momentum.active_goals.sort((a: any, b: any) => b.mentions - a.mentions)[0];
      message += `How are you feeling about your progress on "${topGoal.name}"? `;
    }
    
    message += 'What\'s one thing you\'re excited about right now?';
    
    return {
      message,
      type: 'proactive_checkin',
      context: {
        momentum_trend: momentum.weekly.trend,
        active_goals_count: momentum.active_goals.length,
        abandoned_goals_count: abandoned.length,
        recent_activity: momentum.weekly.entries
      },
      suggestions: generateCheckinSuggestions(momentum, abandoned)
    };
  } catch (error) {
    return {
      message: 'Hello! How are you doing today? I\'d love to hear about what you\'re working on.',
      type: 'generic_checkin',
      context: {},
      suggestions: [
        'Tell me about your current goals',
        'What challenges are you facing?',
        'Share something positive from your day'
      ]
    };
  }
}

function generateCheckinSuggestions(momentum: any, abandoned: any[]): string[] {
  const suggestions = [];
  
  if (momentum.active_goals.length > 0) {
    const topGoal = momentum.active_goals.sort((a: any, b: any) => b.mentions - a.mentions)[0];
    suggestions.push(`Update me on "${topGoal.name}"`);
  }
  
  if (abandoned.length > 0) {
    suggestions.push(`I want to revisit "${abandoned[0].name}"`);
  }
  
  if (momentum.weekly.trend === 'decreasing') {
    suggestions.push('I need help getting back on track');
    suggestions.push('Let me share what\'s been challenging');
  } else {
    suggestions.push('I want to celebrate a recent win');
    suggestions.push('I have a new goal to work on');
  }
  
  suggestions.push('Ask me about my mood today');
  
  return suggestions.slice(0, 4);
}

export default class InsightsService extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
