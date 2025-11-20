/**
 * User Context and Authentication Module
 * Provides user isolation and basic auth for HANSEI
 */

export interface UserContext {
  userId: string;
  sessionId: string;
  workspace?: string;
  createdAt: Date;
}

export interface AuthResult {
  success: boolean;
  userContext?: UserContext;
  error?: string;
}

/**
 * Extract user context from request headers
 * Priority: Authorization header > X-User-ID header > Query param > Default
 */
export function extractUserContext(request: Request): UserContext {
  const url = new URL(request.url);
  
  // Try Authorization header (for future JWT implementation)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    // TODO: Implement JWT validation
    // For now, just extract from header
  }
  
  // Try X-User-ID header
  const userIdHeader = request.headers.get('X-User-ID');
  if (userIdHeader) {
    return {
      userId: userIdHeader,
      sessionId: request.headers.get('X-Session-ID') || generateSessionId(),
      workspace: request.headers.get('X-Workspace'),
      createdAt: new Date()
    };
  }
  
  // Try query parameter (for GET requests)
  const userIdParam = url.searchParams.get('user_id');
  if (userIdParam) {
    return {
      userId: userIdParam,
      sessionId: url.searchParams.get('session_id') || generateSessionId(),
      createdAt: new Date()
    };
  }
  
  // Default to anonymous (for backwards compatibility during migration)
  return {
    userId: 'anonymous',
    sessionId: generateSessionId(),
    createdAt: new Date()
  };
}

/**
 * Validate user context
 */
export function validateUserContext(context: UserContext): AuthResult {
  if (!context.userId || context.userId === '') {
    return {
      success: false,
      error: 'User ID is required'
    };
  }
  
  if (context.userId === 'anonymous') {
    // Warning: anonymous access should be restricted in production
    console.warn('⚠️ Anonymous user access detected. This should be disabled in production.');
  }
  
  return {
    success: true,
    userContext: context
  };
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Middleware factory for Hono
 * Extracts and validates user context on every request
 */
export function createAuthMiddleware() {
  return async (c: any, next: any) => {
    const userContext = extractUserContext(c.req.raw);
    const validation = validateUserContext(userContext);
    
    if (!validation.success) {
      return c.json({ error: validation.error }, 401);
    }
    
    // Attach user context to request
    c.set('userContext', userContext);
    
    // Add helper methods
    c.set('getUserId', () => userContext.userId);
    c.set('getSessionId', () => userContext.sessionId);
    
    await next();
  };
}

/**
 * Build database filter for user isolation
 */
export function buildUserFilter(userContext: UserContext): Record<string, any> {
  return {
    user_id: userContext.userId
  };
}

/**
 * Check if user has access to resource
 */
export function hasAccess(userContext: UserContext, resourceUserId: string): boolean {
  // Users can only access their own resources
  return userContext.userId === resourceUserId;
}
