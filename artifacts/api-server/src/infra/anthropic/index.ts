/* Single infrastructure entry for the OpenAI client.
   Domain/logic code imports the client from here, never from the
   integration package directly. */
export { openai } from "@workspace/integrations-anthropic-ai";
