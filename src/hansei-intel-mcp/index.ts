import { ActorState } from "@liquidmetal-ai/raindrop-framework";
import { AvailableModel } from "@liquidmetal-ai/raindrop-framework";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Env } from './raindrop.gen.js';

export const implementation = {
  name: "hansei-intel-mcp",
  version: "1.0.0",
}

export default (server: McpServer, env: Env, state: ActorState) => {
  // (Optional) A prompt can be registered later; for now, the tool below handles extraction + storage.

  // Tool: extraction + store to SmartMemory semantic
  server.registerTool(
    "hansei_extract_and_store",
    {
      title: "Extract entities/relationships and store in SmartMemory",
      description: "Runs JSON extraction and persists to AGENT_MEMORY (semantic)",
      inputSchema: {
        user_id: z.string().optional(),
        content: z.string(),
        model: z.string().optional(),
      },
    },
    async (
      { user_id, content, model }: { user_id?: string; content: string; model?: string },
      { sendNotification }
    ) => {
      if (!content) {
        return { content: [{ type: "text", text: "Missing content" }] };
      }

      const systemPrompt =
        "You are HANSEI's entity extraction engine. Analyze user voice notes and extract: ENTITIES: [person, goal, habit, project, emotion, object] RELATIONSHIPS: [CAUSES, DEPENDS_ON, PART_OF, IMPACTS, RELATED_TO] EMOTIONAL_INTENSITY: 1-10 scale PRIORITY_LEVEL: high/medium/low Return ONLY valid JSON: { \"entities\": [{\"type\": \"\", \"content\": \"\", \"weight\": 0.5}], \"relationships\": [{\"source\": \"\", \"target\": \"\", \"type\": \"\"}], \"metadata\": {\"emotional_intensity\": 5, \"priority\": \"medium\"} }";

      await sendNotification({
        method: "notifications/message",
        params: { level: "info", data: "Running SmartInference (Claude) JSON extraction..." },
      });

      const modelName: AvailableModel = (model as AvailableModel) || "llama-3.3-70b";

      const aiRes = await env.AI.run(
        modelName,
        {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 500,
        } as any
      );

      const raw = (aiRes as any).response || (aiRes as any).choices?.[0]?.message?.content || "";
      let extracted: any;
      try {
        extracted = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch (e) {
        const match = String(raw).match(/\{[\s\S]*\}/);
        if (match) extracted = JSON.parse(match[0]);
      }

      if (!extracted || !extracted.entities || !extracted.relationships || !extracted.metadata) {
        return {
          content: [
            {
              type: "text",
              text: "Model did not return valid JSON structure; see raw",
            },
            { type: "text", text: typeof raw === "string" ? raw : JSON.stringify(raw) },
          ],
        };
      }

      const doc = {
        type: "hansei_voice_extraction",
        user_id: user_id || "unknown",
        content,
        extracted,
        created_at: new Date().toISOString(),
      };

      const put = await env.AGENT_MEMORY.putSemanticMemory(doc as any);
      if (!put.success) {
        return { content: [{ type: "text", text: `Failed to store memory: ${put.error || "unknown"}` }] };
      }

      return {
        content: [
          { type: "text", text: JSON.stringify({ success: true, objectId: put.objectId, extracted }, null, 2) },
        ],
      };
    }
  );

  // Simple resource to confirm MCP connectivity
  server.registerResource(
    "hansei-status",
    new ResourceTemplate("hansei-status://{name}", { list: undefined }),
    { title: "HANSEI Status", description: "Confirms MCP server and bindings" },
    async (uri: URL, { name }) => ({
      contents: [{ uri: uri.toString(), text: `ok:${name ?? "default"}` }],
    })
  );
}
