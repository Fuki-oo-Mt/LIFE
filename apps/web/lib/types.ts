// 通信プロトコル v1 の型定義（packages/shared/protocol.md と一致）

export type Emotion =
  | "neutral"
  | "happy"
  | "thinking"
  | "surprised"
  | "apologetic";

// クライアント → サーバ
export interface UserMessage {
  type: "user_message";
  session_id: string;
  text: string;
}

// サーバ → クライアント
export interface AgentThinking {
  type: "agent_thinking";
  text: string;
}
export interface ToolCall {
  type: "tool_call";
  name: string;
  args: Record<string, unknown>;
}
export interface ToolResultMsg {
  type: "tool_result";
  name: string;
  ok: boolean;
  summary: string;
}
export interface AgentToken {
  type: "agent_token";
  text: string;
}
export interface AgentMessage {
  type: "agent_message";
  text: string;
  emotion: Emotion;
}
export interface DoneMsg {
  type: "done";
  session_id: string;
}
export interface ErrorMsg {
  type: "error";
  message: string;
}

export type ServerEvent =
  | AgentThinking
  | ToolCall
  | ToolResultMsg
  | AgentToken
  | AgentMessage
  | DoneMsg
  | ErrorMsg;

// 画面表示用のチャット要素
export type ChatRole = "user" | "luna";

export interface WorkLogEntry {
  kind: "thinking" | "tool_call" | "tool_result";
  text: string;
  ok?: boolean;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  emotion?: Emotion;
  streaming?: boolean;
  workLog?: WorkLogEntry[];
}

export type ConnectionState = "connecting" | "open" | "closed";
