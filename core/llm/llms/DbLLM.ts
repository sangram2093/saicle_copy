import { v4 as uuidv4 } from "uuid";
import https from "https";

import fetch from "node-fetch";
import { RequestRedirect } from "node-fetch";
import {
  AssistantChatMessage,
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  MessagePart,
  TextMessagePart,
  ToolCallDelta,
} from "../../index.js";
import { renderChatMessage, stripImages } from "../../util/messageContent.js";
import { BaseLLM } from "../index.js";
import { streamResponse } from "@dbsaicledev/fetch";
import {
  DbLLMChatContent,
  DbLLMChatContentPart,
  DbLLMChatRequestBody,
  DbLLMChatResponse,
  DbLLMGenerationConfig,
  DbLLMToolFunctionDeclaration,
  convertDbSaicleToolToDbLLMFunction,
} from "./dbllm-types";
import ignore from "ignore";
import { BUFFER_LINES_BELOW } from "../../edit/lazy/replace.js";

class DbLLM extends BaseLLM {
  static providerName = "dbllm";

  static defaultOptions: Partial<LLMOptions> = {
    model: "dbllm",
    //apiBase: "https://api.dev1-ew4.mlcore.dev.gcp.db.com/api/llm/process",
    apiBase: "http://fraitgpucfc1.de.db.com:2999/api/llm/process",
    maxStopWords: 5,
    maxEmbeddingBatchSize: 100,
  };
  constructor(_options: LLMOptions) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Disable SSL verification for local testing
    super(_options);
  }

  // Function to convert completion options to DbLLM format
  public convertArgs(options: CompletionOptions): DbLLMGenerationConfig {
    // should be public for use within VertexAI
    const finalOptions: any = {}; // Initialize an empty object

    // Map known options
    if (options.topK) {
      finalOptions.topK = options.topK;
    }
    if (options.topP) {
      finalOptions.topP = options.topP;
    }
    if (options.temperature !== undefined && options.temperature !== null) {
      finalOptions.temperature = options.temperature;
    }
    if (options.maxTokens) {
      finalOptions.maxOutputTokens = options.maxTokens;
    }
    if (options.stop) {
      finalOptions.stopSequences = options.stop
        .filter((x) => x.trim() !== "")
        .slice(0, this.maxStopWords ?? DbLLM.defaultOptions.maxStopWords);
    }

    return finalOptions;
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    for await (const message of this._streamChat(
      [{ content: prompt, role: "user" }],
      signal,
      options,
    )) {
      yield renderChatMessage(message);
    }
  }

  /**
   * Removes the system message and merges it with the next user message if present.
   * @param messages Array of chat messages
   * @returns Modified array with system message merged into user message if applicable
   */
  public removeSystemMessage(messages: ChatMessage[]): ChatMessage[] {
    // If no messages or first message isn't system, return copy of original messages
    if (messages.length === 0 || messages[0]?.role !== "system") {
      return [...messages];
    }

    // Extract system message
    const systemMessage: ChatMessage = messages[0];

    // Extract system content based on its type
    let systemContent = "";

    if (typeof systemMessage.content === "string") {
      systemContent = systemMessage.content;
    } else if (Array.isArray(systemMessage.content)) {
      const contentArray: Array<MessagePart> =
        systemMessage.content as Array<MessagePart>;

      const concatenatedText = contentArray
        .filter((part): part is TextMessagePart => part.type === "text")
        .map((part) => part.text)
        .join("\n");

      systemContent = concatenatedText ? concatenatedText : "";
    } else if (
      systemMessage.content &&
      typeof systemMessage.content === "object"
    ) {
      const typedContent = systemMessage.content as TextMessagePart;
      systemContent = typedContent?.text || "";
    }

    // Create new array without the system message
    const remainingMessages: ChatMessage[] = messages.slice(1);

    // Check if there's a user message to merge with
    if (remainingMessages.length > 0 && remainingMessages[0].role === "user") {
      const userMessage: ChatMessage = remainingMessages[0];
      const prefix = `System message - follow these instructions in every response: ${systemContent}\n\n---\n\n`;

      // Merge based on user content type
      if (typeof userMessage.content === "string") {
        userMessage.content = prefix + userMessage.content;
      } else if (Array.isArray(userMessage.content)) {
        const contentArray: Array<MessagePart> =
          userMessage.content as Array<MessagePart>;
        const textPart = contentArray.find((part) => part.type === "text") as
          | TextMessagePart
          | undefined;

        if (textPart) {
          textPart.text = prefix + textPart.text;
        } else {
          userMessage.content.push({
            type: "text",
            text: prefix,
          } as TextMessagePart);
        }
      } else if (
        userMessage.content &&
        typeof userMessage.content === "object"
      ) {
        const typedContent = userMessage.content as TextMessagePart;
        userMessage.content = [
          {
            type: "text",
            text: prefix + (typedContent.text || ""),
          } as TextMessagePart,
        ];
      }
    }

    return remainingMessages;
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    // Conditionally apply removeSystemMessage
    //const convertedMsgs = this.removeSystemMessage(messages);
    for await (const message of this.streamChatDbLLM(
      messages,
      signal,
      options,
    )) {
      yield message;
    }

  }

  dbsaiclePartToDbLLMPart(part: MessagePart): DbLLMChatContentPart {
    return part.type === "text"
      ? {
          text: part.text,
        }
      : {
          inlineData: {
            mimeType: "image/jpeg",
            data: part.imageUrl?.url.split(",")[1],
          },
        };
  }

  public prepareBody(
    messages: ChatMessage[],
    options: CompletionOptions
  ): DbLLMChatRequestBody {
    const toolCallIdToNameMap = new Map<string, string>();
    messages.forEach((msg) => {
      if (msg.role === "assistant" && msg.toolCalls) {
        msg.toolCalls.forEach((call) => {
          if (call.id && call.function?.name) {
            toolCallIdToNameMap.set(call.id, call.function.name);
          }
        });
      }
    });
    const systemMessage = messages.find(
      (msg) => msg.role === "system",
    )?.content;

    const body: DbLLMChatRequestBody = {
      contents: messages
        .filter((msg) => !(msg.role === "system"))
        .map((msg) => {
          if (msg.role === "tool") {
            let functionName = toolCallIdToNameMap.get(msg.toolCallId);
            if (!functionName) {
              console.warn(
                "Sending tool call response for unidentified tool call",
              );
            }
            return {
              role: "user",
              parts: [
                {
                  functionResponse: {
                    //id: msg.toolCallId,
                    name: functionName || "unknown",
                    response: {
                      output: msg.content, // "output" key is opinionated - not all functions will output objects
                    },
                  },
                },
              ],
            };
          }
          if (msg.role === "assistant") {
            const assistantMsg: DbLLMChatContent = {
              role: "model",
              parts:
                typeof msg.content === "string"
                  ? [{ text: msg.content }]
                  : msg.content.map(this.dbsaiclePartToDbLLMPart),
            };
            if (msg.toolCalls) {
              msg.toolCalls.forEach((toolCall) => {
                if (toolCall.function?.name && toolCall.function?.arguments) {
                  assistantMsg.parts.push({
                    functionCall: {
                      name: toolCall.function.name,
                      args: JSON.parse(toolCall.function.arguments),
                    },
                  });
                }
              });
            }
            return assistantMsg;
          }
          return {
            role: "user",
            parts:
              typeof msg.content === "string"
                ? [{ text: msg.content }]
                : msg.content.map(this.dbsaiclePartToDbLLMPart),
          };
        }),
    };
    if (options) {
      body.generationConfig = this.convertArgs(options);
    }
      // Convert and add tools if present
      if (options.tools?.length) {
        // Choosing to map all tools to the functionDeclarations of one tool
        // Rather than map each tool to its own tool + functionDeclaration
        // Same difference
        const functions: DbLLMToolFunctionDeclaration[] = [];
        options.tools.forEach((tool) => {
          try {
            functions.push(convertDbSaicleToolToDbLLMFunction(tool));
          } catch (e) {
            console.warn(
              `Failed to convert tool to DbLLM function definition. Skipping: ${JSON.stringify(tool, null, 2)}`,
            );
          }
        });
        if (functions.length) {
          body.tools = [
            {
              functionDeclarations: functions,
            },
          ];
        }
      }

    return body;
  }

  public trim_buffer(buf:string):[string,boolean]{

    if ((buf.startsWith("```json") || buf.startsWith("```json\n")) 
      && (!buf.endsWith("```") && (!buf.endsWith("```\n")))) {
      return [buf, true]; // incomplete JSON block, wait for more data
    }
    while (buf.startsWith("```json") && (buf.endsWith("```") || buf.endsWith("```\n"))) {
      if (buf.startsWith("```json\n")) {
        buf = buf.slice(8);
      }
      if (buf.startsWith("```json")) {
        buf = buf.slice(7);
      }
      if (buf.endsWith("```")) {
        buf = buf.slice(0, -3);
      } 
      if (buf.endsWith("```\n")) {
        buf = buf.slice(0, -4);
      } 
      if(buf.startsWith('```')&& !buf.startsWith("```json")) {
        buf = buf.slice(3);
      }
    }
    return [buf, false];
    
  }

  public async *processDbLLMResponse(
    stream: AsyncIterable<string>,
  ): AsyncGenerator<ChatMessage> {

    let buf:string = "";
    for await (const chunk of stream) {
        buf += String(chunk);
        if (buf.startsWith("[")) {
          buf = buf.slice(1);
        }
        if (buf.endsWith("]")) {
          buf = buf.slice(0, -1);
        }
        if (buf.startsWith(",")) {
          buf = buf.slice(1);
        }

        //console.log("buffer is "+ buffer)
        let [buffer, incomplete] = this.trim_buffer(buf); 
        
        if (incomplete) {
          continue; // incomplete JSON block, wait for more data
        }

        const parts = buffer.split("\n,");
        for (let i = 0; i < parts.length; i++) {
        let part = parts[i];
        let data: DbLLMChatResponse;
        try {
          data = JSON.parse(part) as DbLLMChatResponse;
        } catch (e) {
          part = part.replaceAll("\n"," ");
          try {
            data = JSON.parse(part) as DbLLMChatResponse;
          } catch (e1) {
            continue; // yo!
          }
        }

        if ("error" in data) {
          throw new Error(data.error.message);
        }

        // Check for existence of each level before accessing the final 'text' property
        const content = data?.candidates?.[0]?.content;
        if (content) {
          const textParts: MessagePart[] = [];
          const toolCalls: ToolCallDelta[] = [];

          for (const part of content.parts) {
            if ("text" in part) {
              textParts.push({ type: "text", text: part.text });
            } else if ("functionCall" in part) {
              toolCalls.push({
                type: "function",
                id: part.functionCall.id ?? uuidv4(),
                function: {
                  name: part.functionCall.name,
                  arguments:
                    typeof part.functionCall.args === "string"
                      ? part.functionCall.args
                      : JSON.stringify(part.functionCall.args),
                },
              });
            } else {
              // Note: function responses shouldn't be streamed, images not supported
              console.warn("Unsupported DbLLM part type received", part);
            }
          }
          const disclaimer = "\n\n!Important: Code generated is not for direct usage in production.";
          
          const hasDisclaimer = textParts.some(
            (part) => part.type === "text" && part.text?.includes("!Important: Code generated is not for direct usage in production."));

          if (!hasDisclaimer && toolCalls.length === 0) {
            textParts.push({
              type: "text",
              text: disclaimer,
            });
          }

          const assistantMessage: AssistantChatMessage = {
            role: "assistant",
            content: textParts.length ? textParts : "",
          };
          if (toolCalls.length > 0) {
            assistantMessage.toolCalls = toolCalls;
          }
          if (textParts.length || toolCalls.length) {
            yield assistantMessage;
          }
        } else {
          // Handle the case where the expected data structure is not found
          console.warn("Unexpected response format:", data);
        }
      }

      buffer = "";
      
    }
  }
  private getLastUserContent(messages: ChatMessage[]): [number, string] {
    let candidate:[number, string] = [messages.length - 1, ""];
    
    for (let i = messages.length - 1; i >= 0; i--) {
      // find last user request
      if (messages[i].role === "user") {
        candidate = [i, JSON.stringify(messages[i].content)];
      }else {
        continue;
      }
      // if before user request assistant had requested additional request then skip even that user request
      if (i >0 ) {
        if (messages[i - 1].role !== "user" && JSON.stringify(messages[i - 1].content).includes("Additionally, please")) {
          continue;
        } else {
          break;
        }
      }
    }
    let [last_user_index, content] = candidate;
    let user_content = '';
    for (let j:number= last_user_index; j < messages.length; j++) {
      if (messages[j].role === "user" || JSON.stringify(messages[j].content).includes("Additionally, please")) {
        user_content += messages[j].content + ". ";
      } 
    }
    return [last_user_index, user_content];
  }

  private getLastToolContent(last_user_index:number, messages: ChatMessage[]): string {
    let lastUserMsgIndex = last_user_index;
    let final_tool_output:string = "";
    let other_tool_outputs:string = "";
    for ( let j= messages.length - 1; j >= lastUserMsgIndex; j--) {
      if (messages[j].role === "tool") {
        if (final_tool_output === "") {
          final_tool_output = JSON.stringify(messages[j].content);
        } else {
          other_tool_outputs += JSON.stringify(messages[j].content) + "\n";
        }
      }
    }
    return `last_tool_output: '${final_tool_output}'\n other_tool_outputs: '${other_tool_outputs}'`;
  }

  public prepareBodyOfContext(
    messages: ChatMessage[],
  ): DbLLMChatRequestBody {
    const toolCallIdToNameMap = new Map<string, string>();
    messages.forEach((msg) => {
      if (msg.role === "assistant" && msg.toolCalls) {
        msg.toolCalls.forEach((call) => {
          if (call.id && call.function?.name) {
            toolCallIdToNameMap.set(call.id, call.function.name);
          }
        });
      }
    });
    const systemMessage = messages.find(
      (msg) => msg.role === "system",
    )?.content;
    const body: DbLLMChatRequestBody = {
      contents: messages
        .filter((msg) => !(msg.role === "system"))
        .map((msg) => {
          if (msg.role === "tool") {
            let functionName = toolCallIdToNameMap.get(msg.toolCallId);
            if (!functionName) {
              console.warn(
                "Sending tool call response for unidentified tool call",
              );
            }
            return {
              role: "user",
              parts: [
                {
                  functionResponse: {
                    //id: msg.toolCallId,
                    name: functionName || "unknown",
                    response: {
                      output: msg.content, // "output" key is opinionated - not all functions will output objects
                    },
                  },
                },
              ],
            };
          }
          if (msg.role === "assistant") {
            const assistantMsg: DbLLMChatContent = {
              role: "model",
              parts:
                typeof msg.content === "string"
                  ? [{ text: msg.content }]
                  : msg.content.map(this.dbsaiclePartToDbLLMPart),
            };
            if (msg.toolCalls) {
              msg.toolCalls.forEach((toolCall) => {
                if (toolCall.function?.name && toolCall.function?.arguments) {
                  assistantMsg.parts.push({
                    functionCall: {
                      name: toolCall.function.name,
                      args: JSON.parse(toolCall.function.arguments),
                    },
                  });
                }
              });
            }
            return assistantMsg;
          }
          return {
            role: "user",
            parts:
              typeof msg.content === "string"
                ? [{ text: msg.content }]
                : msg.content.map(this.dbsaiclePartToDbLLMPart),
          };
        }),
    };
    if (systemMessage) {
      body.systemInstruction = {
        parts: [{ text: stripImages(systemMessage) }],
      };
    
      }
    return body;
  }

  private async *streamChatDbLLM(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    /**
     * 0th message is system message.
     * extract the system instruction from here.
     * and merge with the actual one.
     */

    var apiURL = this.apiBase;


    if (apiURL?.endsWith("/")) {
      apiURL = apiURL.slice(0, -1);
    }

    // Convert chat messages to contents
    const systemMessage = messages.find(
      (msg) => msg.role === "system",
    )?.content;

    if (messages.length > 0 && messages[0].role === "system") {
      messages = messages.slice(1);// Remove system message from the messages array
    }

    const body = this.prepareBody(messages, options);
    //console.log("DbLLM request body :", JSON.stringify(body, null, 2));
    if (!apiURL) {
      throw new Error("API base URL is not set for DbLLM"); 
    }

    // @ts-ignore

    //const agent = new https.Agent({rejectUnauthorized: false});
    var sysMsg = systemMessage?systemMessage : "";
    if (sysMsg && sysMsg.length > 0 ){
      sysMsg = sysMsg.slice("</important_rules>".length *-1);
    }
  
  
    let sysMsg_mandatory_prefix = "\n!Important: Output must be in JSON string format  "
    +" and if NOT already enclosed with in ```json``` and '```' then must be enclosed in "
    +" '```json' and '```', with all candidates listed with `candidates` as the top level key, and each "
    +" candidate must have `content` key. the `content` key must have `parts` key. The `parts` key must "
    + "contain array of parts. The part may contain `text` key describimg the text response. ";
    //+ "The text response if it does not contain string '```' then it should have '```text' as prefix and '```' as suffix. "

    let sysMsg_sufix = " Do not include any other keys of metadata in the response. "
    +" Do not include any other keys in the response. \n</important_rules>";

    let tool_call_sys_prompt = " If you are calling a tool, ensure that"
    +" you have all the required information for all of the arguments of selected functionCall. "
    +" if you are missing some of the information for the functionCall argument"
    +" then request the same through chat e.g. when missing value for " 
    +" parameter 'x' specify 'Additionally, please provide the value for x'. "
    +" you must use the words 'Additionally, please provide' for any such request. "
    +" For calling a tool you must use the `functionCall` instead of `text`  key in the part. "
    +" The name of the tool must be added with `name` as child key of `functionCall`."
    +" The arguments for tools must be added as `args` as child key of `functionCall`."
    +" The `args` key must have array of arguments. "
    
    let [last_user_index, msg_str] = this.getLastUserContent(messages);

    if (messages && messages.length > 0 && messages[messages.length - 1].role !== "user") {
      const last_tool_content = this.getLastToolContent(Number(last_user_index), messages);
      msg_str = " The user request combined was \n User Request:" + msg_str + "\n";
      msg_str += " The last output of the tool calling was \n tool output:" + this.getLastToolContent(last_user_index, messages) + "\n";
      msg_str += " if the tool output is satisfying the user request then just add `text` key with value '\n\n!Important: Code generated is not for direct usage in production.'."
      msg_str += "  else call additional tool if available through  `functionCall` as content of part. "
     }
     
    sysMsg += sysMsg_mandatory_prefix;
    // tool call instructions are included.
    sysMsg += tool_call_sys_prompt;
    sysMsg += `\n Possible tools to be used for function calls are : ${JSON.stringify(body?.tools)}\n`;
    sysMsg += sysMsg_sufix;

    if (last_user_index > 0) {
      const context_msgs = messages.slice(0, last_user_index);
      const context_body = this.prepareBodyOfContext(context_msgs);
      if (context_body && context_body.contents && context_body.contents.length > 0) {
        msg_str += "\n\n The previous conversation to be used as context is provided in json format as \n\n context: " ;
        msg_str += JSON.stringify(context_body);
        msg_str += "\n\n End of previous conversation context. \n\n";

      }
   
    }
    
    const raw = JSON.stringify({
      "email": this.email,
      "apiKey": this.dbllm_apikey,
      "kannon_id": this.kannon_id,
      "message": msg_str,
      "data_classification": this.data_classification,
      "system_prompt": sysMsg,
    });


    
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    const requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: raw,
      redirect: 'follow' as RequestRedirect
      //agent: agent,
    };


    const response = await fetch(apiURL as string, requestOptions);

    for await (const message of this.processDbLLMResponse(
      // @ts-ignore
      streamResponse(response),
    )) {
      yield message;
    }
  }
  
  private async *streamChatBison(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const msgList = [];
    for (const message of messages) {
      msgList.push({ content: message.content });
    }

    const apiURL = new URL(
      `models/${options.model}:generateMessage?key=${this.apiKey}`,
      this.apiBase,
    );
    const body = { prompt: { messages: msgList } };
    const response = await this.fetch(apiURL, {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    });
    const data = await response.json();
    yield { role: "assistant", content: data.candidates[0].content };
  }

  async _embed(batch: string[]): Promise<number[][]> {
    // Batch embed endpoint: https://ai.google.dev/api/embeddings?authuser=1#EmbedContentRequest
    const requests = batch.map((text) => ({
      model: this.model,
      content: {
        role: "user",
        parts: [{ text }],
      },
    }));

    const resp = await this.fetch(
      new URL(`${this.model}:batchEmbedContents`, this.apiBase),
      {
        method: "POST",
        body: JSON.stringify({
          requests,
        }),
        headers: {
          "x-goog-api-key": this.apiKey,
          "Content-Type": "application/json",
        } as any,
      },
    );

    if (!resp.ok) {
      throw new Error(await resp.text());
    }

    const data = (await resp.json()) as any;

    return data.embeddings.map((embedding: any) => embedding.values);
  }
}

export default DbLLM;
