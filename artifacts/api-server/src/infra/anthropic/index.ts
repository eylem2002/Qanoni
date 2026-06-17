/* Single infrastructure entry for the Anthropic (Claude) client.
   Domain/logic code imports the client from here, never from the
   integration package directly. */
export { anthropic } from "@workspace/integrations-anthropic-ai";
